import {
  SIDES,
  type Battle,
  type Command,
  type Context,
  type Side,
  type State,
  type TableState,
  type Unit,
} from './model.ts'
import { COMMAND_LABELS } from './history.ts'
import { assert, integer, str } from './rules.ts'
import { tableCommand } from './table.ts'
import { TABLE_STEP_LABELS } from './table-checks.ts'

export interface BattleEvent {
  id: string
  version: number
  actor: Side
  round: number
  turn: Side
  step: TableState['step']
  command: string
  summary: string
  details: string[]
  dice: number[]
  vp: Record<Side, number>
  /** Only public, correctable commands; never sealed choices or hidden records. */
  input?: Command
}
interface RecordedEvent {
  id: string
  version: number
  actor: Side
  at: Pick<TableState, 'round' | 'turn' | 'step'>
  command: Command
  dice: { sides: number; value: number }[]
  ids: string[]
}
export interface TableReplay {
  base: { table: TableState; units: Unit[]; assets: Battle['assets']; decoys: Battle['decoys'] }
  events: RecordedEvent[]
  revisions: BattleEvent[]
}
export interface TableEdit {
  before: string
  replace?: boolean
  command: Command
}
interface PreparedEdit extends TableEdit {
  ids: string[]
  id: string
}
export interface TableProposal {
  reason: string
  approved: Side[]
  changes: string[]
  preview: { vp: Record<Side, number>; objects: string[]; effects: string[]; secret: boolean }
  /** Private: removed from every player projection. */
  edits?: PreparedEdit[]
}
export const CORRECTABLE_TABLE_COMMANDS = [
  'table_controls',
  'table_fact',
  'table_action',
  'table_complete',
  'table_pool_arrival',
  'table_reserve_arrival',
  'echo_wounds',
]
const location = (t: TableState) => ({ round: t.round, turn: t.turn, step: t.step })
const sideName = (side: Side | null) =>
  side === 'deathwatch' ? 'Deathwatch' : side === 'necrons' ? 'Necrons' : '—'

function apply(s: State, c: Command, ctx: Context) {
  const t = s.battle!.table
  // An acknowledgement becomes stale when facts affecting the hazards change.
  if (t.step === 'hazards' && ['table_controls', 'table_fact', 'echo_wounds'].includes(c.type))
    t.receipts = t.receipts.filter((v) => !v.startsWith(`R${t.round}:hazards:`))
  tableCommand(s, c, ctx)
}

function publicEvent(before: State, after: State, event: RecordedEvent): BattleEvent {
  const t = after.battle!.table,
    old = before.battle!.table,
    p = event.command.payload
  const details: string[] = []
  const name = (id: unknown) => after.units.find((u) => u.id === id)?.name ?? String(id)
  let summary = COMMAND_LABELS[event.command.type] ?? event.command.type
  const c = event.command.type
  if (c === 'table_action')
    summary = `${String(p.kind)} · ${name(p.actor)} → объект ${String(p.object)}`
  if (c === 'table_complete') {
    const action = t.actions.find((a) => a.id === p.id)
    summary = `${action?.kind ?? 'Action'} · ${action ? name(action.actor) : ''} → ${action?.object ?? ''}: ${p.success ? 'успех' : 'срыв'}`
    if (p.success && p.die !== undefined) details.push(`Введённый боевой D6: ${String(p.die)}`)
  }
  if (c === 'table_controls')
    for (const row of p.controls as { id: string; side: Side | null }[])
      details.push(
        `Объект ${row.id}: ${old.objects.find((o) => o.id === row.id)?.control ?? 'нейтрален'} → ${row.side ?? 'нейтрален'}`,
      )
  if (c === 'table_fact') details.push(`${String(p.name)} = ${String(p.value)}`)
  if (c === 'table_pool_arrival' || c === 'table_reserve_arrival') details.push(name(p.actor))
  if (c === 'table_use') details.push(`${name(p.actor)} · ${String(p.item)}`)
  if (c === 'table_first') details.push(String(p.side))
  if (c === 'echo_wounds') details.push(`Echo ${Number(p.index) + 1}: ${String(p.wounds)} wounds`)
  if (c === 'table_advance' && ['command', 'end_turn', 'end_round', 'hazards'].includes(old.step))
    details.push(
      `Контроль: ${old.objects
        .filter((o) => !o.disabled)
        .map((o) => `${o.id}=${o.control ?? '—'}`)
        .join(', ')}`,
    )
  // Notes can include intentionally revealed information. Decoy selection has no details.
  if (c !== 'table_decoy') details.push(...t.notes.filter((n) => !old.notes.includes(n)))
  return {
    id: event.id,
    version: event.version,
    actor: event.actor,
    ...event.at,
    command: c,
    summary,
    details,
    dice: event.dice.map((v) => v.value),
    vp: { deathwatch: t.vp.deathwatch - old.vp.deathwatch, necrons: t.vp.necrons - old.vp.necrons },
    ...(CORRECTABLE_TABLE_COMMANDS.includes(c) ? { input: structuredClone(event.command) } : {}),
  }
}

