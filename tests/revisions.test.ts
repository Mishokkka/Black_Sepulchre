import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, context } from './fixture.ts'
import { command, project } from '../shared/engine.ts'
import { declareBattle } from '../shared/battle.ts'
import { createTable } from '../shared/table.ts'
import { validateMuster } from '../shared/muster.ts'
import { available } from '../shared/rules.ts'
import { maximumReady } from '../shared/readiness.ts'
import { importLegacy } from '../shared/state.ts'
import type { State, Side, Muster, Report } from '../shared/model.ts'
const run = (
  s: State,
  type: string,
  payload: Record<string, unknown> = {},
  side: Side = 'deathwatch',
  die = 4,
) => command(s, { type, payload }, context(side, die))

test('Foundry discount covers expansion and cannot reset within one activation', () => {
  let s = fixture()
  s.phase = 'logistics'
  s.activation = {
    number: 1,
    side: 'necrons',
    origin: 'J',
    actions: 0,
    mp: 0,
    force: 'mf',
    forcedMarch: false,
    movedSpecial: false,
    logistics: ['necrons'],
    discountUsed: false,
    hadBattle: false,
  }
  s.activationCount = 1
  s.players.necrons.mf = 'J'
  s.players.necrons.supply = 500
  const base = {
    ...s.snapshot.catalog.find((c) => c.side === 'necrons')!,
    id: 'foundry-small',
    datasheet: 'Foundry vehicle',
    size: '1',
    rc: 100,
    character: false,
    epic: false,
    keywords: ['VEHICLE'],
    garrison: 'heavy' as const,
  }
  s.snapshot.catalog.push(base, { ...base, id: 'foundry-large', size: '2', models: 2, rc: 150 })
  s = run(
    s,
    'buy_unit',
    { catalogId: base.id, name: 'Defender', sector: 'J', location: 'garrison' },
    'necrons',
  )
  assert.equal(s.players.necrons.supply, 410)
  const u = s.units.at(-1)!
  s = run(s, 'refit', { id: u.id, catalogId: 'foundry-large', kind: 'size' }, 'necrons')
  assert.equal(s.players.necrons.supply, 360)
  s.activationCount++
  const next = { ...base, id: 'foundry-larger', size: '3', models: 3, rc: 200 }
  s.snapshot.catalog.push(next)
  s.stage = 1
  s = run(s, 'refit', { id: u.id, catalogId: next.id, kind: 'size' }, 'necrons')
  assert.equal(s.players.necrons.supply, 315)
})

