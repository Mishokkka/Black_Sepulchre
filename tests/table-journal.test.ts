import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, context } from './fixture.ts'
import { command, project } from '../shared/engine.ts'
import { declareBattle } from '../shared/battle.ts'
import { createTable } from '../shared/table.ts'
import { initialReport } from '../shared/report-form.ts'
import { MISSION_CARDS } from '../shared/rules.generated.ts'
import { completionReady } from '../shared/table-checks.ts'
import { type Side, type State } from '../shared/model.ts'
import { type TableEdit } from '../shared/table-journal.ts'

let sequence = 9000
const ctx = (actor: Side = 'deathwatch', die = 4) => ({
  ...context(actor, die),
  id: () => `journal-${sequence++}`,
})
const run = (
  s: State,
  type: string,
  payload: Record<string, unknown> = {},
  side: Side = 'deathwatch',
  die = 4,
) => command(s, { type, payload }, ctx(side, die))
function table(mission = 'F1') {
  const s = fixture()
  declareBattle(s, 'F', 'deathwatch', false, ctx())
  const b = s.battle!
  b.mission = mission
  if (['PACT', 'WAR'].includes(mission)) b.type = mission as 'PACT' | 'WAR'
  b.hiddenSignal = mission === 'F2' ? '3' : ''
  b.table = createTable(s, mission, ctx())
  for (const side of ['deathwatch', 'necrons'] as Side[]) {
    const us = s.units.filter((u) => u.side === side)
    b.muster[side] = {
      picks: us.map((u) => ({
        id: u.id,
        role: 'field',
        formation: u.id,
        transport: null,
        reserve: false,
        enhancement: null,
        honours: [],
        armoury: false,
        relic: false,
        redemption: null,
        protocol: null,
      })),
      rest: [],
      detachments: s.players[side].package,
      commander: us[0].id,
      dispositions: [],
    }
    b.assets[side] = { tactical: [], defensive: [], breach: [] }
  }
  s.phase = 'battle'
  return s
}
function advance(s: State) {
  const t = s.battle!.table
  if (t.round === 1 && t.step === 'start' && !t.firstConfirmed)
    s = run(s, 'table_first', { side: t.first })
  if (s.battle!.table.step === 'hazards') s = run(s, 'table_hazard_ack', {}, t.turn)
  return run(s, 'table_advance', { reviewed: true }, t.turn)
}
function until(s: State, match: (s: State) => boolean) {
  let guard = 0
  while (!match(s) && guard++ < 100) s = advance(s)
  assert(guard < 100, 'Unreachable checkpoint')
  return s
}
const finished = (s: State) => until(s, (s) => s.battle!.table.step === 'finished')
const point = (s: State, round: number, step: string, side: Side = 'deathwatch') =>
  s.battle!.journal!.find(
    (e) => e.command === 'table_advance' && e.round === round && e.step === step && e.turn === side,
  )!.id
function actionEdits(
  s: State,
  round: number,
  kind = 'HACK',
  object = '1',
  die?: number,
): TableEdit[] {
  const actor = s.battle!.muster.deathwatch!.picks[0].id
  return [
    {
      before: point(s, round, 'movement'),
      command: {
        type: 'table_action',
        payload: { actor, kind, object, eligible: true, inRange: true },
      },
    },
    {
      before: point(s, round, 'end_turn'),
      command: {
        type: 'table_complete',
        payload: {
          id: '$action:0',
          success: true,
          alive: true,
          stationary: true,
          inRange: true,
          notShocked: true,
          ...(die ? { die } : {}),
        },
      },
    },
  ]
}
const propose = (s: State, edits: TableEdit[], side: Side = 'deathwatch') =>
  run(s, 'battle_reconcile_request', { edits, reason: 'Забыли записать факт за столом' }, side)
const agree = (s: State) => run(s, 'battle_reconcile_approve', {}, 'necrons')

