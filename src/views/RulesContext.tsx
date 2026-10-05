import {
  Component,
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { BookOpen, CircleHelp, X } from 'lucide-react'
import { trapDialogFocus } from '../lib/dialog-focus'
import { ruleTargetLabel, type RuleTarget } from '../content/rule-topics'

const RulesContent = lazy(() => import('./RulesDrawer'))
const RulesContext = createContext<((target: RuleTarget) => void) | null>(null)

class RuleLoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <p role="alert">
        Справка не загрузилась. Обновите страницу или откройте{' '}
        <a href={`${import.meta.env.BASE_URL}rules.pdf`} target="_blank" rel="noreferrer">
          PDF правил ↗
        </a>
        .
      </p>
    ) : (
      this.props.children
    )
  }
}

export function RulesProvider({
  contextKey,
  currentMission,
  children,
}: {
  contextKey: string
  currentMission?: string
  children: ReactNode
}) {
  const [target, setTarget] = useState<RuleTarget>()
  const [heading, setHeading] = useState('Справка по правилам')
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const titleId = useId()
  useEffect(() => {
    setTarget(undefined)
  }, [contextKey])
  useEffect(() => {
    const sheet = dialog.current!
    if (target && !sheet.open) sheet.showModal()
    if (!target && sheet.open) {
      sheet.close()
      if (trigger.current?.isConnected) trigger.current.focus()
    }
  }, [target])
  const close = () => setTarget(undefined)
  return (
    <RulesContext.Provider
      value={(next) => {
        trigger.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null
        setHeading(ruleTargetLabel(next))
        setTarget(next)
      }}
    >
      {children}
      <dialog
        ref={dialog}
        className="rules-drawer"
        aria-labelledby={titleId}
        onCancel={close}
        onClose={close}
        tabIndex={-1}
        onKeyDown={trapDialogFocus}
        onClick={(e) => {
          if (e.target === e.currentTarget) close()
        }}
      >
        <div className="rules-drawer-surface">
          <header className="rules-drawer-header">
            <div>
              <p className="eyebrow">
                <BookOpen size={14} aria-hidden="true" /> ПРАВИЛА · 2.2.1
              </p>
              <h2 id={titleId}>{heading}</h2>
            </div>
            <button
              type="button"
              className="quiet icon-button"
              aria-label="Закрыть справку"
              onClick={close}
              autoFocus
            >
              <X size={20} aria-hidden="true" />
            </button>
          </header>
          <div className="rules-drawer-body">
            {target && (
              <RuleLoadBoundary key={target}>
                <Suspense fallback={<p role="status">Загружаем правила…</p>}>
                  <RulesContent
                    target={target}
                    currentMission={currentMission}
                    onEntryChange={setHeading}
                  />
                </Suspense>
              </RuleLoadBoundary>
            )}
          </div>
          <footer className="rules-drawer-footer">
            <span>Вернитесь к действию · Esc</span>
            <button type="button" className="quiet" onClick={close}>
              Продолжить игру
            </button>
          </footer>
        </div>
      </dialog>
    </RulesContext.Provider>
  )
}

export function RuleHelp({
  topic,
  label,
  text = false,
}: {
  topic: RuleTarget
  label?: string
  text?: boolean
}) {
  const open = useContext(RulesContext)
  if (!open) return null
  const title = label ?? ruleTargetLabel(topic)
  return (
    <button
      type="button"
      className={`quiet rule-help${text ? ' rule-help-text' : ''}`}
      aria-label={`Правила: ${title}`}
      title={`Открыть правила: ${title}`}
      aria-haspopup="dialog"
      onClick={() => open(topic)}
    >
      <CircleHelp size={15} aria-hidden="true" />
      {text && <span>{title}</span>}
    </button>
  )
}
