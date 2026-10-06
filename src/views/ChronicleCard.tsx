import { ArrowRight, BookOpen, ScrollText } from 'lucide-react'
import type { ChronicleGroup } from '../../shared/chronicle'
import {
  chronicleStatus,
  eventTitle,
  missionTitle,
  outcomeTitle,
  resourceChanges,
} from '../../shared/chronicle'
import { historySummary } from '../../shared/history'
import { SIDES } from '../../shared/model'
import { labels } from './common'
import { StatusBadge } from './StatusBadge'
import { BattleEventList } from './BattleJournal'

export function ResourceChanges({ rows }: { rows: ChronicleGroup['rows'] }) {
  const changes = resourceChanges(rows)
  return (
    <div className="chronicle-resources" aria-label="Изменения ресурсов по журналу">
      {changes.map((r) => (
        <div key={r.side} className={r.side}>
          <span>{labels[r.side]}</span>
          {r.known ? (
            <>
              <strong className={r.supply < 0 ? 'negative' : r.supply > 0 ? 'positive' : ''}>
                {r.supply > 0 ? '+' : ''}
                {r.supply} <small>Supply</small>
              </strong>
              <strong className={r.intel < 0 ? 'negative' : r.intel > 0 ? 'positive' : ''}>
                {r.intel > 0 ? '+' : ''}
                {r.intel} <small>Intel</small>
              </strong>
            </>
          ) : (
            <small>Ресурсы не записаны</small>
          )}
        </div>
      ))}
      <small>
        Сумма записанных изменений
        {changes.some((r) => r.partial) ? '; часть старых записей без ресурсов' : ''}.
      </small>
    </div>
  )
}
export function ChronicleCard({
  group: g,
  compact = false,
  onOpen,
}: {
  group: ChronicleGroup
  compact?: boolean
  onOpen: () => void
}) {
  const b = g.battle
  return (
    <article
      className={`chronicle-card${compact ? ' compact' : ''}${b?.report ? ' has-report' : ''}`}
    >
      <div className="section-head">
        <p className="eyebrow">
          {g.number
            ? `БОЙ ${g.number}${b ? ` · ${b.sector === 'X' ? 'ОБЯЗАТЕЛЬНЫЙ КОНТАКТ' : `СЕКТОР ${b.sector}`}` : ''}`
            : 'МЕЖДУ БОЯМИ'}
        </p>
        <StatusBadge tone={b?.aftermathApplied ? 'ready' : 'info'}>
          {chronicleStatus(g)}
        </StatusBadge>
      </div>
      <h3>{b ? missionTitle(b) : g.number ? `Бой ${g.number}` : 'Начало летописи'}</h3>
      {b?.report ? (
        <>
          <p className="chronicle-outcome">
            {outcomeTitle(b.outcome)}
            {!b.aftermathApplied && <small> · предварительный итог</small>}
          </p>
          <div
            className="chronicle-score"
            aria-label={`Deathwatch ${b.report.vp.deathwatch} VP, Necrons ${b.report.vp.necrons} VP`}
          >
            {SIDES.map((who) => (
              <div className={who} key={who}>
                <span>{labels[who]}</span>
                <strong>
                  {b.report!.vp[who]} <small>VP</small>
                </strong>
              </div>
            ))}
          </div>
          <div className="chronicle-casualties">
            {SIDES.map((who) => {
              const destroyed = b.report!.units.filter(
                (r) => r.destroyed && b.before.some((u) => u.id === r.id && u.side === who),
              )
              return (
                <p key={who}>
                  <span>
                    {labels[who]} · уничтожено {destroyed.length}
                  </span>
                  {destroyed.length > 0 && (
                    <small>
                      {destroyed
                        .map((r) => b.before.find((u) => u.id === r.id)?.name ?? r.id)
                        .join(' · ')}
                    </small>
                  )}
                </p>
              )
            })}
          </div>
        </>
      ) : (
        <p className="muted">
          {b
            ? 'Счёт и потери появятся после отправки отчёта.'
            : `${g.rows.length} записей кампании.`}
        </p>
      )}
      {b?.event && (
        <p className="chronicle-event">
          <ScrollText size={16} aria-hidden="true" />
          <span>D66 · {eventTitle(b.event)}</span>
        </p>
      )}
      <ResourceChanges rows={g.rows} />
      {!compact && (
        <details className="chronicle-details">
          <summary>
            <BookOpen size={16} aria-hidden="true" /> Подробности летописи
          </summary>
          {b?.report?.narrative && <p className="chronicle-narrative">{b.report.narrative}</p>}
          {b?.report?.units
            .filter((r) => r.deed || r.distinguished)
            .map((r) => (
              <p key={r.id}>
                {b.before.find((u) => u.id === r.id)?.name ?? r.id} ·{' '}
                {[r.deed, r.distinguished && 'Distinguished'].filter(Boolean).join(' · ')}
              </p>
            ))}
          {b?.ending && <p>Судьба планеты: {b.ending}</p>}
          {!!b?.journal?.length && (
            <details className="battle-journal">
              <summary>События стола и источники VP · {b.journal.length}</summary>
              <BattleEventList events={b.journal} />
            </details>
          )}
          {b?.report && (
            <p className="muted">
              Уничтоженные ID — факты боя; окончательный статус отряда определяется Casualty и
              последствиями.
            </p>
          )}
          <ul className="chronicle-highlights">
            {g.rows
              .filter((l) => !l.command.startsWith('table_'))
              .slice(-4)
              .reverse()
              .map((l) => (
                <li key={l.version}>{historySummary(l)}</li>
              ))}
          </ul>
        </details>
      )}
      <button className="quiet chronicle-open" onClick={onOpen}>
        {compact ? 'Открыть историю боя' : 'Подробный журнал'}{' '}
        <ArrowRight size={15} aria-hidden="true" />
      </button>
    </article>
  )
}
