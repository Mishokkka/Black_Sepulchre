import type { BattlefieldObject, BattlefieldSetup } from '../../shared/battlefield'
import { terrainProfile, type TerrainPiece } from '../../shared/terrain'

export type BattlefieldInfo = {
  id: string
  title: string
  category: string
  summary: string
  facts: [string, string][]
  badges?: string[]
  rules?: string[]
  terrain?: TerrainPiece
  missionRules?: boolean
}

export const inches = (n: number) => `${+n.toFixed(2)}″`

export function terrainPieceName(p: TerrainPiece) {
  return p.kind === 'light'
    ? 'Низкая баррикада'
    : p.platforms?.length
      ? 'Руина с этажом'
      : p.symmetric
        ? 'Два угла руин'
        : 'Угол руин'
}

export function mapObjectLabel(mission: string, battleNumber: number, id: string) {
  if (id === 'engine') return mission === 'J2' ? 'Mouth' : mission === 'J3' ? 'Reactor' : 'Engine'
  if (id === 'overlay') return battleNumber <= 14 ? 'Echo Terminal' : 'Contest Anchor'
  if (id === 'index') return 'Index'
  if (id === '1' && mission === 'B3') return 'Procession'
  if (id === '1' && mission === 'E1') return 'Train'
  if (id === '1' && mission === 'C2') return 'Platform'
  if (id === '5' && /^[AK]3$/.test(mission)) return 'Throne'
  return id
}

export function terrainInfo(p: TerrainPiece): BattlefieldInfo {
  const profile = terrainProfile(p)
  const facts: [string, string][] = [
    [p.outline ? 'Габариты области' : 'Область', `${inches(p.width)} × ${inches(p.height)}`],
    ['Высота стен', inches(profile.wallHeight)],
    ['Верхний левый угол', `x ${inches(p.x)}, y ${inches(p.y)}`],
  ]
  for (const f of p.platforms ?? [])
    facts.push([
      'Площадка этажа',
      `${inches(f.width)} × ${inches(f.height)} · высота ${inches(f.elevation)}`,
    ])
  if (p.objectiveId)
    facts.push(['Контроль цели', `Цель ${p.objectiveId}: модели внутри всей области`])
  const rules = [
    'Obscuring: промежуточная область может закрывать обзор сквозь неё. Область, в которой находится одна из двух моделей, исключается из этой проверки; реальные стены всё равно учитываются.',
    'Hidden: INFANTRY/BEASTS/SWARM внутри области могут скрываться, если их отряд не стрелял в текущем и предыдущем ходе игрока. Дистанция обнаружения обычно 15″.',
    'Cover ухудшает BS соответствующих атак на 1 при выполнении условий размещения или частичной видимости всех моделей цели. Проверяйте условия отдельно для каждой атакующей модели.',
  ]
  if (p.kind === 'dense')
    rules.push(
      'Сквозь Dense горизонтально проходят INFANTRY/BEASTS/SWARM/MOBILE, вертикально — INFANTRY/BEASTS/SWARM. Для остальных высокие стены требуют обхода или подъёма по правилам.',
      'Solid: через закрытые проёмы до 3″ от земли линию видимости не проводят; модель не может закончить движение частью тела в таком проёме.',
    )
  else
    rules.push(
      'Light проходим горизонтально и вертикально для всех моделей по обычным правилам движения.',
    )
  if (p.platforms?.length)
    rules.push(
      'Для верхнего этажа нужен INFANTRY/BEASTS/SWARM/FLY/MONSTER. База помещается целиком, модель стоит устойчиво, отряд сохраняет coherency. Вертикальный путь учитывается в движении; Plunging Fire применяется по условиям основных правил.',
    )
  return {
    id: `terrain:${p.id}`,
    title: `${p.id} · ${terrainPieceName(p)}`,
    category: p.kind === 'dense' ? 'Плотный · Dense' : 'Лёгкий · Light',
    summary: p.objectiveId
      ? `Вся эта область является целью ${p.objectiveId}. Крестик показывает её центр для расстановки.`
      : p.kind === 'dense'
        ? 'Открытая руина. Светлые линии — глухие стены; цветная граница обозначает область, а не сплошное здание.'
        : 'Низкое препятствие внутри отдельной области. Светлая линия показывает положение самой баррикады.',
    facts,
    badges: ['Obscuring', 'Hidden', 'Cover', ...(p.kind === 'dense' ? ['Solid'] : [])],
    rules,
    terrain: p,
  }
}

/** Uses only the public, saved starting objects; no records or secret choices. */
export function missionObjectInfo(
  setup: BattlefieldSetup,
  group: readonly BattlefieldObject[],
  battleNumber: number,
): BattlefieldInfo {
  const names = group.map((o) => {
    const label = mapObjectLabel(setup.mission, battleNumber, o.id)
    if (label !== o.id) return label
    const type =
      setup.mission === 'F2'
        ? 'Signal'
        : setup.mission === 'PACT'
          ? 'Seal'
          : o.kind === 'objective'
            ? 'Цель'
            : o.kind === 'item'
              ? 'Предмет'
              : 'Точка'
    return `${type} ${o.id}`
  })
  const facts: [string, string][] = [
    ['Начальный центр', `x ${inches(group[0].x)}, y ${inches(group[0].y)}`],
  ]
  let terrain: TerrainPiece | undefined
  group.forEach((o, i) => {
    const area = setup.terrain.pieces.find((p) => p.objectiveId === o.id)
    if (o.kind === 'objective' && area) {
      terrain = area
      facts.push([
        names[i],
        `Цель-область ${area.id}, ${inches(area.width)} × ${inches(area.height)}. Контроль — по моделям внутри её границы.`,
      ])
    } else if (o.kind === 'objective')
      facts.push([
        names[i],
        'Маркер Ø40 мм (радиус 20 мм). Контроль в 3″ по горизонтали и 5″ по вертикали от края маркера.',
      ])
    else if (o.kind === 'item')
      facts.push([
        names[i],
        'Переносимый предмет. Подбор, переноску и сдачу выполняйте по карточке миссии.',
      ])
    else
      facts.push([
        names[i],
        'Точка взаимодействия. Действия и дистанции определены карточкой миссии и общими правилами кампании.',
      ])
  })
  let summary =
    group.length > 1
      ? 'Здесь совпадают начальные позиции нескольких объектов. У каждого сохраняются собственные правила.'
      : 'Объект миссии; показана его начальная позиция.'
  if (['B3', 'E1', 'C2'].includes(setup.mission) && group.some((o) => o.id === '1'))
    summary += ' Этот объект движется во время боя; схема не отслеживает его текущее положение.'
  if (setup.mission === 'F2')
    summary += ' Карта показывает потенциальные Signals и не раскрывает скрытый выбор.'
  if (
    group.some(
      (o) => o.kind === 'objective' && !setup.terrain.pieces.some((p) => p.objectiveId === o.id),
    )
  )
    summary += ' По исключению кампании маркер сохраняет свой тип и внутри области террейна.'
  return {
    id: `object:${group.map((o) => o.id).join(':')}`,
    title: names.join(' / '),
    category: 'Объекты миссии',
    summary,
    facts,
    terrain,
    missionRules: true,
  }
}
