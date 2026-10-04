import { logisticsPreview } from '../../shared/logistics-preview'
import type { Props } from './CampaignViews'

export function LogisticsAction({
  s,
  side,
  send,
  type,
  payload,
  label,
}: Props & { type: string; payload: Record<string, unknown>; label: string }) {
  const p = logisticsPreview(s, side, type, payload)
  return (
    <div className="logistics-action">
      <button disabled={!p.allowed} onClick={() => send(type, payload)}>
        {label}
        {p.allowed ? ` · ${p.supply} Supply` : ''}
      </button>
      {p.allowed ? (
        <small>
          {p.supply + p.local + p.personal + p.recovery > p.supply &&
            `Всего после скидок: ${p.supply + p.local + p.personal + p.recovery}. `}
          Supply останется {p.remaining}.
          {p.local > 0 && ` Local: −${p.local}, останется ${p.localRemaining}.`}
          {p.personal > 0 && ` Личный Recovery: −${p.personal}.`}
          {p.recovery > 0 && ` Recovery армии: −${p.recovery}.`}
          {p.cache && ' Будет израсходован 1 Recovery Cache (скидка до 30).'}
          {p.garrisonUnitCap !== null && ` Лимит RC одного защитника: ${p.garrisonUnitCap}.`}
          {p.capRemaining !== null && ` Свободно в лимите Force: ${p.capRemaining} RC.`}
        </small>
      ) : (
        <small className="validation">{p.reason}</small>
      )}
    </div>
  )
}
