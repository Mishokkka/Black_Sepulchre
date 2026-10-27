import { useId, useMemo } from 'react'
import { STAGES } from '../../shared/rules'
import { createTable } from '../../shared/table'
import {
  generateTerrain,
  hasLegacyI2Coordinates,
  isTerrainObjective,
  terrainWalls,
} from '../../shared/terrain'
import { labels, type Props } from './common'
import { TerrainGuide } from './TerrainGuide'

const format = (value: number) => +value.toFixed(2)

export function BattlefieldPlan({ s }: Pick<Props, 's'>) {
  const b = s.battle!
  const code = b.mission ?? b.type
  const size = ['WAR', 'PACT'].includes(b.type) ? { l: 60, w: 44, d: 12 } : STAGES[b.stage]
  const short = code === 'C3'
  const clipId = useId()
  // Reconstruct the starting positions, independent of any old battle journal.
  const table = createTable({ ...s, stage: b.stage, battles: b.number - 1 }, code, {
    actor: b.attacker,
    dice: () => 1,
    id: () => '',
  })
  // I2 objectives are stationary. Preserve the published starting coordinates
  // of already-created battles rather than silently moving them after deployment.
  const legacyI2 = code === 'I2' && hasLegacyI2Coordinates(size.l, size.w, b.table?.objects ?? [])
  if (legacyI2) {
    for (const object of table.objects) {
      const saved = b.table.objects.find((o) => o.id === object.id)
      if (saved && ['1', '2', '3'].includes(object.id)) {
        object.x = saved.x
        object.y = saved.y
      }
    }
  }
  const objectKey = table.objects.map((o) => `${o.id}:${o.kind}:${o.x}:${o.y}`).join('|')
  const plan = useMemo(
    () =>
      generateTerrain({
        battleId: b.id,
        mission: code,
        length: size.l,
        width: size.w,
        deployment: size.d,
        objects: table.objects,
        legacyI2,
      }),
    // The key contains every coordinate that influences placement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [b.id, code, size.l, size.w, size.d, objectKey, legacyI2],
  )
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
      ? isTerrainObjective(code, o, legacyI2)
        ? `Objective: область ${plan.pieces.find((p) => p.objectiveId === o.id)?.id ?? '?'}`
        : 'Objective: маркер Ø40 мм'
      : o.kind === 'item'
        ? 'Предмет'
        : 'Точка взаимодействия'
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
                  <text
                    x={p.objectiveId ? p.x + p.width - 1.1 : p.x + p.width / 2}
                    y={p.objectiveId ? p.y + 1.45 : p.y + p.height / 2 + 0.5}
                    textAnchor="middle"
                    className="terrain-number"
                  >
                    {p.id}
                  </text>
                </g>
              )
            })}
            {grouped.map((group) => {
              const o = group[0]
              const areaObjective = group.some((v) => isTerrainObjective(code, v, legacyI2))
              const objective = group.some((v) => v.kind === 'objective')
              const item = group.some((v) => v.kind === 'item')
              const name = group.map((v) => label(v.id)).join(' / ')
              // Long labels at the table edge must stay inside the SVG clip.
              const edge = Math.max(2, name.length * 0.5)
              const anchor = o.x < edge ? 'start' : o.x > size.l - edge ? 'end' : 'middle'
              const labelX = anchor === 'start' ? o.x + 0.8 : anchor === 'end' ? o.x - 0.8 : o.x
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
                  <text
                    x={labelX}
                    y={
                      o.y < (areaObjective ? 4.5 : 3)
                        ? o.y + 2.5
                        : o.y - (areaObjective ? 2.8 : 1.4)
                    }
                    textAnchor={anchor}
                    className="object-number"
                  >
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
        Зелёные области содержат плотные руины или здания, песочные — лёгкие препятствия. Плотные
        стены рекомендуется сделать непрозрачными и высотой не менее 3″. Разместите элементы внутри
        областей и оставьте место для моделей; проверьте реальные проходы для самых крупных баз и
        доступ к каждой точке с обеих сторон.
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
          0,01″.
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
                  <td>{p.kind === 'dense' ? 'Плотный' : 'Лёгкий'}</td>
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
