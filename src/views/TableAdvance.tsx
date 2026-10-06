import { useState } from 'react'
import { hazardReceipt, tableCheckpoint } from '../../shared/table-checks'
import { type Side } from '../../shared/model'
import { Check, labels, Options, type Props } from './common'

export function FirstPlayer({ s, send }: Props) {
  const [first, setFirst] = useState('')
  const t = s.battle!.table
  return (
    <div className="table-rolloff">
      <Options
        label="Первый игрок по tabletop roll-off"
        value={first}
        change={setFirst}
        items={(['deathwatch', 'necrons'] as Side[]).map((id) => ({ id, name: labels[id] }))}
      />
      {t.firstConfirmed && <p className="muted">Подтверждён: {labels[t.first]}</p>}
      <button disabled={!first} onClick={() => send('table_first', { side: first })}>
        Подтвердить первого игрока
      </button>
    </div>
  )
}

export function TableAdvance({ s, side, send }: Props) {
  const [reviewed, setReviewed] = useState(false)
  const t = s.battle!.table,
    check = tableCheckpoint(s, side)
  const waiting = t.turn !== side && !['start', 'end_round', 'hazards'].includes(t.step)
  const hazards = t.step === 'hazards'
  const acknowledged = t.receipts.includes(hazardReceipt(t, side))
  return (
    <div className="table-checkpoint">
      {check.messages.length > 0 && (
        <ul>
          {check.messages.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      )}
      {hazards ? (
        <Check
          label="Опасности разрешены, контроль и итоговые факты сверены"
          value={acknowledged}
          change={(v) => {
            if (v) void send('table_hazard_ack')
          }}
        />
      ) : (
        check.review &&
        !waiting && (
          <Check
            label="Контроль, факты и последствия сверены за столом"
            value={reviewed}
            change={setReviewed}
          />
        )
      )}
      {check.blocked && !waiting && (
        <p className="validation" role="status">
          {check.blocked}
        </p>
      )}
      <button
        className="primary"
        disabled={
          waiting || !!check.blocked || (check.review && !(hazards ? acknowledged : reviewed))
        }
        onClick={() => send('table_advance', { reviewed: check.review })}
      >
        Завершить шаг
      </button>
      {waiting && <p className="muted">Шаг завершает другой командир.</p>}
    </div>
  )
}
