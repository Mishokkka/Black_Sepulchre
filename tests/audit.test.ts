import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, context } from './fixture.ts'
import { command } from '../shared/engine.ts'
import { declareBattle } from '../shared/battle.ts'
import { createTable } from '../shared/table.ts'
import { key, tier } from '../shared/rules.ts'
import { validateMuster } from '../shared/muster.ts'
import type { Muster, Report, Side, State } from '../shared/model.ts'
import { retryableStatus } from '../src/lib/requests.ts'
import { capture } from '../shared/strategy.ts'
import { HONOURS } from '../shared/rules.generated.ts'

const run = (
  s: State,
  type: string,
  payload: Record<string, unknown> = {},
  side: Side = 'deathwatch',
) => command(s, { type, payload }, context(side))
function army(s: State, side: Side): Muster {
  const us = s.units.filter((u) => u.side === side)
  return {
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
    dispositions: [],
    commander: us.find((u) => s.snapshot.catalog.find((c) => c.id === u.catalogId)!.character)!.id,
  }
}
function finished(sector: 'X' | 'F' = 'X') {
  const s = fixture()
  s.players.deathwatch.mf = 'D'
  s.players.necrons.mf = 'F'
  declareBattle(s, sector, 'deathwatch', false, context(), sector === 'X' ? 'encounter' : undefined)
  const b = s.battle!
  b.mission = sector === 'X' ? 'encounter' : 'F1'
  b.table = createTable(s, b.mission, context())
  b.table.round = 5
  b.table.step = 'finished'
  b.table.vp = { deathwatch: 10, necrons: 0 }
  for (const side of ['deathwatch', 'necrons'] as Side[]) b.muster[side] = army(s, side)
  s.phase = 'battle'
  const report: Report = {
    vp: b.table.vp,
    units: s.units.map((u) => ({
      id: u.id,
      entered: true,
      destroyed: false,
      distinguished: false,
      withdrawn: false,
      deed: null,
      casualtySources: [],
    })),
    withdrawal: [],
    facts: {},
    retreat: {},
    garrisonRetreat: null,
    narrative: '',
  }
  return { s, report }
}
function aftermath(sector: 'X' | 'F' = 'X') {
  const { s, report } = finished(sector)
  if (sector === 'F') report.retreat.necrons = 'I'
  return run(run(s, 'submit_result', { report }), 'confirm_result', {}, 'necrons')
}
function choices(s: State) {
  const first = s.battle!.eventChooser
  s = run(s, 'event_pass', {}, first)
  return run(s, 'event_pass', {}, first === 'deathwatch' ? 'necrons' : 'deathwatch')
}
function settle(s: State) {
  s = choices(s)
  for (const c of s.battle!.choices)
    s = run(
      s,
      'aftermath_choice',
      { key: c.key, value: c.options[0], unit: c.unitIds[0], sector: c.sectorKeys[0] },
      c.side,
    )
  s = run(s, 'preview_aftermath')
  return run(run(s, 'confirm_aftermath'), 'confirm_aftermath', {}, 'necrons')
}

test('Mouth Opens applies +2 before opening the next still closed Reveal', () => {
  for (const [start, expected] of [
    [0, 4],
    [2, 6],
    [4, 8],
    [8, 8],
  ]) {
    const s = aftermath()
    s.choir = start
    s.battle!.event = '66'
    assert.equal(settle(s).choir, expected)
  }
})

test('Door route expires after the next battle and immediately when its Origin is captured', () => {
  const s = fixture()
  s.effects.push({
    code: '64',
    side: 'deathwatch',
    scope: 'route',
    expires: 1,
    data: { origin: 'D', target: 'F' },
  })
  const captured = structuredClone(s)
  capture(captured, 'D', 'necrons', false)
  assert(!captured.effects.some((e) => e.code === '64'))
  declareBattle(s, 'X', 'deathwatch', false, context(), 'encounter')
  assert(s.battle!.effects.some((e) => e.code === '64'))
  const a = aftermath()
  a.effects = structuredClone(s.effects)
  a.battle!.effects = structuredClone(s.battle!.effects)
  assert(!settle(a).effects.some((e) => e.code === '64'))
})

