import { useState } from 'react'
import { Castle, Flag, Shield, Zap } from 'lucide-react'
import { ADJACENCY, home, SECTORS, STAGES, supplied } from '../../shared/rules'
import type { SectorKey, Side, State } from '../../shared/model'
import type { StrategyPreview } from '../../shared/strategy-preview'
import { labels } from './common'
import { RuleHelp } from './RulesContext'

const nodes: Record<SectorKey, [number, number]> = {
  A: [50, 8],
  B: [27, 25],
  C: [73, 25],
  D: [17, 43],
  E: [83, 43],
  F: [28, 65],
  G: [50, 50],
  H: [72, 65],
  I: [27, 83],
  J: [73, 83],
  K: [50, 98],
}
const states = (s: State, key: SectorKey) => {
  const a = s.sectors[key]
  return [
    a.fortified && 'Fortified',
    a.ruined && 'Ruined',
    a.exhausted && `Exhausted ${a.exhausted}`,
    a.sabotaged && 'Sabotaged',
    a.disrupted && 'Disrupted',
    a.contested && 'Contested',
    a.relayUntil && 'Relay Disruption',
  ].filter(Boolean) as string[]
}

export function CampaignMap({
  s,
  side,
  selected: controlled,
  onSelect,
  strategy,
  compact = false,
  initialSelected = 'G',
}: {
  s: State
  side: Side
  selected?: SectorKey
  onSelect?: (key: SectorKey) => void
  strategy?: { origin: SectorKey; method: string; routes: Record<SectorKey, StrategyPreview> }
  compact?: boolean
  initialSelected?: SectorKey
}) {
  const [local, setLocal] = useState<SectorKey>(initialSelected),
    [hover, setHover] = useState<SectorKey | null>(null)
  const selected = controlled ?? local,
    a = s.sectors[selected],
    relevant = hover ?? selected
  const choose = (key: SectorKey) => {
    setLocal(key)
    onSelect?.(key)
  }
  const localCap = Math.ceil((STAGES[s.stage].al * 0.25) / 5) * 5
  const forces = Object.entries(s.players).flatMap(([who, p]) => [
    ...(p.mf === selected ? [{ side: who as Side, type: 'Main Force', icon: Flag }] : []),
    ...(p.stf === selected ? [{ side: who as Side, type: 'STF', icon: Zap }] : []),
  ])
  return (
    <section className={`panel map-layout campaign-map${strategy ? ' strategy-map' : ''}`}>
      <div className="map-canvas">
        <div className="section-head">
          <p className="eyebrow">СТРАТЕГИЧЕСКАЯ КАРТА</p>
          <small>Выберите сектор</small>
        </div>
        <svg
          className="map-svg"
          viewBox="0 -3 100 119"
          role="group"
          aria-label="Карта Kharon Secundus"
        >
          {Object.entries(ADJACENCY).flatMap(([from, links]) =>
            links
              .filter((to) => from < to)
              .map((to) => {
                const destination =
                  strategy?.origin === from
                    ? to
                    : strategy?.origin === to
                      ? (from as SectorKey)
                      : null
                const legal =
                  destination &&
                  strategy?.routes[destination].allowed &&
                  strategy.method === 'normal'
                return (
                  <line
                    key={from + to}
                    x1={nodes[from as SectorKey][0]}
                    y1={nodes[from as SectorKey][1]}
                    x2={nodes[to][0]}
                    y2={nodes[to][1]}
                    className={`map-link${legal ? ' route-legal' : ''}${from === relevant || to === relevant ? ' adjacent-link' : ''}${strategy && !legal ? ' route-muted' : ''}`}
                  />
                )
              }),
          )}
          {strategy &&
            strategy.method !== 'normal' &&
            (Object.keys(nodes) as SectorKey[])
              .filter((key) => strategy.routes[key].allowed)
              .map((key) => {
                const [x, y] = nodes[strategy.origin],
                  [tx, ty] = nodes[key]
                return (
                  <path
                    key={key}
                    className={`special-route${selected === key ? ' selected-route' : ''}`}
                    d={`M ${x} ${y} Q ${(x + tx) / 2 + 8} ${(y + ty) / 2 - 5} ${tx} ${ty}`}
                  />
                )
              })}
          {Object.entries(nodes).map(([raw, [x, y]]) => {
            const key = raw as SectorKey,
              sector = s.sectors[key],
              status = states(s, key),
              route = strategy?.routes[key],
              origin = strategy?.origin === key
            const markers = Object.entries(s.players).flatMap(([who, p]) => [
              ...(p.mf === key ? [{ side: who, type: 'MF' }] : []),
              ...(p.stf === key ? [{ side: who, type: 'STF' }] : []),
            ])
            const garrison = s.units.filter(
              (u) => u.status === 'active' && u.location === 'garrison' && u.sector === key,
            ).length
            const description = `${SECTORS[key].name}. Владелец: ${sector.owner ? labels[sector.owner] : 'нейтральный'}. ${status.join(', ') || 'Нормальное состояние'}. ${markers.map((m) => `${labels[m.side as Side]} ${m.type}`).join(', ')}${garrison ? `. Гарнизон: ${garrison}` : ''}${route ? `. ${origin ? 'Текущий сектор Force' : route.allowed ? 'Маршрут доступен' : route.reason}` : ''}`
            return (
              <g
                key={key}
                className={`node ${sector.owner ?? 'neutral'}${selected === key ? ' selected-node' : ''}${origin ? ' origin-node' : ''}${route && !origin ? (route.allowed ? ' reachable-node' : ' unavailable-node') : ''}`}
                onClick={() => choose(key)}
                onMouseEnter={() => setHover(key)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(key)}
                onBlur={() => setHover(null)}
                role="button"
                tabIndex={0}
                aria-label={`Сектор ${key}`}
                aria-description={description}
                aria-pressed={selected === key}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    choose(key)
                  }
                }}
              >
                <title>{description}</title>
                <circle className="node-hit-area" cx={x} cy={y} r="9.5" />
                {selected === key && <circle className="selection-ring" cx={x} cy={y} r="7.5" />}
                <circle className="sector-ring" cx={x} cy={y} r="5.7" />
                <text className="sector-key" x={x} y={y + 1.5}>
                  {key}
                </text>
                <text className="owner-label" x={x} y={y + 10}>
                  {sector.owner === 'deathwatch' ? 'DW' : sector.owner === 'necrons' ? 'NCR' : '—'}
                </text>
                {markers.map((m, i) =>
                  m.type === 'MF' ? (
                    <circle
                      key={`${m.side}-mf`}
                      className={`force-dot ${m.side}`}
                      cx={x + 5 + i * 3}
                      cy={y - 6}
                      r="1.8"
                    />
                  ) : (
                    <path
                      key={`${m.side}-stf`}
                      className={`force-dot ${m.side}`}
                      d={`M ${x + 5 + i * 3} ${y - 8} l 2 2 l -2 2 l -2 -2 Z`}
                    />
                  ),
                )}
                {sector.fortified && (
                  <path
                    className="fortified-glyph"
                    d={`M ${x - 7} ${y - 7} h 3 v 2 l -1.5 1.5 l -1.5 -1.5 Z`}
                  />
                )}
                {sector.ruined && !sector.fortified && (
                  <text className="ruined-glyph" x={x - 7} y={y - 5}>
                    R
                  </text>
                )}
                {status.some((value) => !['Fortified', 'Ruined'].includes(value)) && (
                  <text className="condition-glyph" x={x + 7} y={y + 6}>
                    !
                  </text>
                )}
                {garrison > 0 && (
                  <text className="garrison-glyph" x={x - 7} y={y + 6}>
                    {garrison}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
        <div className="map-legend">
          <span>DW · Deathwatch</span>
          <span>NCR · Necrons</span>
          <span>● Main Force</span>
          <span>◆ STF</span>
          <span>
            <Shield size={12} aria-hidden="true" /> Fortified
          </span>
          <span>! Состояние</span>
          <span>R · Ruined</span>
          <span>Число · гарнизон</span>
        </div>
        {strategy && (
          <div className="route-legend">
            <span>
              <i className="legend-legal" />
              Доступный маршрут
            </span>
            <span>
              <i className="legend-muted" />
              Недоступный
            </span>
            {strategy.method !== 'normal' && (
              <span>
                <i className="legend-special" />
                Специальный маршрут
              </span>
            )}
          </div>
        )}
      </div>
      <details
        className={`sector-inspector${compact ? ' compact-inspector' : ''}`}
        open={compact ? undefined : true}
      >
        <summary>
          <span>
            {selected} · {SECTORS[selected].name}
          </span>
          <small>{a.owner ? labels[a.owner] : 'Нейтральный'} · раскрыть сектор</small>
        </summary>
        <div className="sector-detail" aria-label="Выбранный сектор">
          <p className="eyebrow">
            {selected} ·{' '}
            {SECTORS[selected].home ? 'Home' : SECTORS[selected].node ? 'Узел' : 'Обычный сектор'}
          </p>
          <h2>{SECTORS[selected].name}</h2>
          <span className={`sector-owner ${a.owner ?? 'neutral'}`}>
            {a.owner ? labels[a.owner] : 'Нейтральный'}
          </span>
          <dl>
            <dt className="rule-label">
              Снабжение <RuleHelp topic="supply" />
            </dt>
            <dd>{a.owner && supplied(s, a.owner, selected) ? 'Supplied' : 'Unsupplied'}</dd>
            <dt className="rule-label">
              Local Supply <RuleHelp topic="local" />
            </dt>
            <dd>
              {a.local} / {localCap}
            </dd>
            <dt>Связи</dt>
            <dd>{ADJACENCY[selected].join(' · ')}</dd>
          </dl>
          <div className="sector-states">
            {states(s, selected).length ? (
              states(s, selected).map((value) => <span key={value}>{value}</span>)
            ) : (
              <span className="muted">Нормальное состояние</span>
            )}
          </div>
          <div className="sector-forces">
            <h3>Силы в секторе</h3>
            {forces.map(({ side: who, type, icon: Icon }) => (
              <p key={`${who}-${type}`} className={who}>
                <Icon size={14} aria-hidden="true" />
                {labels[who]} · {type}
              </p>
            ))}
            {(['deathwatch', 'necrons'] as Side[]).map((who) => {
              const units = s.units.filter(
                (u) =>
                  u.side === who &&
                  u.sector === selected &&
                  u.location === 'garrison' &&
                  u.status === 'active',
              )
              return (
                units.length > 0 && (
                  <details key={who}>
                    <summary>
                      <Castle size={14} aria-hidden="true" />
                      {labels[who]} · гарнизон {units.length} ·{' '}
                      {units.reduce((sum, u) => sum + u.rc, 0)} RC
                    </summary>
                    {units.map((u) => (
                      <p key={u.id}>
                        {u.name} · {u.rc} RC · Damage {u.damage}
                      </p>
                    ))}
                  </details>
                )
              )
            })}
            {!forces.length &&
              !s.units.some(
                (u) => u.status === 'active' && u.location === 'garrison' && u.sector === selected,
              ) && <small>Силы отсутствуют.</small>}
          </div>
          <small className="supply-note">
            Ваша линия снабжения проходит по своим секторам до {home(side)}.
          </small>
        </div>
      </details>
    </section>
  )
}
