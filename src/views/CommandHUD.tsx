import { useEffect, useRef, useState } from 'react'
import {
  Check,
  Coins,
  Copy,
  Eye,
  Gauge,
  Radio,
  RefreshCw,
  Swords,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { Side, State } from '../../shared/model'
import { STAGES } from '../../shared/rules'
import type { SyncState } from '../lib/sync'
import { labels, phases } from './common'
import { SyncStatus } from './SyncStatus'
import { RuleHelp } from './RulesContext'
import type { RuleTopic } from '../content/rule-topics'

function Metric({
  label,
  value,
  suffix,
  description,
  icon: Icon,
  track = false,
  warning = false,
  rule,
}: {
  label: string
  value: number
  suffix?: string
  description: string
  icon: LucideIcon
  track?: boolean
  warning?: boolean
  rule?: RuleTopic
}) {
  const previous = useRef(value)
  const [delta, setDelta] = useState(0)
  useEffect(() => {
    const change = value - previous.current
    previous.current = value
    if (!track || !change) return
    setDelta(change)
    const timer = window.setTimeout(() => setDelta(0), 3000)
    return () => window.clearTimeout(timer)
  }, [value, track])
  return (
    <div
      className={`metric${delta ? ' metric-changed' : ''}${warning ? ' metric-warning' : ''}`}
      title={rule ? undefined : description}
      tabIndex={rule ? -1 : 0}
      aria-label={`${label}: ${value}${suffix ? ` ${suffix}` : ''}. ${description}`}
    >
      <dt>
        <Icon size={14} aria-hidden="true" />
        {label}
        {rule && <RuleHelp topic={rule} label={label} />}
      </dt>
      <dd>
        <strong>{value}</strong>
        {suffix && <span className="metric-suffix">{suffix}</span>}
        {delta !== 0 && (
          <span
            className={`metric-delta ${delta > 0 ? 'gain' : 'loss'}`}
            aria-label={`Изменение ${label}: ${delta > 0 ? '+' : ''}${delta}`}
          >
            {delta > 0 ? '+' : '−'}
            {Math.abs(delta)}
          </span>
        )}
      </dd>
      <span className="metric-help">{description}</span>
    </div>
  )
}

export function CommandHUD({
  s,
  side,
  sync,
  pending = false,
  busy = false,
  invite = '',
  refresh,
}: {
  s: State
  side: Side
  sync?: SyncState
  pending?: boolean
  busy?: boolean
  invite?: string
  refresh?: () => void
}) {
  const p = s.players[side]
  const [copyStatus, setCopyStatus] = useState('')
  useEffect(() => {
    setCopyStatus('')
  }, [s.id, side, invite])
  useEffect(() => {
    if (!copyStatus) return
    const timer = window.setTimeout(() => setCopyStatus(''), 3000)
    return () => window.clearTimeout(timer)
  }, [copyStatus])
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(invite)
      setCopyStatus('Код скопирован')
    } catch {
      setCopyStatus('Выделите и скопируйте код вручную')
    }
  }
  return (
    <header className="command-hud">
      <div className="hud-heading">
        <div className="hud-title">
          <p className="eyebrow">
            KHARON SECUNDUS <span aria-hidden="true">/</span> {phases[s.phase]}
          </p>
          <h1>{s.name}</h1>
          <span className={`faction ${side}`}>
            {labels[side]} <span className="hud-stage">· Этап {s.stage + 1}</span>
          </span>
        </div>
        <div className="hud-utilities">
          {sync ? (
            <SyncStatus sync={sync} pending={pending} side={side} compact version={s.version} />
          ) : (
            <span className="local-status">
              <i aria-hidden="true" />
              Локальная проверка
            </span>
          )}
          <div className="toolbar">
            {invite && (
              <button
                className="quiet invite-code"
                onClick={copyInvite}
                title="Скопировать код приглашения"
              >
                <Copy size={14} aria-hidden="true" />
                Код: {invite}
              </button>
            )}
            {refresh && (
              <button
                className="quiet icon-button"
                aria-label="Обновить состояние"
                disabled={busy || sync?.refreshing}
                onClick={refresh}
              >
                <RefreshCw
                  size={16}
                  className={busy || sync?.refreshing ? 'spin' : ''}
                  aria-hidden="true"
                />
              </button>
            )}
          </div>
          {copyStatus && (
            <small className="copy-status" role="status">
              {copyStatus === 'Код скопирован' ? (
                <Check size={12} aria-hidden="true" />
              ) : (
                <Copy size={12} aria-hidden="true" />
              )}
              {copyStatus}
            </small>
          )}
        </div>
      </div>
      <dl className="resource-metrics" aria-label="Ресурсы кампании" key={`${s.id}:${side}`}>
        <Metric
          label={s.phase === 'terminal' ? 'Боёв сыграно' : 'Бой'}
          value={s.phase === 'terminal' ? s.battles : Math.min(18, s.battles + 1)}
          suffix="/ 18"
          description="Текущий бой кампании; всего запланировано 18 боёв."
          icon={Swords}
        />
        <Metric
          label="AL"
          rule="prices"
          value={STAGES[s.stage].al}
          description="Army Limit — предел армии для текущего этапа."
          icon={Gauge}
        />
        <Metric
          label="Supply"
          value={p.supply}
          description="Общее снабжение вашей стороны."
          icon={Coins}
          track
        />
        <Metric
          label="Intel"
          value={p.intel}
          description="Разведданные вашей стороны."
          icon={Eye}
          track
        />
        <Metric
          label="Recovery"
          rule="recovery"
          value={p.recovery}
          description="Резерв снабжения для восстановления потерь."
          icon={Wrench}
          track
        />
        <Metric
          label="Choir"
          rule="choir"
          value={s.choir}
          suffix="/ 8"
          description="BLACK CHOIR — общий прогресс раскрытия тайны."
          icon={Radio}
          track
        />
        {p.debt > 0 && (
          <Metric
            label="Аварийный долг"
            rule="emergency"
            value={p.debt}
            description="Непогашенный долг Emergency Muster вашей стороны."
            icon={Coins}
            warning
            track
          />
        )}
      </dl>
    </header>
  )
}
