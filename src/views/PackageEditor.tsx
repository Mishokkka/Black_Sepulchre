import { useEffect, useState } from 'react'
import { packageEnhancementImpact } from '../../shared/enhancements'
import { Check, Options, type Props } from './common'
import { LogisticsAction } from './LogisticsAction'

export function PackageImpact({ s, side, next }: Pick<Props, 's' | 'side'> & { next: string[] }) {
  const impact = packageEnhancementImpact(s, side, next)
  return (
    <div className="package-impact" aria-live="polite">
      {impact.removed.length ? (
        <>
          <strong>Будут автоматически сняты · refund {impact.points} очков Effective</strong>
          <ul>
            {impact.removed.map((e) => (
              <li key={e.id}>
                {e.name} ·{' '}
                {e.bearers.map((id) => s.units.find((u) => u.id === id)?.name ?? id).join(', ')} · +
                {e.cost * e.bearers.length} очков
              </li>
            ))}
          </ul>
          <p>
            Назначения будут удалены. Очки освободятся для нового состава; Supply за Enhancement не
            списывался. При возвращении detachment улучшения выбираются заново.
          </p>
        </>
      ) : (
        <p>Улучшения сохранённых detachments останутся у своих носителей.</p>
      )}
      <small>Armoury, Relics, Battle Honours и Scars сохраняются.</small>
    </div>
  )
}

export function PackageEditor({ s, side, send, setup = false }: Props & { setup?: boolean }) {
  const key = JSON.stringify(s.players[side].package)
  const [next, setNext] = useState(s.players[side].package)
  useEffect(() => setNext(s.players[side].package), [s.id, side, key])
  const choices = s.snapshot.detachments.filter((d) => !d.side || d.side === side)
  const changed = JSON.stringify(next) !== key
  return (
    <div>
      {setup ? (
        <Options
          label="Стартовый detachment"
          value={next[0] ?? ''}
          change={(id) => setNext(id ? [id] : [])}
          items={choices.map((d) => ({ id: d.id, name: `${d.name} · ${d.dp} DP` }))}
        />
      ) : (
        choices.map((d) => (
          <Check
            key={d.id}
            label={`${d.name} · ${d.dp} DP`}
            value={next.includes(d.id)}
            change={(v) => setNext(v ? [...next, d.id] : next.filter((id) => id !== d.id))}
          />
        ))
      )}
      {changed && (
        <>
          <p className="muted">
            Предварительный выбор. Смена сохранится после нажатия «Применить».
          </p>
          <PackageImpact s={s} side={side} next={next} />
          <LogisticsAction
            s={s}
            side={side}
            send={send}
            type={setup ? 'setup_package' : 'package'}
            payload={{ package: next }}
            label={setup ? 'Применить detachment' : 'Применить Stage Package'}
          />
          <button className="quiet" onClick={() => setNext(s.players[side].package)}>
            Отменить изменения
          </button>
        </>
      )}
    </div>
  )
}