test('Roll-off is explicit; scoring and hazards need review, while Charge/Fight precede completion', () => {
  let s = table()
  assert.throws(() => run(s, 'table_advance'), /первого игрока/)
  s = run(s, 'table_first', { side: 'necrons' })
  s = run(s, 'table_advance')
  assert.equal(s.battle!.table.turn, 'necrons')
  assert.throws(() => run(s, 'table_advance', {}, 'necrons'), /Сверьте/)
  s = advance(s)
  s = advance(s)
  assert.equal(s.battle!.table.step, 'shooting')
  s = advance(s)
  assert.equal(s.battle!.table.step, 'charge')
  assert.throws(() => run(s, 'table_advance'), /другой стороны/)
  s = advance(s)
  assert.equal(s.battle!.table.step, 'fight')
  s = until(s, (s) => s.battle!.table.step === 'hazards')
  assert.throws(() => run(s, 'table_advance', { reviewed: true }), /опасности/)
  s = run(s, 'table_hazard_ack')
  s = run(s, 'table_controls', { controls: [{ id: '1', side: 'necrons' }] })
  assert.throws(() => run(s, 'table_advance', { reviewed: true }), /опасности/)
  s = advance(s)
  assert.equal(s.battle!.table.round, 2)
})

test('An unresolved Action cannot silently fail at end turn; early completion stays unavailable', () => {
  let s = until(table(), (s) => s.battle!.table.step === 'movement')
  const actor = s.battle!.muster.deathwatch!.picks[0].id
  s = run(s, 'table_action', { actor, object: '1', kind: 'HACK', eligible: true, inRange: true })
  const id = s.battle!.table.actions[0].id
  assert.equal(completionReady(s.battle!.table, s.battle!.table.actions[0]), false)
  assert.throws(() => run(s, 'table_complete', { id, success: false }), /timing/)
  s = until(s, (s) => s.battle!.table.step === 'end_turn')
  assert.throws(() => advance(s), /Actions/)
  assert.equal(s.battle!.table.actions[0].pending, true)
  s = run(s, 'table_complete', { id, success: false })
  s = advance(s)
  assert.equal(s.battle!.table.turn, 'necrons')
})

test('A missed R3 HACK restores tag and 5 VP only after the second player agrees; replay cannot duplicate it', () => {
  const s = finished(table())
  const edits = actionEdits(s, 3)
  let proposed = propose(s, edits)
  assert.equal(proposed.battle!.table.vp.deathwatch, 0)
  assert.equal(proposed.battle!.reconciliation!.preview.vp.deathwatch, 5)
  assert.throws(
    () => run(proposed, 'submit_result', { report: initialReport(proposed.battle!) }),
    /приостанов|остановлены/,
  )
  assert.throws(() => run(proposed, 'battle_reconcile_approve'), /уже записано/)
  for (const side of ['deathwatch', 'necrons'] as Side[]) {
    const view = project(proposed, side)
    assert.equal(view.battle!.replay, undefined)
    assert.equal(view.battle!.reconciliation!.edits, undefined)
  }
  proposed = agree(proposed)
  assert.equal(proposed.battle!.table.vp.deathwatch, 5)
  assert.equal(proposed.battle!.table.objects[0].tag, 'deathwatch')
  assert.equal(proposed.battle!.table.actions.length, 1)
  assert.equal(proposed.battle!.table.records['reward:deathwatch:1:HACK'], true)
  assert.throws(() => agree(proposed), /Нет предложенного/)
  assert.throws(() => propose(proposed, actionEdits(proposed, 4)), /Own-tag/)
  assert.equal(s.battle!.table.vp.deathwatch, 0)
})

test('Historical control is scored at its actual timing, rather than applied to all five rounds', () => {
  const s = finished(table())
  const corrected = agree(
    propose(s, [
      {
        before: point(s, 3, 'end_turn'),
        command: {
          type: 'table_controls',
          payload: { controls: [{ id: '1', side: 'deathwatch' }] },
        },
      },
    ]),
  )
  assert.equal(corrected.battle!.table.vp.deathwatch, 6, 'Only Command R4 and R5 score')
  const scored = corrected.battle!.journal!.filter(
    (e) => e.vp.deathwatch && e.command === 'table_advance',
  )
  assert.deepEqual(
    scored.map((e) => [e.round, e.step, e.vp.deathwatch]),
    [
      [4, 'command', 3],
      [5, 'command', 3],
    ],
  )
})

