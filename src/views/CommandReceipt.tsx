import { CheckCircle2, ArrowRight, X } from 'lucide-react'
import type { CommandReceipt as Receipt } from '../lib/command-receipt'

export function CommandReceipt({
  receipt,
  close,
  history,
}: {
  receipt: Receipt
  close: () => void
  history: () => void
}) {
  return (
    <section className="command-receipt" aria-label="Подтверждение решения">
      <CheckCircle2 size={21} aria-hidden="true" />
      <div className="receipt-copy" role="status" aria-atomic="true">
        <small>
          СОХРАНЕНО ·{' '}
          {new Date(receipt.at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
        </small>
        <strong>{receipt.summary}</strong>
        {receipt.changes.length > 0 && (
          <div className="receipt-changes">
            {receipt.changes.map((change) => (
              <span key={change.label}>
                {change.label} <b>{change.from}</b> <ArrowRight size={12} aria-hidden="true" />
                <b>{change.to}</b>
              </span>
            ))}
          </div>
        )}
      </div>
      <button className="quiet" onClick={history}>
        В журнал <ArrowRight size={15} aria-hidden="true" />
      </button>
      <button className="quiet icon-button" aria-label="Закрыть подтверждение" onClick={close}>
        <X size={18} aria-hidden="true" />
      </button>
    </section>
  )
}
