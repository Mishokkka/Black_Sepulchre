import { useState } from 'react'
import { SIDES } from '../../shared/model'
import { type BattleEvent, type TableEdit } from '../../shared/table-journal'
import { TABLE_STEPS } from '../../shared/battle-ui'
import { actionsFor } from '../../shared/table'
import { missionFacts } from '../../shared/mission-facts'
import { labels, Check, Options, type Props } from './common'

export function BattleJournal(props: Props) {
  const { s, side, send } = props,
    b = s.battle!,
    proposal = b.reconciliation
  const [round, setRound] = useState(''),
    [editing, setEditing] = useState(false)
  const events = b.journal ?? []
  const filtered = events.filter((e) => !round || e.round === Number(round))
  const canEdit = ['battle', 'result'].includes(s.phase) && !s.resultBase
  return (
    <section className="panel battle-journal" id="battle-reconciliation">
      <div className="section-head">
        <h2>Журнал боя</h2>
        <small>{events.length} записей</small>
      </div>
      {proposal ? (
        <div className="notice">
          <h3>Согласование исправления</h3>
          <p>{proposal.reason}</p>
          <ul>
            {proposal.changes.map((text, i) => (
              <li key={i}>{text}</li>
            ))}
          </ul>
          {proposal.preview.secret ? (
            <p>
              История содержит нераскрытые данные миссии. Проверка исправления, раскрытие результата
              и пересчёт VP выполняются только после согласия обоих командиров.
            </p>
          ) : (
            <>
              <p>
                {SIDES.map(
                  (who) => `${labels[who]}: ${b.table.vp[who]} → ${proposal.preview.vp[who]} VP`,
                ).join(' · ')}
              </p>
              <ul>
                {proposal.preview.objects.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
              {proposal.preview.effects.length > 0 && (
                <>
                  <p>Кампанийные последствия при расчёте итогов:</p>
                  <ul>
                    {proposal.preview.effects.map((text) => (
                      <li key={text}>{text}</li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
          <p>
            Броски сохраняются. Зависимые действия приостановлены. После применения отчёт нужно
            подтвердить заново.
          </p>
          <div className="buttons">
            {!proposal.approved.includes(side) && (
              <button className="primary" onClick={() => send('battle_reconcile_approve')}>
                Согласовать исправление
              </button>
            )}
            <button className="quiet" onClick={() => send('battle_reconcile_cancel')}>
              {proposal.approved.includes(side) ? 'Отозвать предложение' : 'Отклонить исправление'}
            </button>
          </div>
          {proposal.approved.includes(side) && (
            <p className="muted">Ожидается согласие другого командира.</p>
          )}
        </div>
      ) : (
        <>
          {canEdit && (
            <button
              className="quiet"
              disabled={!events.length}
              onClick={() => setEditing(!editing)}
            >
              {editing ? 'Закрыть исправление' : 'Восстановить или исправить факт'}
            </button>
          )}
          {editing && canEdit && <JournalCorrection key={`${b.id}:${s.version}`} {...props} />}
        </>
      )}
      <details open={!!proposal || b.table.step === 'finished'}>
        <summary>События и источники VP</summary>
        <Options
          label="Раунд журнала"
          value={round}
          change={setRound}
          emptyLabel="Все раунды"
          items={[...new Set(events.map((e) => e.round))].map((r) => ({
            id: String(r),
            name: `Раунд ${r}`,
          }))}
        />
        {!events.length && (
          <p className="muted">
            События будут записываться с первого изменения стола. История ранее пройденных шагов
            автоматически не восстанавливается.
          </p>
        )}
        <BattleEventList events={filtered} />
      </details>
    </section>
  )
}

export function BattleEventList({ events }: { events: BattleEvent[] }) {
  return (
    <ol className="battle-event-list">
      {events
        .slice()
        .reverse()
        .map((e) => (
          <li key={e.id}>
            <small>
              R{e.round} · {TABLE_STEPS[e.step]} · ход {labels[e.turn]} · записал {labels[e.actor]}
            </small>
            <strong>{e.summary}</strong>
            <p>
              {e.command === 'battle_reconcile_approve' &&
                SIDES.some((who) => e.vp[who]) &&
                'Коррекция итогового счёта · '}
              {SIDES.filter((who) => e.vp[who])
                .map((who) => `${labels[who]} ${e.vp[who] > 0 ? '+' : ''}${e.vp[who]} VP`)
                .join(' · ')}
            </p>
            {(e.details.length > 0 || e.dice.length > 0) && (
              <details>
                <summary>Подробности</summary>
                {e.details.map((text, i) => (
                  <p key={i}>{text}</p>
                ))}
                {e.dice.length > 0 && <p>Сохранённые серверные броски: {e.dice.join(', ')}</p>}
              </details>
            )}
          </li>
        ))}
    </ol>
  )
}

function JournalCorrection({ s, side, send }: Props) {
  const b = s.battle!,
    events = b.journal ?? []
  const [mode, setMode] = useState('action'),
    [checkpoint, setCheckpoint] = useState(''),
    [actor, setActor] = useState(''),
    [object, setObject] = useState(''),
    [kind, setKind] = useState(''),
    [control, setControl] = useState(''),
    [fact, setFact] = useState(''),
    [value, setValue] = useState(0),
    [success, setSuccess] = useState(true),
    [die, setDie] = useState(''),
    [reason, setReason] = useState(''),
    [ack, setAck] = useState(false),
    [honour, setHonour] = useState(''),
    [engineers, setEngineers] = useState(false),
    [key, setKey] = useState(false),
    [echo, setEcho] = useState(''),
    [wounds, setWounds] = useState(0),
    [muted, setMuted] = useState(false),
    [blocked, setBlocked] = useState(false)
  const advances = events.filter((e) => e.command === 'table_advance')
  const choices =
    mode === 'completion'
      ? events.filter((e) => e.actor === side && e.command === 'table_complete')
      : advances.filter(
          (e) =>
            !['action', 'arrival'].includes(mode) || (e.step === 'movement' && e.turn === side),
        )
  const point = events.find((e) => e.id === checkpoint)
  const completion = advances.find(
    (e) =>
      point &&
      e.round === point.round &&
      (kind === 'COMMUNE' ? e.step === 'end_round' : e.step === 'end_turn' && e.turn === side),
  )
  const o = b.table.objects.find((o) => o.id === object)
  const actions = o ? actionsFor(s, { ...o, disabled: false }) : []
  const facts = missionFacts(s, point?.round ?? b.table.round)
  const factDef = facts.find((f) => f.id === fact)
  const pick = b.muster[side]!.picks.find((p) => p.id === actor)
  let edits: TableEdit[] = []
  if (point) {
    if (mode === 'action' && actor && object && kind && completion)
      edits = [
        {
          before: point.id,
          command: {
            type: 'table_action',
            payload: {
              actor,
              object,
              kind,
              eligible: true,
              inRange: true,
              deliveryEligible: true,
              advanced: honour === 'secure_and_extract',
              actionShoot: ['operational_mastery', 'black_spear_veteran'].includes(honour),
              actionHonour: honour || undefined,
            },
          },
        },
        {
          before: completion.id,
          command: {
            type: 'table_complete',
            payload: {
              id: '$action:0',
              success,
              alive: true,
              inRange: true,
              notShocked: true,
              stationary: true,
              ...(die ? { die: Number(die) } : {}),
              fieldEngineers: engineers,
              ossuaryKey: key,
            },
          },
        },
      ]
    if (mode === 'arrival' && pick && (pick.reserve || pick.role === 'pool'))
      edits = [
        {
          before: point.id,
          command: {
            type: pick.role === 'pool' ? 'table_pool_arrival' : 'table_reserve_arrival',
            payload: { actor, placed: true, legalIngress: true },
          },
        },
      ]
    if (mode === 'controls' && object)
      edits = [
        {
          before: point.id,
          command: {
            type: 'table_controls',
            payload: { controls: [{ id: object, side: control || null }] },
          },
        },
      ]
    if (mode === 'fact' && factDef)
      edits = [
        {
          before: point.id,
          command: {
            type: 'table_fact',
            payload: { name: fact, value: factDef.count ? value : !!value },
          },
        },
      ]
    if (mode === 'completion' && point.input)
      edits = [
        {
          before: point.id,
          replace: true,
          command: {
            type: 'table_complete',
            payload: {
              ...point.input.payload,
              success,
              alive: true,
              inRange: true,
              notShocked: true,
              stationary: true,
              ...(point.input.payload.die === undefined && die ? { die: Number(die) } : {}),
            },
          },
        },
      ]
    if (mode === 'echo' && echo)
      edits = [
        {
          before: point.id,
          command: {
            type: 'echo_wounds',
            payload: { index: Number(echo) - 1, wounds, muted, blocked },
          },
        },
      ]
  }
  return (
    <div className="journal-correction">
      <h3>Конкретное исправление записи</h3>
      <p>
        Выберите исторический момент. Движок заново проверит правила и последующие события; применит
        изменения только после согласия второго командира.
      </p>
      <div className="form-grid">
        <Options
          label="Что исправить"
          value={mode}
          change={(v) => {
            setMode(v)
            setCheckpoint('')
            setAck(false)
          }}
          items={[
            { id: 'action', name: 'Пропущенный Named Action' },
            { id: 'arrival', name: 'Пропущенное прибытие' },
            { id: 'controls', name: 'Исторический контроль объекта' },
            { id: 'fact', name: 'Факт миссии' },
            { id: 'completion', name: 'Успех / срыв записанного Action' },
            ...(b.type === 'PACT' ? [{ id: 'echo', name: 'Историческое состояние Echo' }] : []),
          ]}
        />
        <Options
          label={mode === 'completion' ? 'Запись Action' : 'Момент перед завершением шага'}
          value={checkpoint}
          change={setCheckpoint}
          items={choices.map((e) => ({
            id: e.id,
            name: `R${e.round} · ${TABLE_STEPS[e.step]} · ${labels[e.turn]} · ${mode === 'completion' ? e.summary : e.id}`,
          }))}
        />
        {['action', 'arrival'].includes(mode) && (
          <Options
            label="Отряд"
            value={actor}
            change={setActor}
            items={b.muster[side]!.picks.filter(
              (p) => mode !== 'arrival' || ((p.reserve || p.role === 'pool') && !p.transport),
            ).map((p) => ({ id: p.id, name: s.units.find((u) => u.id === p.id)!.name }))}
          />
        )}
        {['action', 'controls'].includes(mode) && (
          <Options
            label="Объект исправления"
            value={object}
            change={(v) => {
              setObject(v)
              setKind('')
            }}
            items={b.table.objects.map((o) => ({ id: o.id, name: o.id }))}
          />
        )}
        {mode === 'action' && (
          <Options
            label="Восстановленный Action"
            value={kind}
            change={setKind}
            items={actions.map((id) => ({ id, name: id }))}
          />
        )}
        {mode === 'controls' && (
          <Options
            label="Контроль в тот момент"
            value={control}
            change={setControl}
            emptyLabel="Нейтральный"
            items={SIDES.map((id) => ({ id, name: labels[id] }))}
          />
        )}
        {mode === 'fact' && (
          <>
            <Options
              label="Факт миссии для выбранного раунда"
              value={fact}
              change={(v) => {
                setFact(v)
                setValue(0)
              }}
              items={facts}
            />
            {factDef?.count ? (
              <label>
                Количество
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={value}
                  onChange={(e) => setValue(Number(e.target.value))}
                />
              </label>
            ) : (
              <Check label="Факт подтверждён" value={!!value} change={(v) => setValue(v ? 1 : 0)} />
            )}
          </>
        )}
        {mode === 'echo' && (
          <>
            <Options
              label="Echo"
              value={echo}
              change={setEcho}
              items={[1, 2, 3].map((n) => ({ id: String(n), name: `Echo ${n}` }))}
            />
            <label>
              Wounds в тот момент
              <input
                type="number"
                min="0"
                max="10"
                value={wounds}
                onChange={(e) => setWounds(Number(e.target.value))}
              />
            </label>
            <Check label="Echo была Muted" value={muted} change={setMuted} />
            <Check label="Возврат Echo был заблокирован" value={blocked} change={setBlocked} />
          </>
        )}
      </div>
      {['action', 'completion'].includes(mode) && (
        <Check label="Action завершился успешно" value={success} change={setSuccess} />
      )}
      {mode === 'action' && (
        <>
          <p className="muted">
            Completion:{' '}
            {completion
              ? `R${completion.round} · ${TABLE_STEPS[completion.step]}`
              : 'выберите Movement, для которой записан конец хода / раунда'}
            .
          </p>
          <Options
            label="Разрешение кампанийного Honour"
            value={honour}
            change={setHonour}
            emptyLabel="Обычный Action"
            items={(pick?.honours ?? [])
              .filter((id) =>
                ['secure_and_extract', 'operational_mastery', 'black_spear_veteran'].includes(id),
              )
              .map((id) => ({ id, name: id }))}
          />
          {success && (
            <label>
              Фактический боевой D6, если нужен по карточке
              <input
                type="number"
                min="1"
                max="6"
                value={die}
                onChange={(e) => setDie(e.target.value)}
              />
            </label>
          )}
          {pick?.honours.includes('field_engineers') && (
            <Check
              label="В том Action применяли Field Engineers"
              value={engineers}
              change={setEngineers}
            />
          )}
          {pick?.relic && s.units.find((u) => u.id === actor)?.relic === 'key' && (
            <Check label="В том Action применяли Ossuary Key" value={key} change={setKey} />
          )}
        </>
      )}
      {mode === 'completion' && (
        <>
          <p className="muted">Записанный D6 сохраняется. Исправление не даёт нового броска.</p>
          {success && point?.input?.payload.die === undefined && (
            <label>
              Фактический D6, если раньше забыли записать
              <input
                type="number"
                min="1"
                max="6"
                value={die}
                onChange={(e) => setDie(e.target.value)}
              />
            </label>
          )}
        </>
      )}
      <label>
        Причина исправления
        <textarea
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Например: HACK выполнили в R3, но забыли записать"
        />
      </label>
      <Check
        label="Исторические условия, контроль, eligibility и физические броски проверены обоими за столом"
        value={ack}
        change={setAck}
      />
      <button
        className="primary"
        disabled={!ack || reason.trim().length < 5 || !edits.length}
        onClick={() => send('battle_reconcile_request', { reason: reason.trim(), edits })}
      >
        Предложить исправление
      </button>
      <p className="muted">
        Тайные выборы и серверные броски сохраняются. События до начала журнала этого боя
        восстановить таким способом нельзя.
      </p>
    </div>
  )
}