export function recordedTableCommand(s: State, c: Command, ctx: Context) {
  const b = s.battle!
  assert(b, 'Нет текущего боя')
  // Old in-progress campaigns keep their established order. New tables require roll-off.
  if (b.table.firstConfirmed === undefined && (b.table.round > 1 || b.table.step !== 'start'))
    b.table.firstConfirmed = true
  b.replay ??= {
    base: {
      table: structuredClone(b.table),
      units: structuredClone(s.units),
      assets: structuredClone(b.assets),
      decoys: structuredClone(b.decoys),
    },
    events: [],
    revisions: [],
  }
  assert(b.replay.events.length < 4000, 'Журнал боя достиг лимита событий')
  const before = { battle: { table: structuredClone(b.table) } } as State
  const e: RecordedEvent = {
    id: `v${s.version + 1}`,
    version: s.version + 1,
    actor: ctx.actor,
    at: location(b.table),
    command: structuredClone(c),
    dice: [],
    ids: [],
  }
  apply(s, c, {
    ...ctx,
    dice: (sides) => {
      const value = ctx.dice(sides)
      e.dice.push({ sides, value })
      return value
    },
    id: () => {
      const id = ctx.id()
      e.ids.push(id)
      return id
    },
  })
  b.replay.events.push(e)
  b.journal ??= []
  b.journal.push(publicEvent(before, s, e))
}

function replay(s: State, edits: PreparedEdit[]) {
  const b = s.battle!,
    ledger = b.replay!
  const candidate = structuredClone(s)
  const cb = candidate.battle!
  candidate.phase = 'battle'
  candidate.units = structuredClone(ledger.base.units)
  cb.table = structuredClone(ledger.base.table)
  cb.assets = structuredClone(ledger.base.assets)
  cb.decoys = structuredClone(ledger.base.decoys)
  cb.journal = []
  cb.reconciliation = null
  const events: RecordedEvent[] = []
  for (const original of ledger.events) {
    for (const edit of edits.filter((e) => e.before === original.id && !e.replace))
      events.push({
        id: edit.id,
        version: s.version + 1,
        actor: b.reconciliation?.approved[0] ?? s.active,
        at: original.at,
        command: edit.command,
        ids: edit.ids,
        dice: [],
      })
    const edit = edits.find((e) => e.before === original.id && e.replace)
    events.push(edit ? { ...original, command: edit.command } : original)
  }
  for (const e of events) {
    const t = cb.table
    assert(
      t.round === e.at.round && t.turn === e.at.turn && t.step === e.at.step,
      `Исправление меняет порядок последующих шагов (${e.id}); требуется другой согласованный набор фактов`,
    )
    let diceIndex = 0,
      idIndex = 0
    const before = { battle: { table: structuredClone(t) } } as State
    try {
      apply(candidate, e.command, {
        actor: e.actor,
        dice: (sides) => {
          const roll = e.dice[diceIndex++]
          assert(
            roll && roll.sides === sides,
            'Исправление потребовало нового случайного броска; это запрещено',
          )
          return roll.value
        },
        id: () => {
          const id = e.ids[idIndex++]
          assert(id, 'Нет сохранённого ID события')
          return id
        },
      })
      assert(
        diceIndex === e.dice.length && idIndex === e.ids.length,
        'Исправление изменило сохранённый бросок или ID',
      )
    } catch (err) {
      throw new Error(`R${e.at.round}, ${e.at.step}, ${e.command.type}: ${(err as Error).message}`)
    }
    cb.journal.push(publicEvent(before, candidate, e))
  }
  assert(
    cb.table.round === b.table.round &&
      cb.table.step === b.table.step &&
      cb.table.turn === b.table.turn,
    'Исправление меняет текущий этап боя',
  )
  // Never erase already revealed information, even when editing a preceding fact.
  for (const o of b.table.objects)
    assert(
      !o.revealed || cb.table.objects.find((v) => v.id === o.id)?.revealed,
      'Нельзя отменить раскрытие тайной информации',
    )
  cb.replay!.events = events
  cb.journal.push(...ledger.revisions)
  return candidate
}