test('Missing Hour validates the declared action before rolling, including failures', () => {
  const s = fixture()
  s.effects.push({ code: '23', side: 'deathwatch', scope: 'activation', expires: 3, data: {} })
  let rolls = 0
  assert.throws(
    () =>
      command(
        s,
        { type: 'action', payload: { action: 'mobilise' } },
        {
          ...context(),
          dice: () => {
            rolls++
            return 1
          },
        },
      ),
    /Mobilise/,
  )
  assert.equal(rolls, 0)
  const failed = command(
    s,
    { type: 'action', payload: { action: 'forced_march' } },
    context('deathwatch', 1),
  )
  assert.equal(failed.activation!.actions, 1)
  assert.equal(failed.activation!.mp, 2)
  assert(!failed.effects.some((e) => e.code === '23'))
})

test('COMMUNE starts without control, but completes only at end round with control', () => {
  let { s } = finished()
  const b = s.battle!
  b.mission = 'G1'
  b.table = createTable(s, 'G1', context())
  b.table.round = 3
  b.table.step = 'movement'
  const actor = b.muster.deathwatch!.picks[0].id
  s = run(s, 'table_action', { actor, object: '1', kind: 'COMMUNE', eligible: true, inRange: true })
  const payload = {
    id: s.battle!.table.actions[0].id,
    success: true,
    alive: true,
    inRange: true,
    notShocked: true,
    stationary: true,
  }
  s.battle!.table.step = 'end_turn'
  s.battle!.table.objects[0].control = 'deathwatch'
  assert.throws(() => run(s, 'table_complete', payload), /timing/)
  s.battle!.table.step = 'end_round'
  assert.equal(run(s, 'table_complete', payload).battle!.table.vp.deathwatch, 8)
})

