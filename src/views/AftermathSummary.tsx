import { ArrowRight } from 'lucide-react'
import { SIDES, type State } from '../../shared/model'
import { aftermathUnitChanges } from '../../shared/battle-ui'
import { HONOURS } from '../../shared/rules.generated'
import { labels, phases } from './common'
import { StatusBadge } from './StatusBadge'

export function AftermathSummary({
  s,
  preview,
}: {
  s: State
  preview: Pick<State, 'players' | 'units' | 'phase'>
}) {
  const changed = aftermathUnitChanges(s, preview.units)
  const status: Record<string, string> = {
    active: 'В строю',
    displaced: 'Перемещён',
    lost: 'Потерян',
    archived: 'В архиве',
    sealed: 'Запечатан',
  }
  return (
    <div className="aftermath-summary">
      <p className="eyebrow">СОХРАНЁННЫЙ РАСЧЁТ</p>
      <h3>Что изменится после подтверждения</h3>
      <div className="result-sides">
        {SIDES.map((who) => (
          <div className="result-side" key={who} data-side={who}>
            <h4>{labels[who]}</h4>
            <dl className="aftermath-resources">
              {(['supply', 'intel', 'recovery', 'debt', 'integrity', 'fragments'] as const)
                .filter(
                  (key) =>
                    ['supply', 'intel', 'recovery'].includes(key) ||
                    s.players[who][key] !== preview.players[who][key],
                )
                .map((key) => (
                  <div key={key}>
                    <dt>
                      {
                        {
                          supply: 'Supply',
                          intel: 'Intel',
                          recovery: 'Recovery',
                          debt: 'Долг',
                          integrity: 'Home Integrity',
                          fragments: 'Fragments',
                        }[key]
                      }
                    </dt>
                    <dd>
                      <span>{s.players[who][key]}</span>
                      <ArrowRight size={13} aria-hidden="true" />
                      <strong>{preview.players[who][key]}</strong>
                      <small
                        className={
                          preview.players[who][key] < s.players[who][key] ? 'negative' : 'positive'
                        }
                      >
                        {preview.players[who][key] === s.players[who][key]
                          ? 'без изменения'
                          : `${preview.players[who][key] > s.players[who][key] ? '+' : ''}${preview.players[who][key] - s.players[who][key]}`}
                      </small>
                    </dd>
                  </div>
                ))}
            </dl>
            <p className="muted">
              Main Force: {s.players[who].mf} → {preview.players[who].mf}
            </p>
          </div>
        ))}
      </div>
      <h4>Изменения отрядов · {changed.length}</h4>
      <div className="aftermath-units">
        {changed.map(({ before, next }) => (
          <article key={next.id} data-side={next.side}>
            <div className="section-head">
              <strong>{next.name}</strong>
              <StatusBadge
                tone={
                  ['lost', 'archived', 'sealed'].includes(next.status)
                    ? 'danger'
                    : next.damage > (before?.damage ?? 0)
                      ? 'warning'
                      : 'ready'
                }
              >
                {status[next.status] ?? next.status}
              </StatusBadge>
            </div>
            <div className="aftermath-unit-values">
              <span>
                XP{' '}
                <b>
                  {before?.xp ?? '—'} → {next.xp}
                </b>
              </span>
              <span>
                Damage{' '}
                <b>
                  {before?.damage ?? '—'} → {next.damage}
                </b>
              </span>
              <span>
                Scars{' '}
                <b>
                  {before?.scars.map((sc) => sc.id).join(', ') || '—'} →{' '}
                  {next.scars.map((sc) => sc.id).join(', ') || '—'}
                </b>
              </span>
              {next.evacDebt !== before?.evacDebt && (
                <span>
                  Evacuation{' '}
                  <b>
                    {before?.evacDebt ?? 0} → {next.evacDebt}
                  </b>
                </span>
              )}
              {JSON.stringify(before?.honours) !== JSON.stringify(next.honours) && (
                <span>
                  Honours{' '}
                  <b>
                    {before?.honours
                      .map((id) => HONOURS.find((h) => h.id === id)?.name ?? id)
                      .join(', ') || '—'}{' '}
                    →{' '}
                    {next.honours
                      .map((id) => HONOURS.find((h) => h.id === id)?.name ?? id)
                      .join(', ') || '—'}
                  </b>
                </span>
              )}
              {next.flags.pendingHonours && <span>Предстоит выбрать Honour</span>}
            </div>
          </article>
        ))}
      </div>
      {!changed.length && <p className="muted">Состояние отрядов не меняется.</p>}
      <p>
        Следующий этап: <strong>{phases[preview.phase] ?? preview.phase}</strong>. Расчёт уже
        сохранён; повторного броска при подтверждении нет.
      </p>
    </div>
  )
}
