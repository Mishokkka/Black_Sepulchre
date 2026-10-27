import { useId, useMemo } from 'react'
import { battlefieldFor } from '../../shared/battlefield'
import { terrainWalls, type TerrainPiece } from '../../shared/terrain'
import { labels, type Props } from './common'
import { TerrainGuide } from './TerrainGuide'
import { TerrainPieceDetails } from './TerrainPieceDetails'

const format = (value: number) => +value.toFixed(2)
type LabelBox = { left: number; right: number; top: number; bottom: number }

/** Prefer the centre, then a free corner, so mission symbols cannot cover area IDs. */
function terrainNumberPosition(p: TerrainPiece, occupied: LabelBox[], boardHeight: number) {
  const halfWidth = Math.max(0.8, p.id.length * 0.45)
  const left = p.x + halfWidth + 0.25,
    right = p.x + p.width - halfWidth - 0.25
  const top = p.y + 1.5,
    bottom = p.y + p.height - 0.4
  const centre = { x: p.x + p.width / 2, y: p.y + p.height / 2 + 0.5 }
  const candidates = [
    ...(p.objectiveId ? [] : [centre]),
    { x: right, y: top },
    { x: left, y: bottom },
    { x: left, y: top },
    { x: right, y: bottom },
    { x: centre.x, y: p.y - 0.4 },
    { x: centre.x, y: p.y + p.height + 1.5 },
  ].filter(({ y }) => y >= 1.4 && y + 0.4 <= boardHeight)
  const collisions = ({ x, y }: { x: number; y: number }) =>
    occupied.reduce(
      (sum, box) =>
        sum +
        Math.max(0, Math.min(x + halfWidth, box.right) - Math.max(x - halfWidth, box.left)) *
          Math.max(0, Math.min(y + 0.4, box.bottom) - Math.max(y - 1.4, box.top)),
      0,
    )
  return candidates.reduce((best, candidate) =>
    collisions(candidate) < collisions(best) ? candidate : best,
  )
}