test('Restoring initial reserve arrival changes participation, but illegal R4 ingress is rejected', () => {
  const initial = table(),
    reserve = initial.battle!.muster.deathwatch!.picks[0]
  reserve.reserve = true
  const s = finished(initial)
  assert.equal(initialReport(s.battle!).units.find((u) => u.id === reserve.id)!.destroyed, true)
  const correction = (round: number): TableEdit[] => [
    {
      before: point(s, round, 'movement'),
      command: {
        type: 'table_reserve_arrival',
        payload: { actor: reserve.id, legalIngress: true },
      },
    },
  ]
  assert.throws(() => propose(s, correction(4)), /R2–3/)
  const restored = agree(propose(s, correction(2)))
  assert.equal(restored.battle!.table.records[`entered:${reserve.id}`], 2)
  const report = initialReport(restored.battle!).units.find((u) => u.id === reserve.id)!
  assert.equal(report.entered, true)
  assert.equal(report.destroyed, false)
})

test('Rejected edits leave the board intact; a restored earlier tag must not invalidate a later legal Action', () => {
  let s = until(table(), (s) => s.battle!.table.round === 4 && s.battle!.table.step === 'movement')
  const actor = s.battle!.muster.deathwatch!.picks[0].id
  s = run(s, 'table_action', { actor, object: '1', kind: 'HACK', eligible: true, inRange: true })
  s = until(s, (s) => s.battle!.table.step === 'end_turn')
  s = run(s, 'table_complete', {
    id: s.battle!.table.actions[0].id,
    success: true,
    alive: true,
    inRange: true,
    stationary: true,
    notShocked: true,
  })
  s = finished(s)
  assert.throws(() => propose(s, actionEdits(s, 3)), /Own-tag/)
  const proposal = propose(s, [
    {
      before: point(s, 2, 'end_turn'),
      command: { type: 'table_controls', payload: { controls: [{ id: '2', side: 'deathwatch' }] } },
    },
  ])
  const canceled = run(proposal, 'battle_reconcile_cancel', {}, 'necrons')
  assert.deepEqual(canceled.battle!.table, s.battle!.table)
})

test('Already rolled Damaged Relic is replayed identically; neither proposal nor agreement calls random dice', () => {
  let s = table()
  const u = s.units[0]
  u.armoury = 'relay'
  u.flags.damagedArmoury = true
  s.battle!.muster.deathwatch!.picks[0].armoury = true
  s = until(s, (s) => s.battle!.table.step === 'movement')
  s = run(s, 'table_use', { actor: u.id, item: 'relay' }, 'deathwatch', 1)
  s = finished(s)
  const edits: TableEdit[] = [
    {
      before: point(s, 3, 'end_turn'),
      command: { type: 'table_controls', payload: { controls: [{ id: '1', side: 'deathwatch' }] } },
    },
  ]
  const noRoll = (side: Side) => ({
    ...ctx(side),
    dice: () => {
      throw Error('New roll forbidden')
    },
  })
  s = command(
    s,
    { type: 'battle_reconcile_request', payload: { reason: 'Контроль сверили после боя', edits } },
    noRoll('deathwatch'),
  )
  s = command(s, { type: 'battle_reconcile_approve', payload: {} }, noRoll('necrons'))
  assert.equal(s.units.find((v) => v.id === u.id)!.armoury, null)
  assert.equal(s.battle!.table.records[`damagedArmoury:${u.id}`], 1)
  assert.deepEqual(s.battle!.journal!.find((e) => e.command === 'table_use')!.dice, [1])
})

test('A missing F2 SCAN never leaks its result in a unilateral preview, and an existing reveal cannot be erased', () => {
  let s = finished(table('F2'))
  s = propose(s, actionEdits(s, 3, 'SCAN', '3'))
  for (const side of ['deathwatch', 'necrons'] as Side[]) {
    const projected = project(s, side)
    assert.equal(projected.battle!.reconciliation!.preview.secret, true)
    assert.equal(projected.battle!.reconciliation!.preview.vp.deathwatch, 0)
    assert.deepEqual(projected.battle!.reconciliation!.preview.objects, [])
    assert.equal(JSON.stringify(projected).includes('trueSignal'), false)
    assert.equal(projected.battle!.hiddenSignal, '')
  }
  s = agree(s)
  assert.equal(s.battle!.table.vp.deathwatch, 10)
  assert.equal(s.battle!.table.objects[2].kind, 'objective')
  const event = s.battle!.journal!.find((e) => e.command === 'table_complete')!
  assert.throws(
    () =>
      propose(s, [
        {
          before: event.id,
          replace: true,
          command: { type: 'table_complete', payload: { ...event.input!.payload, success: false } },
        },
      ]),
    /раскрытие/,
  )
})