test('Blocked armoury cannot be used; damaged permanent item rolls exactly once after use', () => {
  const { s } = finished()
  s.battle!.table.step = 'movement'
  const pick = s.battle!.muster.deathwatch!.picks[0],
    u = s.units.find((u) => u.id === pick.id)!
  pick.armoury = true
  u.armoury = 'relay'
  u.flags.damagedArmoury = true
  const payload = { actor: u.id, item: 'relay' }
  s.battle!.effects.push({
    code: '41',
    side: 'deathwatch',
    scope: 'side_battle',
    expires: 1,
    data: { unit: u.id },
  })
  assert.throws(() => run(s, 'table_use', payload), /заблокировано/)
  s.battle!.effects = []
  const lost = command(s, { type: 'table_use', payload }, context('deathwatch', 1))
  assert.equal(lost.units.find((v) => v.id === u.id)!.armoury, null)
  assert.deepEqual(lost.log.at(-1)!.dice, [1])
  const kept = run(s, 'table_use', payload)
  assert.equal(kept.units.find((v) => v.id === u.id)!.armoury, 'relay')
  assert.equal(kept.units.find((v) => v.id === u.id)!.flags.damagedArmoury, false)
  assert.throws(() => run(kept, 'table_use', payload), /потрачено/)
})
test('D66 cannot change after both players close the event window', () => {
  const s = choices(aftermath())
  s.players.deathwatch.intel = s.players.necrons.intel = 10
  for (const side of ['deathwatch', 'necrons'] as Side[])
    assert.throws(() => run(s, 'event_reroll', {}, side), /очередь/)
})
test('A missing retreat is rejected before locking the result and dice', () => {
  const { s, report } = finished('F')
  assert.throws(() => run(s, 'submit_result', { report }), /соседний свой сектор/)
  report.retreat.necrons = 'K'
  assert.throws(() => run(s, 'submit_result', { report }), /соседний свой сектор/)
  report.retreat.necrons = 'I'
  assert.equal(run(s, 'submit_result', { report }).phase, 'result')
  assert.equal(s.phase, 'battle')
})
test('Initial units cannot claim nonparticipation or false evacuation', () => {
  const { s, report } = finished()
  report.units[0].entered = false
  assert.throws(() => run(s, 'submit_result', { report }), /deployment/)
  report.units[0].entered = true
  report.units[0].withdrawn = true
  assert.throws(() => run(s, 'submit_result', { report }), /Эвакуирован/)
})
test('Hardened Stores cannot improve a Field casualty', () => {
  const { s, report } = finished()
  s.battle!.assets.necrons = { tactical: [], breach: [], defensive: ['stores'] }
  const u = report.units.find((r) => s.units.find((u) => u.id === r.id)!.side === 'necrons')!
  u.destroyed = true
  report.facts.stores_id = u.id
  assert.throws(() => run(s, 'submit_result', { report }), /Hardened Stores/)
})
test('Local deposits only offer sectors owned and supplied after capture', () => {
  const s = choices(aftermath('F'))
  assert(
    s
      .battle!.choices.find((c) => c.kind === 'deposit' && c.side === 'deathwatch')!
      .sectorKeys.includes('F'),
  )
  assert(
    !s
      .battle!.choices.find((c) => c.kind === 'deposit' && c.side === 'necrons')!
      .sectorKeys.includes('F'),
  )
})
test('Applying an aftermath preserves the complete monotonic command journal', () => {
  let s = choices(aftermath())
  for (const c of s.battle!.choices)
    s = run(
      s,
      'aftermath_choice',
      { key: c.key, value: c.options[0], unit: c.unitIds[0], sector: c.sectorKeys[0] },
      c.side,
    )
  s = run(s, 'preview_aftermath')
  s = run(s, 'confirm_aftermath')
  const previous = structuredClone(s.log)
  s = run(s, 'confirm_aftermath', {}, 'necrons')
  assert.deepEqual(s.log.slice(0, -1), previous)
  assert.equal(s.log.at(-1)!.version, s.version)
  assert.equal(s.log.filter((l) => l.command === 'confirm_aftermath').length, 2)
})
test('Static surcharges Recon and Sabotage, but not distant entry', () => {
  const s = fixture()
  s.players.deathwatch.mf = 'B'
  s.players.deathwatch.intel = 2
  s.effects.push({ code: '42', side: null, scope: 'battle', expires: 1, data: {} })
  assert.equal(run(s, 'attack', { target: 'F', method: 'deep' }).players.deathwatch.intel, 0)
  assert.equal(run(s, 'action', { action: 'recon' }).players.deathwatch.intel, 2)
})
test('Home only grants a Defensive Asset after Fortify', () => {
  const s = fixture()
  assert.equal(tier(s, 'A').defAsset, false)
  s.sectors.A.fortified = true
  assert.equal(tier(s, 'A').defAsset, true)
  s.sectors.A.sabotaged = true
  assert.equal(tier(s, 'A').defAsset, false)
})
test('An unaccompanied Home garrison may use its Initial commander, not distant Field units', () => {
  const s = fixture()
  s.stage = 2
  s.players.deathwatch.mf = 'I'
  s.players.necrons.mf = 'J'
  declareBattle(s, 'K', 'deathwatch', false, context())
  const field = army(s, 'necrons')
  assert.throws(() => validateMuster(s, 'necrons', field), /не находится/)
  const u = s.units.find(
    (u) => u.side === 'necrons' && s.snapshot.catalog.find((c) => c.id === u.catalogId)!.battleline,
  )!
  u.location = 'garrison'
  u.sector = 'K'
  const m = {
    ...field,
    picks: [{ ...field.picks.find((p) => p.id === u.id)!, role: 'initial' as const }],
    commander: u.id,
  }
  assert.doesNotThrow(() => validateMuster(s, 'necrons', m))
})
test('STF logistics cannot remotely heal Main Force or service a garrison without Main Force', () => {
  const s = fixture()
  s.phase = 'logistics'
  s.activation!.force = 'stf'
  s.activation!.logistics = ['deathwatch']
  s.players.deathwatch.stf = 'D'
  const u = s.units.find((u) => u.side === 'deathwatch')!
  u.damage = 2
  assert.throws(() => run(s, 'recover', { id: u.id }), /выбранной Force/)
  u.location = 'garrison'
  u.sector = 'D'
  assert.throws(() => run(s, 'recover', { id: u.id }), /Main Force/)
  u.location = 'stf'
  u.sector = null
  const next = run(s, 'recover', { id: u.id })
  assert.equal(next.units.find((v) => v.id === u.id)!.damage, 1)
  assert.equal(next.players.deathwatch.supply, 90) // D's local 10% discount.
})
test('A Field expansion shares the captured-sector purchase cap', () => {
  const s = fixture()
  s.phase = 'logistics'
  s.activation!.logistics = ['deathwatch']
  s.players.deathwatch.mf = 'D'
  s.sectors.D.disrupted = true
  s.players.deathwatch.flags[`disruptedBuy:D:${s.activationCount}`] = 120
  const u = s.units.find(
    (u) =>
      u.side === 'deathwatch' && !s.snapshot.catalog.find((c) => c.id === u.catalogId)!.character,
  )!
  const cat = s.snapshot.catalog.find((c) => c.id === u.catalogId)!
  s.snapshot.catalog.push({ ...cat, id: 'bigger', models: cat.models + 1, rc: cat.rc + 10 })
  assert.throws(() => run(s, 'refit', { id: u.id, catalogId: 'bigger', kind: 'size' }), /Disrupted/)
})
test('Prototype properties are not map sectors', () => {
  for (const value of ['__proto__', 'constructor', 'toString'])
    assert.throws(() => key(value), /сектор/)
})
test('Only uncertain delivery may retry the same request UUID', () => {
  for (const status of [undefined, 408, 429, 500, 503]) assert.equal(retryableStatus(status), true)
  for (const status of [400, 401, 403, 409, 413]) assert.equal(retryableStatus(status), false)
})