export function BattlefieldPlan({ s }: Pick<Props, 's'>) {
  const b = s.battle!
  const code = b.mission ?? b.type
  const clipId = useId()
  const objectKey = b.table.objects.map((o) => `${o.id}:${o.kind}:${o.x}:${o.y}`).join('|')
  const setup = useMemo(
    () => battlefieldFor(s),
    // Old battles reconstruct v1 from public starting geometry; new battles use their saved setup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [b.battlefield, b.id, code, b.type, b.stage, b.number, s.choir, objectKey],
  )
  const size = { l: setup.length, w: setup.width, d: setup.deployment }
  const short = code === 'C3'
  const { terrain: plan, legacyI2 } = setup
  const table = { objects: setup.objects }
  const grouped = table.objects.reduce<(typeof table.objects)[]>((groups, object) => {
    const group = groups.find((g) => g[0].x === object.x && g[0].y === object.y)
    if (group) group.push(object)
    else groups.push([object])
    return groups
  }, [])
  const label = (id: string) => {
    if (id === 'engine') return code === 'J2' ? 'Mouth' : code === 'J3' ? 'Reactor' : 'Engine'
    if (id === 'overlay') return b.number <= 14 ? 'Echo Terminal' : 'Contest Anchor'
    if (id === 'index') return 'Index'
    if (id === '1' && code === 'B3') return 'Procession'
    if (id === '1' && code === 'E1') return 'Train'
    if (id === '1' && code === 'C2') return 'Platform'
    if (id === '5' && /^[AK]3$/.test(code)) return 'Throne'
    return id
  }
  const kind = (o: (typeof table.objects)[number]) =>
    o.kind === 'objective'
      ? plan.pieces.some((p) => p.objectiveId === o.id)
        ? `Objective: область ${plan.pieces.find((p) => p.objectiveId === o.id)?.id ?? '?'}`
        : 'Objective: маркер Ø40 мм'
      : o.kind === 'item'
        ? 'Предмет'
        : 'Точка взаимодействия'
  const objectPresentation = grouped.map((group) => {
    const o = group[0]
    const areaObjective = group.some((v) => plan.pieces.some((p) => p.objectiveId === v.id))
    const name = group.map((v) => label(v.id)).join(' / ')
    const edge = Math.max(2, name.length * 0.5)
    const anchor: 'start' | 'end' | 'middle' =
      o.x < edge ? 'start' : o.x > size.l - edge ? 'end' : 'middle'
    const labelX = anchor === 'start' ? o.x + 0.8 : anchor === 'end' ? o.x - 0.8 : o.x
    const labelY = o.y < (areaObjective ? 4.5 : 3) ? o.y + 2.5 : o.y - (areaObjective ? 2.8 : 1.4)
    return { group, o, areaObjective, name, anchor, labelX, labelY }
  })
  const occupied = objectPresentation.flatMap(({ o, name, anchor, labelX, labelY }) => {
    const width = Math.max(0.9, name.length * 0.8)
    const left =
      anchor === 'start' ? labelX : anchor === 'end' ? labelX - width : labelX - width / 2
    return [
      { left: o.x - 1.1, right: o.x + 1.1, top: o.y - 1.1, bottom: o.y + 1.1 },
      { left, right: left + width, top: labelY - 1.4, bottom: labelY + 0.3 },
    ]
  })
  const terrainNumbers = new Map<string, { x: number; y: number }>()
  for (const p of plan.pieces) {
    const position = terrainNumberPosition(p, occupied, size.w)
    terrainNumbers.set(p.id, position)
    const halfWidth = Math.max(0.8, p.id.length * 0.45)
    occupied.push({
      left: position.x - halfWidth,
      right: position.x + halfWidth,
      top: position.y - 1.4,
      bottom: position.y + 0.4,
    })
  }
  const attackers = b.type === 'PACT' ? 'Deathwatch' : labels[b.attacker]
  const defenders = b.type === 'PACT' ? 'Necrons' : labels[b.defender]
  const dense = plan.pieces.filter((p) => p.kind === 'dense').length
  return (
    <div className="battlefield-plan">
      <h3>Поле боя · схема {plan.code}</h3>
      <p>
        {size.l} × {size.w}″ · {plan.pieces.length} областей террейна: {dense} с плотными
        элементами, {plan.pieces.length - dense} с лёгкими. Схема одинакова у обоих игроков и
        сохраняется при обновлении страницы; переброс миссии создаёт новую схему.
      </p>
      {legacyI2 && (
        <p>
          Этот бой I2 был создан со старыми координатами и маркерами целей: схема сохраняет их.
          Исправленные центры дорожек и цели-области используются для новых боёв.
        </p>
      )}
      <figure className="mission-layout">
        <svg
          viewBox={`-4 -6 ${size.l + 8} ${size.w + 12}`}
          role="img"
          aria-label="Начальная расстановка и координаты объектов миссии"
        >
          <title>Поле боя, области террейна и начальные позиции объектов миссии</title>
          <defs>
            <clipPath id={clipId}>
              <rect width={size.l} height={size.w} />
            </clipPath>
          </defs>
          <rect width={size.l} height={size.w} fill="#111914" stroke="#a69b77" strokeWidth=".35" />
          <rect
            width={short ? size.d : size.l}
            height={short ? size.w : size.d}
            fill="#786044"
            opacity=".42"
          />
          <rect
            x={short ? size.l - size.d : 0}
            y={short ? 0 : size.w - size.d}
            width={short ? size.d : size.l}
            height={short ? size.w : size.d}
            fill="#4f7761"
            opacity=".42"
          />
          <g clipPath={`url(#${clipId})`}>
            {code === 'C3' && (
              <rect x={size.l / 2 - 4} width="8" height={size.w} fill="#d8bf70" opacity=".13" />
            )}
            {code === 'D3' &&
              [0.25, 0.5, 0.75].map((x) => (
                <rect
                  key={x}
                  x={size.l * x - 2}
                  y={size.d}
                  width="4"
                  height={size.w - 2 * size.d}
                  fill="#d8bf70"
                  opacity=".13"
                />
              ))}
            {code === 'I2' &&
              [1, 2].map((x) => (
                <line
                  key={x}
                  x1={(size.l * x) / 3}
                  y1="0"
                  x2={(size.l * x) / 3}
                  y2={size.w}
                  stroke="#cbb575"
                  strokeWidth=".3"
                  strokeDasharray="1 1"
                />
              ))}
            {code === 'H3' && (
              <circle
                cx={size.l / 2}
                cy={size.w / 2}
                r="18"
                fill="#d8bf70"
                fillOpacity=".08"
                stroke="#d8bf70"
                strokeWidth=".3"
                strokeDasharray="1 1"
              />
            )}
            {['B3', 'E1'].includes(code) && (
              <line
                x1="0"
                y1={size.w / 2}
                x2={size.l}
                y2={size.w / 2}
                stroke="#d8bf70"
                strokeWidth=".35"
                strokeDasharray="1 1"
              />
            )}
            {code === 'C2' && (
              <line
                x1={size.l / 2}
                y1="0"
                x2={size.l / 2}
                y2={size.w}
                stroke="#d8bf70"
                strokeWidth=".35"
                strokeDasharray="1 1"
              />
            )}
            {plan.pieces.map((p) => {
              const number = terrainNumbers.get(p.id)!
              const wall = terrainWalls(p)
                .map((segment) => `M ${segment.x1} ${segment.y1} L ${segment.x2} ${segment.y2}`)
                .join(' ')
              return (
                <g key={p.id}>
                  <title>{`${p.id}: ${p.kind === 'dense' ? 'плотный' : 'лёгкий'} террейн, ${p.width} × ${p.height}″`}</title>
                  <rect
                    x={p.x}
                    y={p.y}
                    width={p.width}
                    height={p.height}
                    fill={p.kind === 'dense' ? '#41544b' : '#655d48'}
                    stroke={p.objectiveId ? '#f4cb76' : p.kind === 'dense' ? '#a9c3a9' : '#d4bd88'}
                    strokeWidth={p.objectiveId ? '.5' : '.25'}
                  />
                  <path
                    d={wall}
                    fill="none"
                    stroke={p.kind === 'dense' ? '#c9d7bd' : '#e6d7ab'}
                    strokeWidth=".45"
                  />
                  <text x={number.x} y={number.y} textAnchor="middle" className="terrain-number">
                    {p.id}
                  </text>
                </g>
              )
            })}
            {objectPresentation.map(({ group, o, areaObjective, name, anchor, labelX, labelY }) => {
              const objective = group.some((v) => v.kind === 'objective')
              const item = group.some((v) => v.kind === 'item')
              return (
                <g key={group.map((v) => v.id).join('-')}>
                  <title>{group.map((v) => `${label(v.id)}: ${kind(v)}`).join('; ')}</title>
                  {areaObjective ? (
                    <path
                      d={`M ${o.x - 0.45} ${o.y} h .9 M ${o.x} ${o.y - 0.45} v .9`}
                      stroke="#f4cb76"
                      strokeWidth=".35"
                    />
                  ) : objective ? (
                    <circle
                      cx={o.x}
                      cy={o.y}
                      r=".79"
                      fill="#f4cb76"
                      stroke="#211a0d"
                      strokeWidth=".22"
                    />
                  ) : item ? (
                    <path
                      d={`M ${o.x} ${o.y - 0.9} l .9 .9 l -.9 .9 l -.9 -.9 Z`}
                      fill="#b5d5ed"
                      stroke="#1a2430"
                      strokeWidth=".22"
                    />
                  ) : (
                    <rect
                      x={o.x - 0.75}
                      y={o.y - 0.75}
                      width="1.5"
                      height="1.5"
                      fill="#d8efda"
                      stroke="#19251b"
                      strokeWidth=".22"
                    />
                  )}
                  <text x={labelX} y={labelY} textAnchor={anchor} className="object-number">
                    {name}
                  </text>
                </g>
              )
            })}
          </g>
          <text x={size.l / 2} y="-2" textAnchor="middle">
            {size.l}″ · x →
          </text>
          <text x={size.l / 2} y={size.w + 4} textAnchor="middle">
            {size.w}″ · y ↓
          </text>
        </svg>
        <figcaption>
          Начальные позиции. Золотая граница — objective-область; круг — objective-маркер, ромб —
          переносимый предмет, квадрат — точка взаимодействия. Линии внутри площадей — рекомендуемое
          расположение физических элементов.
        </figcaption>
      </figure>
      <p>
        {b.type === 'PACT' ? attackers : `Атакующий: ${attackers}`} — {short ? 'слева' : 'сверху'},
        зона {short ? 'x' : 'y'} ≤ {size.d}″.{' '}
        {b.type === 'PACT' ? defenders : `Защитник: ${defenders}`} — {short ? 'справа' : 'снизу'},
        зона {short ? 'x' : 'y'} ≥ {(short ? size.l : size.w) - size.d}″. Первый ход определите
        обычным roll-off.
      </p>
      <p>
        Зелёные области содержат открытые плотные руины, песочные — низкие лёгкие баррикады. Базовый
        набор — глухие стены 4″ и баррикады 1″, без верхних этажей. Форму и размеры каждого элемента
        можно раскрыть в таблице ниже. Перед игрой проверьте проходы для самых крупных баз и доступ
        к каждой точке с обеих сторон.
      </p>
      <p>
        У цели-области контроль определяется моделями внутри её границы. Для objective-маркера
        диаметром 40 мм контроль проверяется в 3″ по горизонтали и 5″ по вертикали от его края. В
        этой кампании цель-маркер остаётся маркером, даже если лежит внутри области террейна. Точки
        взаимодействия и переносимые предметы сами по себе не являются objectives.
      </p>
      <TerrainGuide />
      {code === 'PACT' && (
        <p>
          Для PACT области не пересекают прямые линии к каждому Seal. При установке самих элементов
          также сохраните видимость к каждому Seal с обеих сторон.
        </p>
      )}
      {['B3', 'E1', 'C2', 'C3', 'D3', 'H3', 'I2'].includes(code) && (
        <p className="muted">
          Пунктир или полупрозрачная полоса отмечает маршрут либо область, описанную в правилах этой
          миссии.
        </p>
      )}
      <details className="terrain-details">
        <summary>Размеры и координаты для расстановки</summary>
        <p>
          Все значения в дюймах. Начало координат — верхний левый угол поля. Для террейна указаны
          координаты верхнего левого угла области, для объектов — их центры. Значения округлены до
          0,01″. Нажмите название постройки, чтобы увидеть высоту, толщину и расположение стен.
        </p>
        <div className="mission-coordinates">
          <table>
            <caption>Области террейна</caption>
            <thead>
              <tr>
                <th>№</th>
                <th>Тип</th>
                <th>Размер x × y</th>
                <th>x</th>
                <th>y</th>
              </tr>
            </thead>
            <tbody>
              {plan.pieces.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>
                    <TerrainPieceDetails piece={p} />
                  </td>
                  <td>
                    {p.width} × {p.height}
                  </td>
                  <td>{format(p.x)}</td>
                  <td>{format(p.y)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table>
            <caption>Объекты миссии · начальные позиции</caption>
            <thead>
              <tr>
                <th>Объект</th>
                <th>Тип</th>
                <th>x</th>
                <th>y</th>
              </tr>
            </thead>
            <tbody>
              {table.objects.map((o) => (
                <tr key={o.id}>
                  <td>{label(o.id)}</td>
                  <td>{kind(o)}</td>
                  <td>{format(o.x)}</td>
                  <td>{format(o.y)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