test('Recorded completion can be corrected with the same D6; result confirmations reset before casualties', () => {
  let s = until(table('E3'), (s) => s.battle!.table.step === 'movement')
  s = run(s, 'table_action', {
    actor: s.units[0].id,
    object: '1',
    kind: 'SEARCH',
    eligible: true,
    inRange: true,
  })
  s = until(s, (s) => s.battle!.table.step === 'end_turn')
  s = run(s, 'table_complete', {
    id: s.battle!.table.actions[0].id,
    success: true,
    alive: true,
    inRange: true,
    notShocked: true,
    stationary: true,
    die: 6,
  })
  s = finished(s)
  const event = s.battle!.journal!.find((e) => e.command === 'table_complete')!
  const edit = (die: number): TableEdit[] => [
    {
      before: event.id,
      replace: true,
      command: {
        type: 'table_complete',
        payload: { ...event.input!.payload, success: false, die },
      },
    },
  ]
  assert.throws(() => propose(s, edit(1)), /D6 сохраняется/)
  const report = initialReport(s.battle!)
  report.retreat.necrons = 'I'
  s = run(s, 'submit_result', { report })
  assert.equal(s.phase, 'result')
  s = agree(propose(s, edit(6)))
  assert.equal(s.phase, 'battle')
  assert.deepEqual(s.battle!.confirm, [])
  assert.equal(s.battle!.report, null)
  assert.equal(s.battle!.table.vp.deathwatch, 0)
  assert.equal(s.battle!.table.records['supply10:deathwatch'], undefined)
  assert.equal(s.battle!.casualties.length, 0)
})
test('F2 cannot reveal a hidden Signal through unilateral replay validation errors', () => {
  const attempt = (signal: string) => {
    const initial = table('F2')
    initial.battle!.hiddenSignal = signal
    initial.battle!.table.records.trueSignal = signal
    const s = finished(initial)
    const edits = actionEdits(s, 2, 'SCAN', '1')
    edits.push(
      ...actionEdits(s, 3, 'SCAN', '2').map((e) => ({
        ...e,
        command: {
          ...e.command,
          payload: e.command.payload.id
            ? { ...e.command.payload, id: '$action:2' }
            : e.command.payload,
        },
      })),
    )
    return propose(s, edits)
  }
  for (const signal of ['1', '3']) {
    const proposed = attempt(signal)
    assert.equal(proposed.battle!.reconciliation!.preview.secret, true)
    assert.equal(proposed.battle!.table.vp.deathwatch, 0)
    assert.deepEqual(project(proposed, 'deathwatch').battle!.reconciliation!.preview, {
      vp: { deathwatch: 0, necrons: 0 },
      objects: [],
      effects: [],
      secret: true,
    })
  }
})

test('All 33 mission cards and both crises replay their existing scoring, moving objects and hazards without drift', () => {
  for (const mission of [...Object.keys(MISSION_CARDS), 'WAR', 'PACT']) {
    let s = table(mission)
    if (mission === 'H1')
      for (const side of ['deathwatch', 'necrons'] as Side[]) {
        const actor = s.units.find(
          (u) =>
            u.side === side &&
            s.snapshot.catalog.find((c) => c.id === u.catalogId)!.keywords.includes('INFANTRY'),
        )!.id
        s = run(s, 'table_decoy', { actor }, side)
      }
    s = finished(s)
    const object = s.battle!.table.objects.find((o) => !o.disabled)!.id
    const restored = agree(
      propose(s, [
        {
          before: point(s, 1, 'movement'),
          command: { type: 'table_controls', payload: { controls: [{ id: object, side: null }] } },
        },
      ]),
    )
    assert.deepEqual(restored.battle!.table, s.battle!.table, mission)
  }
})
