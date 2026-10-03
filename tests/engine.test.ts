import { test } from 'node:test'
import assert from 'node:assert/strict'
import { command, project } from '../shared/engine.ts'
import { fixture, context } from './fixture.ts'
import { ADJACENCY, credit, distance, effectPrice, STAGES, supplied } from '../shared/rules.ts'
import { declareBattle } from '../shared/battle.ts'
import { validateMuster } from '../shared/muster.ts'
import type { Muster, Side, State } from '../shared/model.ts'
import { MISSION_CARDS, EVENTS, HONOURS, SCARS } from '../shared/rules.generated.ts'
const run = (
  s: State,
  type: string,
  payload: Record<string, unknown> = {},
  side: Side = 'deathwatch',
  die = 4,
) => command(s, { type, payload }, context(side, die))
function muster(s: State, side: Side): Muster {
  const us = s.units.filter(
    (u) =>
      u.side === side &&
      u.status === 'active' &&
      u.damage < 3 &&
      (u.location === 'field' || u.sector === s.battle?.sector),
  )
  return {
    picks: us.map((u) => ({
      id: u.id,
      role: u.location === 'field' ? 'field' : 'initial',
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
    commander:
      us.find((u) => s.snapshot.catalog.find((c) => c.id === u.catalogId)!.character)?.id ??
      us[0].id,
    dispositions: [],
  }
}
function battleReady(mission = 'F1') {
  let s = fixture()
  s.players.deathwatch.mf = 'D'
  s.players.necrons.mf = 'F'
  declareBattle(s, 'F', 'deathwatch', false, context())
  s = run(s, 'choose_mission', { code: s.battle!.options[0] })
  s.battle!.mission = mission
  importTable(s, mission)
  for (const side of ['deathwatch', 'necrons'] as Side[]) s = run(s, 'mission_pass', {}, side)
  for (const side of ['deathwatch', 'necrons'] as Side[])
    s = run(s, 'recon_lock', { use: false }, side)
  for (const side of ['deathwatch', 'necrons'] as Side[])
    s = run(s, 'commit_muster', { muster: muster(s, side) }, side)
  for (const side of ['deathwatch', 'necrons'] as Side[])
    s = run(s, 'interdict', { asset: null }, side)
  for (const side of ['deathwatch', 'necrons'] as Side[])
    s = run(s, 'commit_assets', { assets: { tactical: [], defensive: [], breach: [] } }, side)
  return s
}
import { createTable } from '../shared/table.ts'
function importTable(s: State, code: string) {
  s.battle!.table = createTable(s, code, context())
}
test('Canonical map is mirrored, G has four links and Home distance is five', () => {
  assert.equal(distance('A', 'K'), 5)
  assert.deepEqual(ADJACENCY.G, ['D', 'E', 'F', 'H'])
  for (const [a, bs] of Object.entries(ADJACENCY))
    for (const b of bs) assert(ADJACENCY[b].includes(a as never))
})
test('Rule tables are complete and formation prices are flat points', () => {
  assert.equal(Object.keys(MISSION_CARDS).length, 33)
  assert.equal(Object.keys(EVENTS).length, 36)
  assert.equal(HONOURS.length, 30)
  assert.equal(SCARS.necrons.length, 12)
  assert.equal(effectPrice('Minor', false, 185, 260), 5)
  assert.equal(effectPrice('Major', false, 185, 260), 10)
  assert.equal(effectPrice('Minor', true, 185, 260), 15)
})
test('Illegal remote contact leaves the entire state untouched', () => {
  const s = fixture(),
    before = JSON.stringify(s)
  assert.throws(() => run(s, 'attack', { target: 'K' }), /соседняя/)
  assert.equal(JSON.stringify(s), before)
})
test('Occupation consumes MP/actions without money, XP, stage or Window reset', () => {
  const s = fixture()
  s.players.deathwatch.mf = 'D'
  const after = run(s, 'attack', { target: 'G' })
  assert.equal(after.players.deathwatch.mf, 'G')
  assert.equal(after.choir, 1)
  assert.equal(after.battles, 0)
  assert.equal(after.players.deathwatch.supply, 100)
  assert.equal(after.window, 0)
  assert.equal(after.phase, 'logistics')
})
test('Shared income window cannot be reopened by changing activation', () => {
  let s = fixture()
  s.players.deathwatch.mf = 'B'
  s = run(s, 'action', { action: 'mobilise' })
  assert.equal(s.players.deathwatch.supply, 150)
  assert.throws(() => run(s, 'action', { action: 'mobilise' }))
  s = run(s, 'end_strategy')
  s = run(s, 'end_logistics')
  assert.equal(s.players.deathwatch.flags.supplyWindow, true)
})
test('Supply uses only controlled paths', () => {
  const s = fixture()
  assert(supplied(s, 'deathwatch', 'D'))
  s.sectors.B.owner = 'necrons'
  assert(!supplied(s, 'deathwatch', 'D'))
  assert(supplied(s, 'deathwatch', 'E'))
})
test('Local money creates Commission and remote purchase cannot use global Supply', () => {
  let s = fixture()
  s.phase = 'logistics'
  s.activation!.logistics = ['deathwatch']
  s.sectors.B.local = 125
  const c = s.snapshot.catalog.find((c) => c.side === 'deathwatch' && !c.character && c.rc <= 125)!
  s = run(s, 'buy_unit', {
    catalogId: c.id,
    name: 'Local defence',
    location: 'garrison',
    sector: 'B',
    local: c.rc,
  })
  const u = s.units.at(-1)!
  assert.equal(u.flags.commission, true)
  assert.equal(s.players.deathwatch.supply, 100)
  assert.throws(
    () =>
      run(s, 'buy_unit', {
        catalogId: c.id,
        name: 'Second',
        location: 'garrison',
        sector: 'B',
        local: 0,
      }),
    /Удалённо/,
  )
  s.players.deathwatch.mf = 'B'
  s.phase = 'strategy'
  s.active = 'deathwatch'
  assert.throws(
    () => run(s, 'action', { action: 'reorganise', id: u.id, location: 'field' }),
    /выкупить/,
  )
})
test('Emergency debt is repaid before any ordinary Supply income', () => {
  const s = fixture()
  s.players.deathwatch.debt = 80
  credit(s, 'deathwatch', 100)
  assert.equal(s.players.deathwatch.debt, 0)
  assert.equal(s.players.deathwatch.supply, 120)
})
test('One paid healing step plus one Overhaul per Window, no negative wallets', () => {
  let s = fixture()
  s.phase = 'logistics'
  s.activation!.logistics = ['deathwatch']
  const u = s.units[0]
  u.damage = 3
  s.players.deathwatch.supply = 500
  s = run(s, 'recover', { id: u.id })
  assert.equal(s.units[0].damage, 2)
  assert.throws(() => run(s, 'recover', { id: u.id }), /Window/)
  s = run(s, 'recover', { id: u.id, overhaul: true })
  assert.equal(s.units[0].damage, 1)
  assert.throws(() => run(s, 'recover', { id: u.id, overhaul: true }), /Overhaul/)
})
test('Trauma can heal 3 to 2 but not below 2', () => {
  let s = fixture()
  s.phase = 'logistics'
  s.activation!.logistics = ['deathwatch']
  s.units[0].damage = 3
  s.units[0].trauma = true
  s = run(s, 'recover', { id: s.units[0].id })
  assert.equal(s.units[0].damage, 2)
  assert.throws(() => run(s, 'recover', { id: s.units[0].id, overhaul: true }), /снизить/)
})
test('Both sealed armies are server validated before reveal; foreign ID rejected', () => {
  const s = battleReady()
  const m = muster(s, 'deathwatch')
  m.picks[0].id = s.units.find((u) => u.side === 'necrons')!.id
  assert.throws(() => validateMuster(s, 'deathwatch', m), /чужой/)
})
test('Empty garrison cannot be faked through RESTING', () => {
  let s = fixture()
  s.players.deathwatch.mf = 'D'
  const u = s.units.find(
    (u) => u.side === 'necrons' && !s.snapshot.catalog.find((c) => c.id === u.catalogId)!.character,
  )!
  u.location = 'garrison'
  u.sector = 'F'
  s = run(s, 'attack', { target: 'F' })
  assert.equal(s.battle!.type, 'garrison')
  assert.equal(s.battles, 0)
  assert.equal(s.sectors.F.owner, 'necrons')
})
test('Full Field battle preparation reaches the table', () => {
  const s = battleReady()
  assert.equal(s.phase, 'battle')
  assert.equal(s.battle!.costs[s.units[0].id], 75)
})
test('Closed muster and F2 secret never appear in opponent projection', () => {
  const s = battleReady('F2')
  s.phase = 'muster'
  delete s.battle!.muster.necrons
  s.battle!.lock = { deathwatch: false, necrons: false }
  const v = project(s, 'necrons')
  assert.equal(v.battle!.muster.deathwatch, undefined)
  assert.equal(v.battle!.table.records.trueSignal, undefined)
})
test('Mission cycle excludes played missions and reroll cannot choose same', () => {
  let s = fixture()
  s.players.deathwatch.mf = 'D'
  s.cycles.F = ['F1', 'F2']
  declareBattle(s, 'F', 'deathwatch', false, context())
  assert.deepEqual(s.battle!.options, ['F3'])
  s = run(s, 'choose_mission', { code: 'F3' })
  assert.throws(() => run(s, 'mission_reroll'), /Другой legal/)
})
test('Command scoring executes once with R5 last-turn compensation', () => {
  let s = battleReady()
  s = run(s, 'table_controls', {
    controls: s.battle!.table.objects.map((o) => ({ id: o.id, side: 'deathwatch' })),
  })
  let guard = 0
  while (s.battle!.table.step !== 'finished' && guard++ < 100)
    s = run(s, 'table_advance', {}, s.battle!.table.turn)
  assert.equal(s.battle!.table.vp.deathwatch, 36)
  assert.equal(s.battle!.table.round, 5)
  assert.equal(guard < 100, true)
})
test('PACT ENCODE can start with live Echo but needs dead Echo at completion', () => {
  const s = battleReady()
  s.battle!.type = 'PACT'
  s.battle!.mission = 'PACT'
  s.battle!.table = createTable(s, 'PACT', context())
  let x = run(s, 'table_advance')
  x = run(x, 'table_advance')
  const actor = x.battle!.muster.deathwatch!.picks[0].id
  x = run(x, 'table_action', { actor, object: '1', kind: 'ENCODE', eligible: true, inRange: true })
  x = run(x, 'table_advance')
  x = run(x, 'table_advance')
  const id = x.battle!.table.actions[0].id
  assert.throws(
    () =>
      run(x, 'table_complete', {
        id,
        success: true,
        alive: true,
        inRange: true,
        notShocked: true,
        stationary: true,
      }),
    /Echo/,
  )
  x = run(x, 'echo_wounds', { index: 0, wounds: 0 })
  x = run(x, 'table_complete', {
    id,
    success: true,
    alive: true,
    inRange: true,
    notShocked: true,
    stationary: true,
  })
  assert.deepEqual(x.battle!.table.objects[0].keys, ['deathwatch'])
})
test('Idle PACT reaches immediate Instability defeat after round four', () => {
  let s = battleReady()
  s.battle!.type = 'PACT'
  s.battle!.mission = 'PACT'
  s.battle!.table = createTable(s, 'PACT', context())
  let guard = 0
  while (s.battle!.table.step !== 'finished' && guard++ < 100)
    s = run(s, 'table_advance', {}, s.battle!.table.turn)
  assert.equal(s.battle!.table.round, 4)
  assert.equal(s.battle!.table.instability, 12)
  assert(s.battle!.table.records.immediateFailure)
})
test('Both result confirmations precede casualties and one aftermath preview', () => {
  let s = battleReady()
  s.battle!.table.step = 'finished'
  s.battle!.table.round = 5
  s.battle!.table.vp.deathwatch = 25
  const report = {
    vp: s.battle!.table.vp,
    units: ['deathwatch', 'necrons'].flatMap((side) =>
      s.battle!.muster[side as Side]!.picks.map((p) => ({
        id: p.id,
        entered: true,
        destroyed: false,
        deed: null,
        distinguished: false,
        casualtySources: [],
        withdrawn: false,
      })),
    ),
    withdrawal: [],
    facts: {},
    retreat: { necrons: 'I' },
    garrisonRetreat: 'I',
    narrative: 'Table facts',
  }
  s = run(s, 'submit_result', { report })
  assert.equal(s.phase, 'result')
  assert.equal(s.players.deathwatch.supply, 100)
  s = run(s, 'confirm_result', {}, 'necrons')
  assert.equal(s.phase, 'aftermath')
  assert.equal(s.battles, 0)
  for (const who of [s.battle!.eventChooser, other(s.battle!.eventChooser)])
    s = run(s, 'event_pass', {}, who)
  for (const ch of [...s.battle!.choices])
    s = run(
      s,
      'aftermath_choice',
      { key: ch.key, value: ch.options[0], unit: ch.unitIds[0], sector: ch.sectorKeys[0] },
      ch.side,
    )
  s = run(s, 'preview_aftermath')
  assert.equal(s.players.deathwatch.supply, 100)
  assert.equal(s.pendingAftermath!.battles, 1)
  s = run(s, 'confirm_aftermath')
  assert.equal(s.battles, 0)
  s = run(s, 'confirm_aftermath', {}, 'necrons')
  assert.equal(s.battles, 1)
  assert.equal(s.phase, 'logistics')
  assert.equal(s.window, 1)
  assert.equal(s.players.deathwatch.supply, 250)
  assert.equal(s.sectors.F.owner, 'deathwatch')
  assert.throws(() => run(s, 'confirm_aftermath'), /Сначала preview/)
  s = run(s, 'end_logistics')
  s = run(s, 'end_logistics', {}, 'necrons')
  assert.equal(s.phase, 'strategy')
  assert.equal(s.active, 'necrons')
})
import { other } from '../shared/model.ts'
test('Terminal WAR has XP and epilogue, but no cash, stage grant or Window', () => {
  let s = battleReady()
  s.battles = 17
  s.stage = 6
  s.battle!.type = 'WAR'
  s.battle!.mission = 'WAR'
  s.battle!.number = 18
  s.battle!.table.step = 'finished'
  s.battle!.table.round = 5
  const report = {
    vp: s.battle!.table.vp,
    units: ['deathwatch', 'necrons'].flatMap((side) =>
      s.battle!.muster[side as Side]!.picks.map((p) => ({
        id: p.id,
        entered: true,
        destroyed: false,
        deed: null,
        distinguished: false,
        casualtySources: [],
        withdrawn: false,
      })),
    ),
    withdrawal: [],
    facts: {},
    retreat: {},
    garrisonRetreat: null,
    narrative: 'Both fail',
  }
  s = run(s, 'submit_result', { report })
  s = run(s, 'confirm_result', {}, 'necrons')
  assert.equal(s.battle!.outcome, 'both_lose')
  for (const ch of [...s.battle!.choices])
    s = run(
      s,
      'aftermath_choice',
      { key: ch.key, value: ch.options[0], unit: ch.unitIds[0] },
      ch.side,
    )
  s = run(s, 'preview_aftermath')
  s = run(s, 'confirm_aftermath')
  s = run(s, 'confirm_aftermath', {}, 'necrons')
  assert.equal(s.phase, 'terminal')
  assert.equal(s.battles, 18)
  assert.equal(s.players.deathwatch.supply, 100)
  assert.equal(s.window, 0)
  assert.equal(s.units[0].xp, 1)
})