test('Automatic legacy import rejects a progressed campaign before discarding upgrades', () => {
  const raw = {
    campaign: {
      id: 'legacy',
      name: 'Legacy',
      battle_count: 1,
      black_choir: 0,
      snapshot_date: '2026-09-30',
      active_side: null,
    },
    players: [],
    sectors: [],
    units: [],
  }
  assert.throws(() => importLegacy(raw, context()), /отдельного перевода/)
})
function muster(s: State, side: Side): Muster {
  const us = s.units.filter(
    (u) => u.side === side && u.location === (s.battle?.forces?.[side] === 'stf' ? 'stf' : 'field'),
  )
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
    commander: us.find((u) => s.snapshot.catalog.find((c) => c.id === u.catalogId)?.character)!.id,
    dispositions: [],
  }
}
function ended() {
  let s = fixture()
  declareBattle(s, 'X', 'deathwatch', false, context(), 'encounter')
  const b = s.battle!
  b.mission = 'encounter'
  b.muster.deathwatch = muster(s, 'deathwatch')
  b.muster.necrons = muster(s, 'necrons')
  for (const side of ['deathwatch', 'necrons'] as Side[])
    Object.assign(b.costs, validateMuster(s, side, b.muster[side]!))
  b.table = createTable(s, 'encounter', context())
  b.table.round = 5
  b.table.step = 'finished'
  s.phase = 'battle'
  const report: Report = {
    vp: { deathwatch: 0, necrons: 0 },
    units: s.units.map((u) => ({
      id: u.id,
      entered: true,
      destroyed: false,
      deed: null,
      distinguished: false,
      casualtySources: [],
      withdrawn: false,
    })),
    withdrawal: [],
    facts: {},
    retreat: {},
    garrisonRetreat: null,
    narrative: 'Original result',
  }
  s = run(s, 'submit_result', { report })
  s = run(s, 'confirm_result', {}, 'necrons')
  return s
}
function settle(s: State) {
  for (const side of [
    s.battle!.eventChooser,
    s.battle!.eventChooser === 'deathwatch' ? 'necrons' : 'deathwatch',
  ] as Side[])
    s = run(s, 'event_pass', {}, side)
  for (const c of s.battle!.choices)
    s = run(
      s,
      'aftermath_choice',
      { key: c.key, value: c.options[0], unit: c.unitIds[0], sector: c.sectorKeys[0] },
      c.side,
    )
  s = run(s, 'preview_aftermath')
  s = run(s, 'confirm_aftermath')
  return run(s, 'confirm_aftermath', {}, 'necrons')
}
test('Report revision replays the saved dice and replaces income, XP and dependent purchases', () => {
  let s = settle(ended())
  const total = s.players.deathwatch.supply
  const event = s.history.at(-1)!.event
  const originalXP = s.units[0].xp
  const c = s.snapshot.catalog[0]
  s = run(s, 'buy_unit', {
    catalogId: c.id,
    name: 'Dependent purchase',
    location: 'field',
    sector: 'A',
  })
  const report = structuredClone(s.history.at(-1)!.report!)
  report.narrative = 'Corrected'
  s = run(s, 'request_correction', { report })
  assert.throws(() => run(s, 'end_logistics'), /остановлены/)
  assert.equal(project(s, 'deathwatch').rollback, null)
  s = run(s, 'approve_correction', {}, 'necrons')
  assert.equal(s.phase, 'result')
  assert.equal(s.units.length, 13)
  s = run(s, 'confirm_result')
  s = run(s, 'confirm_result', {}, 'necrons', 6)
  assert.equal(s.battle!.event, event)
  s = settle(s)
  assert.equal(s.players.deathwatch.supply, total)
  assert.equal(s.units[0].xp, originalXP)
  assert.equal(s.battles, 1)
  assert.equal(s.history.length, 1)
})
test('Catalogue price changes apply immediately for free; missing datasheet keeps persistent identity', () => {
  let s = fixture()
  const snapshot = structuredClone(s.snapshot),
    id = s.units[0].id
  snapshot.catalog[0].rc = 900
  snapshot.catalog.splice(1, 1)
  s = run(s, 'save_catalog', { snapshot })
  assert.equal(s.snapshotProposal, null)
  assert.equal(s.units[0].rc, 900)
  assert.equal(s.players.deathwatch.supply, 100)
  assert.equal(s.units[0].id, id)
  assert(s.units[1].retiredCatalog)
  assert(!available(s, s.units[1]))
  s = run(s, 'end_strategy')
  const old = s.units[1].rc
  s = run(s, 'resolve_retired', { id: s.units[1].id, archive: true })
  assert.equal(s.players.deathwatch.supply, 100 + old)
})
test('STF contact uses its physical origin and half AL, while Contact Clock rejects STF', () => {
  let s = fixture()
  s.players.deathwatch.stf = 'D'
  s.players.necrons.mf = 'F'
  const us = s.units.filter((u) => u.side === 'deathwatch')
  for (const u of us) u.location = 'stf'
  s = run(s, 'select_force', { force: 'stf' })
  assert.equal(s.activation!.origin, 'D')
  s = run(s, 'attack', { target: 'F' })
  assert.equal(s.battle!.origin, 'D')
  assert.equal(s.battle!.forces!.deathwatch, 'stf')
  assert.throws(() => validateMuster(s, 'deathwatch', muster(s, 'deathwatch')), /40%|AL/)
  const quiet = fixture()
  quiet.quiet = 3
  quiet.players.deathwatch.stf = 'A'
  assert.throws(() => run(quiet, 'select_force', { force: 'stf' }), /Contact Clock/)
})
test('Withdrawal cannot be fabricated in a final report', () => {
  let s = ended()
  s.phase = 'result'
  const report = structuredClone(s.battle!.report!)
  report.withdrawal = ['deathwatch']
  report.facts.withdrawal_timing_valid = true
  assert.throws(() => run(s, 'submit_result', { report }), /журналом/)
})
test('Unentered Initial Reserves are destroyed, unentered Pool survives, arrival facts cannot be invented', () => {
  const s = ended()
  s.phase = 'result'
  const b = s.battle!,
    p = b.muster.deathwatch!.picks[0]
  p.reserve = true
  const report = structuredClone(b.report!)
  const r = report.units.find((r) => r.id === p.id)!
  assert.throws(() => run(s, 'submit_result', { report }), /прибытием/)
  r.entered = false
  assert.throws(() => run(s, 'submit_result', { report }), /R3/)
  r.destroyed = true
  assert.doesNotThrow(() => run(s, 'submit_result', { report }))
})
test('Redemption requires the declared deed before commitment', () => {
  const s = ended(),
    p = s.battle!.muster.deathwatch!.picks[0]
  s.units[0].scars = [{ id: 1, progress: false, redemption: 0 }]
  p.redemption = 1
  assert.throws(
    () => validateMuster(s, 'deathwatch', s.battle!.muster.deathwatch!),
    /Redemption Deed/,
  )
  p.redemptionDeed = 'HOLD'
  assert.doesNotThrow(() => validateMuster(s, 'deathwatch', s.battle!.muster.deathwatch!))
})
test('Readiness counts optional active CR, legal Warlord, copies, enhancements and excludes unavailable IDs', () => {
  const s = fixture()
  assert.equal(maximumReady(s, 'deathwatch'), 485)
  const u = s.units[0]
  u.xp = 3
  u.honours = ['pathfinders']
  assert.equal(maximumReady(s, 'deathwatch'), 490)
  s.snapshot.enhancements.push({
    id: 'e',
    name: 'Test enhancement',
    cost: 10,
    eligible: [],
    detachment: s.players.deathwatch.package[0],
  })
  assert.equal(maximumReady(s, 'deathwatch'), 500)
  s.units.find(
    (u) =>
      u.side === 'deathwatch' && s.snapshot.catalog.find((c) => c.id === u.catalogId)!.character,
  )!.damage = 3
  assert.equal(maximumReady(s, 'deathwatch'), 0)
})
test('Full 17-battle progression grants stages once and freezes directly for the crisis', () => {
  let s = fixture()
  for (let game = 1; game <= 17; game++) {
    declareBattle(s, 'X', s.active, false, context(), 'encounter')
    const b = s.battle!
    b.mission = 'encounter'
    b.muster.deathwatch = muster(s, 'deathwatch')
    b.muster.necrons = muster(s, 'necrons')
    for (const side of ['deathwatch', 'necrons'] as Side[])
      Object.assign(b.costs, validateMuster(s, side, b.muster[side]!))
    b.table = createTable(s, 'encounter', context())
    b.table.round = 5
    b.table.step = 'finished'
    s.phase = 'battle'
    const report: Report = {
      vp: b.table.vp,
      units: s.units.map((u) => ({
        id: u.id,
        entered: true,
        destroyed: false,
        deed: null,
        distinguished: false,
        casualtySources: [],
        withdrawn: false,
      })),
      withdrawal: [],
      facts: {},
      retreat: {},
      garrisonRetreat: null,
      narrative: `Battle ${game}`,
    }
    s = run(s, 'submit_result', { report })
    s = run(s, 'confirm_result', {}, 'necrons')
    s = settle(s)
    s = run(s, 'end_logistics')
    s = run(s, 'end_logistics', {}, 'necrons')
    assert.equal(s.battles, game)
    if (game === 12) assert(s.choir >= 2)
    if (game === 14) assert(s.choir >= 4)
    if (game === 16) assert.equal(s.choir, 8)
  }
  assert.equal(s.stage, 6)
  assert.equal(s.phase, 'finale_mode')
  assert.equal(s.players.deathwatch.supply, 100 + 17 * (110 + 20) + 600 + 470)
  s = run(s, 'finale_mode', { mode: 'PACT' })
  assert.equal(project(s, 'necrons').finalModes.deathwatch, 'sealed')
  s = run(s, 'finale_mode', { mode: 'PACT' }, 'necrons')
  assert.equal(s.battle!.number, 18)
  assert.equal(s.battle!.type, 'PACT')
  assert.equal(s.battle!.al, 2000)
})
