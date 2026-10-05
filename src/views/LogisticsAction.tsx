import { useMemo } from 'react'
import { ArrowRight, LockKeyhole } from 'lucide-react'
import { logisticsPreview } from '../../shared/logistics-preview'
import type { Props } from './common'

export function LogisticsAction({
  s,
  side,
  send,
  type,
  payload,
  label,
  quiet = false,
}: Props & { type: string; payload: Record<string, unknown>; label: string; quiet?: boolean }) {
  const key = JSON.stringify(payload)
  const p = useMemo(() => logisticsPreview(s, side, type, payload), [s, side, type, key])
  return (
    <div className={`logistics-action operation-card${!p.allowed ? ' blocked-operation' : ''}`}>
      <div className="operation-title">
        <strong>{label}</strong>
        {p.allowed && (
          <span>
            {p.supply < 0 ? `+${-p.supply}` : p.supply}{' '}
            <small>Supply{p.supply < 0 ? ' возврат' : ''}</small>
          </span>
        )}
      </div>
      {p.allowed ? (
        <div className="operation-projection">
          <dl>
            <div>
              <dt>Supply</dt>
              <dd>
                {s.players[side].supply}
                <ArrowRight size={11} aria-hidden="true" />
                <strong>{p.remaining}</strong>
              </dd>
            </div>
            {p.recovery > 0 && (
              <div>
                <dt>Recovery армии</dt>
                <dd>
                  {s.players[side].recovery}
                  <ArrowRight size={11} aria-hidden="true" />
                  {p.recoveryRemaining}
                </dd>
              </div>
            )}
            {p.local > 0 && (
              <div>
                <dt>Local {String(payload.sector ?? '')}</dt>
                <dd>
                  −{p.local} · осталось {p.localRemaining}
                </dd>
              </div>
            )}
            {p.personal > 0 && (
              <div>
                <dt>Личный Recovery</dt>
                <dd>−{p.personal}</dd>
              </div>
            )}
            {p.unit && !p.random && p.unit.damage[0] !== p.unit.damage[1] && (
              <div>
                <dt>Damage</dt>
                <dd>
                  {p.unit.damage[0]}
                  <ArrowRight size={11} aria-hidden="true" />
                  <strong>{p.unit.damage[1]}</strong>
                </dd>
              </div>
            )}
            {p.unit && !p.random && p.unit.evac[0] !== p.unit.evac[1] && (
              <div>
                <dt>Evacuation Debt</dt>
                <dd>
                  {p.unit.evac[0]}
                  <ArrowRight size={11} aria-hidden="true" />
                  {p.unit.evac[1]}
                </dd>
              </div>
            )}
            {p.debtRepaid > 0 && (
              <div>
                <dt>Погашение долга</dt>
                <dd>
                  −{p.debtRepaid} · осталось {p.debtRemaining}
                </dd>
              </div>
            )}
          </dl>
          {p.cache && (
            <small className="operation-note">
              Будет израсходован 1 Recovery Cache · скидка до 30.
            </small>
          )}
          {p.unit && p.unit.commission[0] && !p.unit.commission[1] && (
            <small>Commission будет снят.</small>
          )}
          {p.random && <small>Результат зависит от D6. Расход ресурсов показан до броска.</small>}
          {p.garrisonUnitCap !== null && (
            <small>Лимит RC одного защитника: {p.garrisonUnitCap}.</small>
          )}
          {p.capRemaining !== null && (
            <small>После покупки свободно {p.capRemaining} RC в Force.</small>
          )}
        </div>
      ) : (
        <p className="operation-blocked">
          <LockKeyhole size={13} aria-hidden="true" />
          {p.reason}
        </p>
      )}
      <button
        className={quiet ? 'quiet' : ''}
        disabled={!p.allowed}
        onClick={() => send(type, payload)}
      >
        {label}
        <ArrowRight size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
