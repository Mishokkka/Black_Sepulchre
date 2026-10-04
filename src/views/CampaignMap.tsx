import { useState } from 'react'
import { ADJACENCY, home, SECTORS, STAGES, supplied } from '../../shared/rules'
import type { SectorKey, Side, State } from '../../shared/model'
import { labels } from './common'
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
export function CampaignMap({ s, side }: { s: State; side: Side }) {
  const [selected, setSelected] = useState<SectorKey>('G'),
    a = s.sectors[selected]
  return (
    <section className="panel map-layout">
      <div>
        <p className="eyebrow">СТРАТЕГИЧЕСКАЯ КАРТА</p>
        <svg
          className="map-svg"
          viewBox="0 0 100 110"
          role="img"
          aria-label="Карта Kharon Secundus"
        >
          {Object.entries(ADJACENCY).flatMap(([a, bs]) =>
            bs
              .filter((b) => a < b)
              .map((b) => (
                <line
                  key={a + b}
                  x1={nodes[a as SectorKey][0]}
                  y1={nodes[a as SectorKey][1]}
                  x2={nodes[b][0]}
                  y2={nodes[b][1]}
                />
              )),
          )}
          {Object.entries(nodes).map(([k, [x, y]]) => (
            <g
              key={k}
              className={`node ${s.sectors[k as SectorKey].owner ?? 'neutral'}`}
              onClick={() => setSelected(k as SectorKey)}
              role="button"
              tabIndex={0}
              aria-label={`Сектор ${k}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setSelected(k as SectorKey)
              }}
            >
              <circle cx={x} cy={y} r={selected === k ? 6 : 5} />
              <text x={x} y={y + 1.6}>
                {k}
              </text>
              {Object.entries(s.players)
                .filter(([, p]) => p.mf === k)
                .map(([side], i) => (
                  <circle
                    key={side}
                    className={'force-dot ' + side}
                    cx={x + 5 + i * 3}
                    cy={y - 5}
                    r="1.8"
                  />
                ))}
            </g>
          ))}
        </svg>
      </div>
      <div className="sector-detail">
        <p className="eyebrow">
          {selected} ·{' '}
          {SECTORS[selected].home ? 'Home' : SECTORS[selected].node ? 'Узел' : 'Обычный сектор'}
        </p>
        <h2>{SECTORS[selected].name}</h2>
        <dl>
          <dt>Владелец</dt>
          <dd>{a.owner ? labels[a.owner] : 'Нейтральный'}</dd>
          <dt>Снабжение</dt>
          <dd>{a.owner && supplied(s, a.owner, selected) ? 'Supplied' : 'Unsupplied'}</dd>
          <dt>Local Supply</dt>
          <dd>
            {a.local} / {Math.ceil((STAGES[s.stage].al * 0.25) / 5) * 5}
          </dd>
          <dt>Состояния</dt>
          <dd>
            {[
              a.fortified && 'Fortified',
              a.ruined && 'Ruined',
              a.exhausted && `Exhausted ${a.exhausted}`,
              a.sabotaged && 'Sabotaged',
              a.disrupted && 'Disrupted',
              a.contested && 'Contested',
              a.relayUntil && 'Relay Disruption',
            ]
              .filter(Boolean)
              .join(', ') || 'Нормальное'}
          </dd>
          <dt>Связи</dt>
          <dd>{ADJACENCY[selected].join(' · ')}</dd>
        </dl>
        <p className="muted">
          Ваш Main Force: {s.players[side].mf}. Снабжение проходит только по своим секторам до{' '}
          {home(side)}.
        </p>
        {s.units
          .filter(
            (u) => u.sector === selected && u.location === 'garrison' && u.status === 'active',
          )
          .map((u) => (
            <p key={u.id}>
              {u.name} · {u.rc} RC · Damage {u.damage}
            </p>
          ))}
      </div>
    </section>
  )
}
