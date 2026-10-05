import { useState } from 'react'
import { SIDES } from '../../shared/model'
import { labels, type Props } from './common'
import { ReportView } from './ReportView'
import { ConfirmDialog } from './ConfirmDialog'
import { StatusBadge } from './StatusBadge'

export function ResultCorrection({ s, side, send }: Props) {
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const proposal = s.correctionProposal
  if (proposal)
    return (
      <section className="panel result-correction" id="correction-panel">
        <p className="eyebrow">СОГЛАСОВАНИЕ РЕВИЗИИ</p>
        <h2>Предложена коррекция последнего результата</h2>
        <p>
          Зависимые действия приостановлены. После общего согласия они будут отменены, а последствия
          боя пересчитаны из прежнего состояния. Сохранённые броски не меняются.
        </p>
        <div className="correction-sides">
          {SIDES.map((who) => (
            <div key={who}>
              <small>{labels[who]}</small>
              <strong>
                {proposal.report.vp[who]} <span>VP</span>
              </strong>
              <StatusBadge tone={proposal.approved.includes(who) ? 'ready' : 'warning'}>
                {proposal.approved.includes(who) ? 'Согласовано' : 'Ожидает решения'}
              </StatusBadge>
            </div>
          ))}
        </div>
        {proposal.report.narrative && <blockquote>{proposal.report.narrative}</blockquote>}
        <details>
          <summary>Участие, потери и Deeds в новой ревизии</summary>
          {proposal.report.units.map((r) => (
            <p key={r.id}>
              {s.units.find((u) => u.id === r.id)?.name ?? r.id}:{' '}
              {r.entered ? 'участвовал' : 'не вошёл'}
              {r.destroyed ? ' · уничтожен' : ''}
              {r.deed ? ` · ${r.deed}` : ''}
            </p>
          ))}
        </details>
        <div className="buttons">
          <button
            className="primary"
            disabled={proposal.approved.includes(side)}
            onClick={() => setConfirm(true)}
          >
            Проверить откат и новую ревизию
          </button>
          <button className="quiet" onClick={() => send('cancel_correction')}>
            Отклонить коррекцию
          </button>
        </div>
        {proposal.approved.includes(side) && (
          <p className="muted">Ваше согласие сохранено. Ожидается второй командир.</p>
        )}
        <ConfirmDialog
          open={confirm}
          onClose={() => setConfirm(false)}
          title="Согласовать откат и новую ревизию?"
          confirm="Согласовать откат и новую ревизию"
          disabled={proposal.approved.includes(side)}
          onConfirm={async () => {
            const ok = await send('approve_correction')
            if (ok !== false) setEditing(false)
            return ok
          }}
        >
          <p>
            VP Deathwatch {proposal.report.vp.deathwatch} : Necrons {proposal.report.vp.necrons}.
          </p>
          <p>
            Все решения, зависящие от прежнего результата, будут отменены. Движок пересчитает доход,
            потери и награды по сохранённым броскам после согласия обоих игроков.
          </p>
        </ConfirmDialog>
      </section>
    )
  if (!s.flags.correctionAvailable) return null
  return (
    <details className="panel result-correction">
      <summary>Исправить последний результат</summary>
      <p className="muted">
        Новая ревизия требует согласия обоих командиров и откатывает зависимые решения.
      </p>
      <button className="quiet" onClick={() => setEditing(!editing)}>
        {editing ? 'Закрыть редактор' : 'Подготовить новую ревизию'}
      </button>
      {editing && <ReportView s={s} side={side} send={send} correction />}
    </details>
  )
}
