import { createTable } from '../../shared/table'
import { STAGES } from '../../shared/rules'
import { EVENTS, MISSION_CARDS, CRISIS_CARDS } from '../../shared/rules.generated'
import { MissionBrief } from './MissionBrief'
import { labels, type Props } from './common'

export function TabletopMission({ s }: Pick<Props, 's'>) {
  const b = s.battle!,
    code = b.mission ?? b.type
  const size = ['WAR', 'PACT'].includes(b.type) ? { l: 60, w: 44, d: 12 } : STAGES[b.stage]
  const short = code === 'C3'
  // Reconstruct initial geometry; old journal positions must never move the briefing's markers.
  const table = createTable({ ...s, stage: b.stage, battles: b.number - 1 }, code, {
    actor: b.attacker,
    dice: () => 1,
    id: () => '',
  })
  return (
    <section className="panel tabletop-mission" id="table-panel">
      <p className="eyebrow">КАРТОЧКА ДЛЯ ИГРЫ ЗА СТОЛОМ</p>
      <h2>{MISSION_CARDS[code]?.title ?? code}</h2>
      <p>
        Поле{' '}
        <strong>
          {size.l} × {size.w} дюймов
        </strong>{' '}
        · глубина зон {size.d}″ · 5 раундов · лимит {b.al}
        {b.type === 'PACT' ? ' / 2 на сторону' : ''} очков.
      </p>
      <p>
        Разыграйте миссию за столом. Запишите итоговые VP, потери и Deeds; затем откройте «Внести
        результат боя» ниже.
      </p>
      <figure className="mission-layout">
        <svg
          viewBox={`-5 -7 ${size.l + 10} ${size.w + 14}`}
          role="img"
          aria-label="Начальная расстановка и координаты объектов миссии"
        >
          <rect width={size.l} height={size.w} fill="#111914" stroke="#a69b77" strokeWidth=".3" />
          <rect
            width={short ? size.d : size.l}
            height={short ? size.w : size.d}
            fill="#786044"
            opacity=".5"
          />
          <rect
            x={short ? size.l - size.d : 0}
            y={short ? 0 : size.w - size.d}
            width={short ? size.d : size.l}
            height={short ? size.w : size.d}
            fill="#4f7761"
            opacity=".5"
          />
          <text x={size.l / 2} y={-3} textAnchor="middle">
            {size.l}″ · x →
          </text>
          {!short && (
            <text x={size.l / 2} y={3} textAnchor="middle">
              {b.type === 'PACT' ? 'Deathwatch' : labels[b.attacker]} · y ≤ {size.d}″
            </text>
          )}
          {!short && (
            <text x={size.l / 2} y={size.w - 2} textAnchor="middle">
              {b.type === 'PACT' ? 'Necrons' : labels[b.defender]} · y ≥ {size.w - size.d}″
            </text>
          )}
          {table.objects.map((o) => (
            <g key={o.id}>
              {o.kind === 'objective' ? (
                <circle cx={o.x} cy={o.y} r="1.2" fill="#cfb777" />
              ) : (
                <rect
                  x={o.x - 1}
                  y={o.y - 1}
                  width="2"
                  height="2"
                  fill={o.kind === 'item' ? '#9badbe' : '#8ca68d'}
                />
              )}
              <text
                x={o.x}
                y={o.y + (['engine', 'overlay', 'index'].includes(o.id) ? 5 : -2)}
                textAnchor="middle"
              >
                {o.id}
              </text>
            </g>
          ))}
        </svg>
        <figcaption>
          Координаты в дюймах от верхнего левого угла (0, 0). Схема показывает начальные позиции;
          перемещения объектов описаны в миссии.
        </figcaption>
      </figure>
      <div className="mission-coordinates">
        <table>
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
                <td>{o.id}</td>
                <td>
                  {o.kind === 'objective'
                    ? 'Objective'
                    : o.kind === 'item'
                      ? 'Предмет'
                      : 'Точка взаимодействия'}
                </td>
                <td>{+o.x.toFixed(2)}</td>
                <td>{+o.y.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        {b.type === 'PACT' ? 'Deathwatch' : `Атакующий: ${labels[b.attacker]}`}, зона{' '}
        {short ? 'x' : 'y'} ≤ {size.d}″.{' '}
        {b.type === 'PACT' ? 'Necrons' : `Защитник: ${labels[b.defender]}`}, зона{' '}
        {short ? 'x' : 'y'} ≥ {(short ? size.l : size.w) - size.d}″. Первый ход определите обычным
        roll-off; атакующий не обязательно ходит первым.
      </p>
      <p>
        Расставьте сопоставимые укрытия, проходы для ваших баз и доступ в 3″ каждого объекта с обеих
        сторон. Objectives — маркеры 40 мм; точки взаимодействия — плоские жетоны. Расстояния от
        точек взаимодействия измеряются от центра. Обычных matched-play secondaries нет, максимум 50
        VP на сторону.
      </p>
      <MissionBrief
        code={code}
        exact={MISSION_CARDS[code]?.body ?? CRISIS_CARDS[b.type] ?? ''}
        expanded
      />
      {b.effects.length > 0 && (
        <>
          <h3>Действующие эффекты кампании</h3>
          {b.effects.map((e, i) => (
            <p key={i}>
              <strong>{EVENTS[e.code]?.name ?? e.code}</strong> — {EVENTS[e.code]?.effect ?? e.code}
            </p>
          ))}
        </>
      )}
    </section>
  )
}