test('Ossuary Key awards each ordinary completed Action, and never awards VP in PACT', () => {
  let { s } = finished()
  const b = s.battle!,
    actor = b.muster.deathwatch!.picks[0].id
  s.units.find((u) => u.id === actor)!.relic = 'key'
  b.muster.deathwatch!.picks[0].relic = true
  b.mission = 'G3'
  b.table = createTable(s, 'G3', context())
  for (const round of [1, 2]) {
    s.battle!.table.round = round
    s.battle!.table.step = 'movement'
    s = command(
      s,
      {
        type: 'table_action',
        payload: { actor, object: '1', kind: 'LISTEN', eligible: true, inRange: true },
      },
      { ...context(), id: () => `listen-${round}` },
    )
    s.battle!.table.step = 'end_turn'
    s = run(s, 'table_complete', {
      id: s.battle!.table.actions.at(-1)!.id,
      success: true,
      alive: true,
      inRange: true,
      stationary: true,
      notShocked: true,
    })
  }
  assert.equal(s.battle!.table.vp.deathwatch, 12)
  s.battle!.mission = 'PACT'
  s.battle!.table = createTable(s, 'PACT', context())
  s.battle!.table.step = 'movement'
  s.battle!.table.echoes[0].wounds = 0
  s = run(s, 'table_action', { actor, object: '1', kind: 'ENCODE', eligible: true, inRange: true })
  s.battle!.table.step = 'end_turn'
  s = run(s, 'table_complete', {
    id: s.battle!.table.actions.at(-1)!.id,
    success: true,
    alive: true,
    inRange: true,
    stationary: true,
    notShocked: true,
  })
  assert.equal(s.battle!.table.vp.deathwatch, 0)
})

test('A catalogue update preserves the starting template after casualties and purchases', () => {
  const s = fixture(),
    starter = structuredClone(s.players.deathwatch.starter)
  s.units.find((u) => u.side === 'deathwatch')!.status = 'lost'
  const next = run(s, 'save_catalog', { snapshot: s.snapshot })
  assert.deepEqual(next.players.deathwatch.starter, starter)
})

test('Downsizing after a Stage expansion is legal but cannot reopen growth', () => {
  let s = fixture()
  s.phase = 'logistics'
  s.activation!.logistics = ['deathwatch']
  const u = s.units.find(
    (u) =>
      u.side === 'deathwatch' && !s.snapshot.catalog.find((c) => c.id === u.catalogId)!.character,
  )!
  const oldId = u.catalogId,
    cat = s.snapshot.catalog.find((c) => c.id === oldId)!
  s.snapshot.catalog.push({ ...cat, id: 'smaller', models: cat.models - 1, rc: cat.rc - 10 })
  u.flags.sizeStage = s.stage
  const supply = s.players.deathwatch.supply
  s = run(s, 'refit', { id: u.id, catalogId: 'smaller', kind: 'size' })
  assert.equal(s.players.deathwatch.supply, supply)
  assert.throws(() => run(s, 'refit', { id: u.id, catalogId: oldId, kind: 'size' }), /увеличивался/)
})

test('Incompatible Honour slots can be reassigned once in Logistics', () => {
  const s = fixture()
  s.phase = 'logistics'
  s.activation!.logistics = ['deathwatch']
  const u = s.units.find((u) => u.side === 'deathwatch')!
  const old = HONOURS.find(
    (h) => h.character && h.tier !== 'Signature' && (!h.side || h.side === 'deathwatch'),
  )!
  const next = HONOURS.find(
    (h) => !h.character && h.tier !== 'Signature' && (!h.side || h.side === 'deathwatch'),
  )!
  u.xp = 3
  u.honours = [old.id]
  u.flags.pendingHonours = old.id
  const resolved = run(s, 'claim_honour', { id: u.id, honour: next.id })
  assert.deepEqual(resolved.units.find((v) => v.id === u.id)!.honours, [next.id])
  assert.equal(resolved.units.find((v) => v.id === u.id)!.flags.pendingHonours, '')
  assert.throws(
    () => run(resolved, 'claim_honour', { id: u.id, honour: old.id }),
    /slot|неприменимо/,
  )
})
