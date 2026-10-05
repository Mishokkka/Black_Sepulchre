import { Check, AlertTriangle, Circle } from 'lucide-react'
import { musterPreview } from '../../shared/battle-ui'
import type { Pick, State } from '../../shared/model'
import { RuleHelp } from './RulesContext'

export function MusterBudget({
  preview,
  picks,
  s,
  compact = false,
}: {
  preview: ReturnType<typeof musterPreview>
  picks: Pick[]
  s: State
  compact?: boolean
}) {
  const checklist = [
    { label: 'Командир выбран', ok: preview.commanderSelected, target: 'muster-command' },
    ...preview.meters.map((m) => ({
      label: m.label,
      ok: m.value !== null && m.value <= m.limit,
      target: 'muster-budget-bars',
    })),
    {
      label: 'Detachment budget',
      ok: preview.detachmentValue > 0 && preview.detachmentValue <= preview.detachmentLimit,
      target: 'muster-command',
    },
  ]
  return (
    <>
      <div className="muster-total">
        <span>СОСТАВ НА БОЙ</span>
        <strong>
          {preview.total ?? '—'} <small>Effective</small>
        </strong>
        <small>{picks.length} отрядов · Campaign surcharge включён</small>
      </div>
      <div className="muster-budget-bars" id={compact ? undefined : 'muster-budget-bars'}>
        {preview.meters.map((m) => (
          <div
            className={`budget-card ${m.value !== null && m.value > m.limit ? 'over' : ''}`}
            key={m.id}
          >
            <span className="rule-label">
              {m.label}{' '}
              <RuleHelp
                topic={
                  m.id === 'initial' || m.id === 'pool'
                    ? 'garrison'
                    : m.id === 'reserve'
                      ? 'preparation'
                      : 'prices'
                }
                label={m.label}
              />
            </span>
            <strong>
              {m.value ?? '—'} <small>/ {m.limit}</small>
            </strong>
            <progress
              max={Math.max(1, m.limit)}
              value={Math.min(m.value ?? 0, Math.max(1, m.limit))}
              aria-label={m.label}
            />
            <small>
              {m.note}
              {m.value !== null && m.value > m.limit ? ` · превышение ${m.value - m.limit}` : ''}
            </small>
          </div>
        ))}
      </div>
      {preview.costError && <p className="validation">Стоимость недоступна: {preview.costError}</p>}
      {!compact && (
        <>
          <ul className="muster-checklist" aria-label="Проверка состава">
            {checklist.map((row) => (
              <li key={row.label} className={row.ok ? 'ok' : 'pending'}>
                {row.ok ? (
                  <Check size={14} aria-hidden="true" />
                ) : (
                  <Circle size={12} aria-hidden="true" />
                )}
                <a href={`#${row.target}`}>{row.label}</a>
              </li>
            ))}
          </ul>
          {preview.error && (
            <p className="muster-guard">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>
                {preview.error}.{' '}
                <a
                  href={
                    /Warlord|Commander|Detachment/.test(preview.error)
                      ? '#muster-command'
                      : '#muster-units'
                  }
                >
                  Проверить настройки
                </a>
              </span>
            </p>
          )}
          <details className="muster-selected-list">
            <summary>Выбрано {picks.length} отрядов</summary>
            {picks.map((p) => (
              <a key={p.id} href={`#muster-unit-${p.id}`}>
                <span>
                  {s.units.find((u) => u.id === p.id)?.name} · {p.role}
                </span>
                <strong>{preview.costs?.[p.id] ?? '—'}</strong>
              </a>
            ))}
          </details>
        </>
      )}
    </>
  )
}
