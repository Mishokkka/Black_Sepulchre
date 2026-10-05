import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ShieldCheck } from 'lucide-react'
import { trapDialogFocus } from '../lib/dialog-focus'

export function ConfirmDialog({
  open,
  onClose,
  title,
  confirm,
  children,
  onConfirm,
  disabled = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  confirm: string
  children: ReactNode
  onConfirm: () => Promise<void | boolean>
  disabled?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const inFlight = useRef(false)
  const titleId = useId()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  useEffect(() => {
    const dialog = ref.current!
    if (open) setProblem('')
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])
  // Keep dismissal available when an uncertain request disables the campaign workspace.
  return createPortal(
    <dialog
      ref={ref}
      className="logistics-confirm command-confirm"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={trapDialogFocus}
      onCancel={(e) => {
        if (busy) e.preventDefault()
        else onClose()
      }}
      onClose={onClose}
    >
      <p className="eyebrow">ПРОВЕРКА ПЕРЕД ПОДТВЕРЖДЕНИЕМ</p>
      <h2 id={titleId}>{title}</h2>
      {children}
      {problem && (
        <p className="validation" role="alert">
          {problem}
        </p>
      )}
      <div className="buttons">
        <button className="quiet" onClick={onClose} disabled={busy} autoFocus>
          Вернуться
        </button>
        <button
          className="primary"
          disabled={disabled || busy}
          onClick={async () => {
            if (inFlight.current) return
            inFlight.current = true
            setBusy(true)
            try {
              if ((await onConfirm()) !== false) onClose()
              else
                setProblem(
                  'Не удалось подтвердить отправку. Вернитесь к экрану и проверьте сообщение кампании перед повторной командой.',
                )
            } catch (e) {
              setProblem(e instanceof Error ? e.message : 'Не удалось подтвердить отправку.')
            } finally {
              inFlight.current = false
              setBusy(false)
            }
          }}
        >
          <ShieldCheck size={16} aria-hidden="true" />
          {busy ? 'Сохраняется…' : confirm}
        </button>
      </div>
    </dialog>,
    document.body,
  )
}
