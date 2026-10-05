import type { Side, State } from '../../shared/model'
import { forceBudgets } from '../../shared/roster'
import { RuleHelp } from './RulesContext'
export function ForceBudgets({ s, side }: { s: State; side: Side }) {
  const b = forceBudgets(s, side)
  return (
    <div className="force-budgets" aria-label="Лимиты армии">
      {[['Field', b.field], ...(s.players[side].stf ? [['STF', b.stf]] : [])].map(
        ([name, budget]) => {
          const value = budget as typeof b.field
          return (
            <div
              className={`budget-card${value.used > value.cap ? ' over-budget' : ''}`}
              key={String(name)}
            >
              <span className="rule-label">
                {String(name)} · RC <RuleHelp topic="prices" />
              </span>
              <strong>
                {value.used}
                <small> / {value.cap}</small>
              </strong>
              <progress
                aria-label={`Лимит ${name}`}
                value={Math.min(value.used, value.cap)}
                max={value.cap}
              />
              <small>
                {value.used > value.cap
                  ? `Превышение ${value.used - value.cap} RC`
                  : `Свободно ${value.cap - value.used} RC`}
              </small>
            </div>
          )
        },
      )}
      <div className="budget-card">
        <span>Гарнизоны</span>
        <strong>
          {b.garrison.units}
          <small> отрядов</small>
        </strong>
        <small>{b.garrison.rc} RC · лимит проверяется для каждого защитника</small>
      </div>
    </div>
  )
}