export function reconcileTable(s: State, c: Command, ctx: Context) {
  const b = s.battle!
  assert(
    b && ['battle', 'result'].includes(s.phase) && !s.resultBase && !b.aftermathApplied,
    'События исправляются до расчёта потерь; для завершённого боя используйте коррекцию результата',
  )
  assert(
    b.replay?.events.length,
    'Для этого боя ещё нет записанных шагов. Старые шаги исправляются через коррекцию результата',
  )
  if (c.type === 'battle_reconcile_request') {
    assert(!b.reconciliation, 'Исправление уже ожидает согласования')
    const reason = str(c.payload.reason, 500)
    assert(reason.trim().length >= 5, 'Кратко объясните исправление (не менее 5 символов)')
    const input = c.payload.edits as TableEdit[]
    assert(
      Array.isArray(input) &&
        input.length > 0 &&
        input.length <= 12 &&
        JSON.stringify(input).length <= 16000,
      'Исправление должно содержать от 1 до 12 конкретных событий',
    )
    const prepared: PreparedEdit[] = []
    const changes: string[] = []
    for (let i = 0; i < input.length; i++) {
      const edit = input[i],
        original = b.replay.events.find((e) => e.id === edit.before)
      assert(
        original &&
          CORRECTABLE_TABLE_COMMANDS.includes(edit.command?.type) &&
          edit.command.payload &&
          typeof edit.command.payload === 'object' &&
          !Array.isArray(edit.command.payload),
        'Выберите записанный момент и допустимый тип факта',
      )
      if (edit.replace) {
        assert(
          original.actor === ctx.actor && original.command.type === edit.command.type,
          'Можно исправить только свою запись того же типа',
        )
        assert(
          !prepared.some((e) => e.replace && e.before === edit.before),
          'Запись исправляется один раз',
        )
        if (original.command.payload.die !== undefined)
          assert(
            edit.command.payload.die === original.command.payload.die,
            'Уже записанный боевой D6 сохраняется',
          )
      } else
        assert(
          original.command.type === 'table_advance',
          'Пропущенный факт вставляется перед завершением шага',
        )
      const id = `r${s.version + 1}:${i}`
      // Give newly restored Actions stable identifiers; subsequent completion can reference $action:N.
      const cmd = structuredClone(edit.command)
      if (typeof cmd.payload.id === 'string' && cmd.payload.id.startsWith('$action:')) {
        const index = integer(Number(cmd.payload.id.slice(8)), 0, i - 1)
        assert(
          prepared[index].command.type === 'table_action',
          'Ссылка должна вести на восстановленный Action',
        )
        cmd.payload.id = prepared[index].ids[0]
      }
      const ids = edit.replace ? original.ids : cmd.type === 'table_action' ? [ctx.id()] : []
      prepared.push({ before: edit.before, replace: edit.replace === true, command: cmd, ids, id })
      const target = cmd.payload.actor
        ? s.units.find((u) => u.id === cmd.payload.actor)?.name
        : cmd.type === 'table_complete'
          ? cmd.payload.success
            ? 'успех'
            : 'срыв'
          : ''
      changes.push(
        `R${original.at.round} · ${TABLE_STEP_LABELS[original.at.step]} · ${edit.replace ? 'исправить' : 'добавить'}: ${COMMAND_LABELS[cmd.type] ?? cmd.type}${cmd.payload.kind ? ` ${String(cmd.payload.kind)}` : ''}${target ? ` · ${target}` : ''}${cmd.payload.object ? ` → ${String(cmd.payload.object)}` : ''}`,
      )
    }
    // The proposer is fixed before replay; the second actor cannot become the owner of inserted Actions.
    b.reconciliation = {
      reason,
      approved: [ctx.actor],
      changes,
      preview: { vp: b.table.vp, objects: [], effects: [], secret: false },
      edits: prepared,
    }
    // Even a validation error could reveal F2's true Signal (e.g. a later SCAN becomes illegal).
    // Defer the entire replay until both players consent while any Signal is still hidden.
    if (
      b.mission === 'F2' &&
      b.table.objects.some((o) => !['overlay', 'index'].includes(o.id) && !o.revealed)
    ) {
      b.reconciliation.preview.secret = true
      return
    }
    const replayed = replay(s, prepared),
      candidate = replayed.battle!
    const secret = candidate.table.objects.some(
      (o) => o.revealed && !b.table.objects.find((v) => v.id === o.id)?.revealed,
    )
    b.reconciliation.preview = {
      secret,
      vp: secret ? structuredClone(b.table.vp) : candidate.table.vp,
      effects: secret
        ? []
        : [
            ...[
              ...new Set([
                ...Object.keys(b.table.records),
                ...Object.keys(candidate.table.records),
              ]),
            ]
              .filter(
                (key) =>
                  /^(supply10:|supply5:|intel:|xp:|choirCommune$|choirF2$)/.test(key) &&
                  b.table.records[key] !== candidate.table.records[key],
              )
              .map((key) => {
                const [type, target] = key.split(':')
                const label =
                  type === 'xp'
                    ? `XP ${s.units.find((u) => u.id === target)?.name ?? target}`
                    : type === 'intel'
                      ? `Intel ${sideName(target as Side)}`
                      : type.startsWith('supply')
                        ? `Supply ${sideName(target as Side)}`
                        : 'Choir'
                const factor = type === 'supply10' ? 10 : type === 'supply5' ? 5 : 1
                return `${label}: ${Number(b.table.records[key] ?? 0) * factor} → ${Number(candidate.table.records[key] ?? 0) * factor}`
              }),
            ...(b.table.instability !== candidate.table.instability
              ? [`Instability: ${b.table.instability} → ${candidate.table.instability}`]
              : []),
            ...s.units
              .filter((u) => {
                const next = replayed.units.find((v) => v.id === u.id)!
                return (
                  u.armoury !== next.armoury || u.flags.damagedArmoury !== next.flags.damagedArmoury
                )
              })
              .map(
                (u) =>
                  `${u.name}: Armoury и состояние предмета будут приведены к исправленной истории`,
              ),
          ],
      objects: secret
        ? []
        : candidate.table.objects
            .filter((o) => {
              const old = b.table.objects.find((v) => v.id === o.id)
              return (
                old &&
                (old.tag !== o.tag ||
                  old.control !== o.control ||
                  old.disabled !== o.disabled ||
                  old.carrier !== o.carrier ||
                  JSON.stringify(old.keys) !== JSON.stringify(o.keys))
              )
            })
            .map(
              (o) =>
                `Объект ${o.id}: контроль ${sideName(o.control)}, метка ${sideName(o.tag)}${o.disabled ? ', отключён' : ''}${o.keys.length ? `, Keys ${o.keys.length}` : ''}`,
            ),
    }
    return
  }
  assert(b.reconciliation, 'Нет предложенного исправления')
  if (c.type === 'battle_reconcile_cancel') {
    b.reconciliation = null
    return
  }
  assert(
    c.type === 'battle_reconcile_approve' && !b.reconciliation.approved.includes(ctx.actor),
    'Ваше согласие уже записано',
  )
  const proposal = b.reconciliation
  const candidate = replay(s, proposal.edits!)
  const cb = candidate.battle!
  const audit: BattleEvent = {
    id: `agreement:${s.version + 1}`,
    version: s.version + 1,
    actor: ctx.actor,
    ...location(b.table),
    command: c.type,
    summary: 'Оба командира согласовали исправление событий',
    details: [proposal.reason, ...proposal.changes],
    dice: [],
    vp: {
      deathwatch: cb.table.vp.deathwatch - b.table.vp.deathwatch,
      necrons: cb.table.vp.necrons - b.table.vp.necrons,
    },
  }
  cb.replay!.revisions.push(audit)
  cb.journal!.push(audit)
  s.units = candidate.units
  b.table = cb.table
  b.assets = cb.assets
  b.decoys = cb.decoys
  b.replay = cb.replay
  b.journal = cb.journal
  b.reconciliation = null
  b.report = null
  b.confirm = []
  b.outcome = null
  s.phase = 'battle'
}

export function projectTableJournal(b: Battle) {
  delete b.replay
  if (b.reconciliation) delete b.reconciliation.edits
}
