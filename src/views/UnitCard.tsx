import { ChevronDown, Flag, Shield, ShieldAlert, Star, UserRound, Users } from 'lucide-react'
import type { State, Unit } from '../../shared/model'
import { available, entry, present } from '../../shared/rules'
import { availabilityReasons, unitAttention } from '../../shared/roster'
import { StatusBadge } from './StatusBadge'
import { HONOURS, SCARS } from '../../shared/rules.generated'
import { RuleHelp } from './RulesContext'
export function UnitCard({
  s,
  u,
  expanded,
  onToggle,
  children,
}: {
  s: State
  u: Unit
  expanded: boolean
  onToggle: (open: boolean) => void
  children: React.ReactNode
}) {
  const cat = entry(s, u),
    usable = available(s, u),
    issues = unitAttention(s, u),
    threshold = [3, 7, 12, 18].find((n) => n > u.xp),
    Icon = cat.character ? UserRound : cat.keywords.includes('BATTLELINE') ? Users : Shield
  return (
    <details
      id={`unit-${u.id}`}
      className={`roster-unit${expanded ? ' expanded-unit' : ''}`}
      data-side={u.side}
      open={expanded}
      onToggle={(e) => onToggle(e.currentTarget.open)}
    >
      <summary aria-label={`Отряд ${u.name}`}>
        <div className="unit-identity">
          <span className="unit-emblem">
            <Icon size={20} aria-hidden="true" />
          </span>
          <div>
            <strong>{u.name}</strong>
            <small>
              {cat.datasheet}
              {cat.models ? ` · моделей: ${cat.models}` : ''}
            </small>
            <span className="unit-location">
              <Flag size={12} aria-hidden="true" />
              {u.location === 'garrison'
                ? 'Гарнизон'
                : u.location === 'stf'
                  ? 'STF'
                  : 'Main Force'}{' '}
              · сектор {present(s, u) ?? '—'}
            </span>
          </div>
        </div>
        <div className="unit-price">
          <strong>{u.rc}</strong>
          <span>RC</span>
          <ChevronDown size={15} aria-hidden="true" />
        </div>
        <div className="unit-state">
          <StatusBadge tone={!usable ? 'danger' : u.damage ? 'warning' : 'ready'}>
            {!usable ? 'Недоступен' : u.damage ? 'Доступен · повреждён' : 'Готов'}
          </StatusBadge>
          <span className={`unit-damage d${u.damage}`}>
            <ShieldAlert size={13} aria-hidden="true" />
            Damage {u.damage}/3{' '}
            <span className="damage-steps" aria-hidden="true">
              {[0, 1, 2, 3].map((n) => (
                <i key={n} className={u.damage === n ? 'current' : ''}>
                  {n}
                </i>
              ))}
            </span>
          </span>
          <span className="unit-xp">
            <Star size={12} aria-hidden="true" />
            {u.xp} XP
            <progress
              value={Math.min(u.xp, threshold ?? 18)}
              max={threshold ?? 18}
              aria-label={`XP ${u.name}`}
            />
            {threshold ? <small>порог {threshold}</small> : <small>18+</small>}
          </span>
        </div>
        {(u.honours.length > 0 ||
          u.scars.length > 0 ||
          issues.some((i) => !['damage', 'unavailable'].includes(i.key))) && (
          <div className="unit-decorations">
            {u.honours.map((id) => (
              <span key={id}>★ {HONOURS.find((h) => h.id === id)?.name ?? id}</span>
            ))}
            {u.scars.map((sc) => (
              <span key={sc.id} className="scar-chip">
                Scar · {SCARS[u.side].find((v) => v.id === sc.id)?.name ?? sc.id}
              </span>
            ))}
            {issues
              .filter((i) => !['damage', 'unavailable'].includes(i.key))
              .map((i) => (
                <StatusBadge key={i.key} tone={i.tone}>
                  {i.label}
                </StatusBadge>
              ))}
          </div>
        )}
      </summary>
      {expanded && (
        <div className="unit-expanded">
          <div className="unit-rule-links" aria-label={`Правила отряда ${u.name}`}>
            <RuleHelp topic="recovery" text />
            <RuleHelp topic="honours" text />
            <RuleHelp topic={u.side === 'deathwatch' ? 'scarsDeathwatch' : 'scarsNecrons'} text />
            {!!u.flags.commission && <RuleHelp topic="local" label="Local Commission" text />}
          </div>
          {!usable && (
            <p className="unit-unavailable-reason">{availabilityReasons(s, u).join(' · ')}</p>
          )}
          {children}
        </div>
      )}
    </details>
  )
}
