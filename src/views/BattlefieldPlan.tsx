import { useId, useMemo } from 'react'
import { STAGES } from '../../shared/rules'
import { createTable } from '../../shared/table'
import { generateTerrain } from '../../shared/terrain'
import { labels, type Props } from './common'

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
  const objectKey = table.objects.map((o) => `${o.id}:${o.x}:${o.y}`).join('|')
  const plan = useMemo(
    () =>
      generateTerrain({
        battleId: b.id,
        mission: code,
        length: size.l,
        width: size.w,
        deployment: size.d,
        objects: table.objects,
      }),
    // The key contains every coordinate that influences placement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [b.id, code, size.l, size.w, size.d, objectKey],
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
  const kind = (value: string) =>
    value === 'objective' ? 'Objective' : value === 'item' ? 'Предмет' : 'Точка взаимодействия'
  const attackers = b.type === 'PACT' ? 'Deathwatch' : labels[b.attacker]
  const defenders = b.type === 'PACT' ? 'Necrons' : labels[b.defender]
  const dense = plan.pieces.filter((p) => p.kind === 'dense').length
  return (
    <div className="battlefield-plan">
      <h3>Поле боя · схема {plan.code}</h3>
      <p>
        {size.l} × {size.w}″ · {plan.pieces.length} областей террейна: {dense} плотных,{' '}
        {plan.pieces.length - dense} лёгких. Схема одинакова у обоих игроков и сохраняется при
        обновлении страницы; переброс миссии создаёт новую схему.
      </p>
      <figure className="mission-layout">
        <svg
          viewBox={`-4 -6 ${size.l + 8} ${size.w + 12}`}
          role="img"
          aria-label={`Начальная расстановка объектов и террейна, схема ${plan.code}`}
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
              const x1 = p.x + 0.7,
                x2 = p.x + p.width - 0.7
              const y1 = p.y + 0.7,
                y2 = p.y + p.height - 0.7
              const wall =
                p.kind === 'dense'
                  ? p.mirrored
                    ? `M ${x1} ${y2} H ${x2} V ${y1}`
                    : `M ${x2} ${y1} H ${x1} V ${y2}`
                  : p.mirrored
                    ? `M ${x1} ${y2} H ${x2}`
                    : `M ${x1} ${y1} H ${x2}`
              return (
                <g key={p.id}>
                  <title>
                    {p.id}: {p.kind === 'dense' ? 'плотный' : 'лёгкий'} террейн, {p.width} ×{' '}
                    {p.height}″
                  </title>
                  <rect
                    x={p.x}
                    y={p.y}
                    width={p.width}
                    height={p.height}
                    fill={p.kind === 'dense' ? '#41544b' : '#655d48'}
                    stroke={p.kind === 'dense' ? '#a9c3a9' : '#d4bd88'}
                    strokeWidth=".25"
                  />
                  <path
                    d={wall}
                    fill="none"
                    stroke={p.kind === 'dense' ? '#c9d7bd' : '#e6d7ab'}
                    strokeWidth=".45"
                  />
                  <text
                    x={p.x + p.width / 2}
                    y={p.y + p.height / 2 + 0.5}
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
              const objective = group.some((v) => v.kind === 'objective')
              const item = group.some((v) => v.kind === 'item')
              return (
                <g key={group.map((v) => v.id).join('-')}>
                  <title>{group.map((v) => `${label(v.id)}: ${kind(v.kind)}`).join('; ')}</title>
                  {objective ? (
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
                    x={o.x}
                    y={o.y < 3 ? o.y + 2.5 : o.y - 1.4}
                    textAnchor="middle"
                    className="object-number"
                  >
                    {group.map((v) => label(v.id)).join(' / ')}
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
          Начальные позиции. Круг — objective, ромб — переносимый предмет, квадрат — точка
          взаимодействия. Фигуры внутри областей показывают пример расположения элементов.
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
        Прямоугольник — граница области, а линия внутри — пример элемента: плотные руины или здания
        показаны зелёным, лёгкие препятствия — песочным. Разместите элементы внутри областей,
        оставив место для моделей. Согласуйте их категории до игры; проверьте реальные проходы для
        ваших самых крупных баз и доступ к каждой точке с обеих сторон.
      </p>
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
          координаты верхнего левого угла области, для объектов — их центры.
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
                  <td>{p.x}</td>
                  <td>{p.y}</td>
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
                  <td>{kind(o.kind)}</td>
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
