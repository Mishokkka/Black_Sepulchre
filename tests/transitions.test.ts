import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, context } from './fixture.ts'
import { command, project } from '../shared/engine.ts'
import { declareBattle } from '../shared/battle.ts'
import { createTable } from '../shared/table.ts'
import { addEffect } from '../shared/state.ts'
import { outcome } from '../shared/aftermath.ts'
import type { Report, Side, State } from '../shared/model.ts'
const run = (
  s: State,
  type: string,
  payload: Record<string, unknown> = {},
  side: Side = 'deathwatch',
  die = 4,
) => command(s, { type, payload }, context(side, die))
function table(mission: string) {
  const s = fixture()
  declareBattle(s, 'F', 'deathwatch', false, context())
  s.battle!.mission = mission
  s.battle!.table = createTable(s, mission, context())
  s.phase = 'battle'
  for (const side of ['deathwatch', 'necrons'] as Side[])
    s.battle!.muster[side] = {
      picks: s.units
        .filter((u) => u.side === side)
        .map((u) => ({
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
      commander: s.units.find((u) => u.side === side)!.id,
      dispositions: [],
    }
  return s
}
test('Contact Clock reaches mandatory battle after three quiet pairs and one activation', () => {
  let s = fixture()
  for (let i = 0; i < 6; i++) {
    const side = s.active
    s = run(s, 'end_strategy', {}, side)
    s = run(s, 'end_logistics', {}, side)
  }
  assert.equal(s.quiet, 3)
  assert.equal(s.phase, 'strategy')
  s = run(s, 'end_strategy', {}, s.active)
  s = run(s, 'end_logistics', {}, s.active)
  assert.equal(s.battle!.type, 'encounter')
  assert.equal(s.battles, 0)
})
test('Unmanned Home takes two separate activations and has no battle income', () => {
  let s = fixture()
  s.stage = 2
  s.players.deathwatch.mf = 'I'
  s.sectors.I.owner = 'deathwatch'
  s.sectors.F.owner = 'deathwatch'
  s.sectors.G.owner = 'deathwatch'
  for (const u of s.units.filter((u) => u.side === 'necrons')) u.damage = 3
  s = run(s, 'attack', { target: 'K' })
  assert.equal(s.players.necrons.integrity, 1)
  assert.equal(s.phase, 'logistics')
  assert.equal(s.battles, 0)
  assert.equal(s.players.deathwatch.supply, 100)
  s = run(s, 'end_logistics')
  s = run(s, 'end_strategy', {}, 'necrons')
  s = run(s, 'end_logistics', {}, 'necrons')
  s = run(s, 'attack', { target: 'K' })
  assert.equal(s.phase, 'ending')
  s = run(s, 'choose_ending', { ending: 'PURGE' })
  assert.equal(s.phase, 'terminal')
  assert.equal(s.battles, 0)
  assert.equal(s.players.deathwatch.supply, 100)
})
test('First Deep Raid G discount is spent only once per Stage', () => {
  const s = fixture()
  s.players.deathwatch.mf = 'B'
  s.sectors.G.owner = 'deathwatch'
  s.players.deathwatch.intel = 3
  const x = run(s, 'attack', { target: 'F', method: 'deep' })
  assert.equal(x.players.deathwatch.intel, 2)
  assert.equal(x.players.deathwatch.flags.gDiscountStage, 0)
})
test('F2 secret is immutable and is redacted from state and dice journal', () => {
  let s = fixture()
  s.players.deathwatch.mf = 'D'
  s.players.necrons.mf = 'F'
  s = run(s, 'attack', { target: 'F' }, 'deathwatch', 2)
  const secret = s.battle!.hiddenSignal
  s = run(s, 'choose_mission', { code: s.battle!.options[0] }, 'deathwatch', 5)
  assert.equal(s.battle!.hiddenSignal, secret)
  if (s.battle!.mission === 'F2') assert.equal(s.battle!.table.records.trueSignal, secret)
  const v = project(s, 'necrons')
  assert.equal(v.battle!.hiddenSignal, '')
  assert.equal(v.battle!.table.records.trueSignal, undefined)
  assert(v.log.every((l) => l.command !== 'attack' || l.dice.length === 0))
})
test('Single Recon Lock reveals the first legal list but never accepts an illegal one', () => {
  let s = fixture()
  declareBattle(s, 'F', 'deathwatch', false, context())
  s.battle!.lock = { deathwatch: true, necrons: false }
  s.phase = 'muster'
  const v = project(s, 'deathwatch')
  assert(!v.battle!.muster.necrons)
  assert.throws(
    () => run(s, 'commit_muster', { muster: { picks: [] } }, 'deathwatch'),
    /Сначала раскрывается/,
  )
})
test('Next-activation token for defending winner expires after its next activation', () => {
  const s = fixture()
  addEffect(s, 'airlift', 'necrons', 'activation')
  assert.equal(s.effects[0].expires, s.activationCount + 1)
})
test('Renewed event during aftermath survives consumption of the old event', () => {
  const s = table('F1')
  addEffect(s, '22', null, 'battle')
  const old = s.effects[0].expires
  s.battle!.aftermathApplied = true
  addEffect(s, '22', null, 'battle')
  assert(s.effects[0].expires > old)
})
test('Withdrawal deadline is same Movement, closes actions and caps VP', () => {
  let s = table('F1')
  s.battle!.table.round = 3
  s.battle!.table.step = 'command'
  s.battle!.table.turn = 'deathwatch'
  s.battle!.table.vp.deathwatch = 40
  s = run(s, 'table_withdrawal')
  assert.equal(s.battle!.table.step, 'movement')
  assert.throws(
    () =>
      run(s, 'table_action', {
        actor: s.units[0].id,
        object: '1',
        kind: 'HACK',
        eligible: true,
        inRange: true,
      }),
    /эвакуации/,
  )
  s = run(s, 'table_advance')
  assert.equal(s.battle!.table.step, 'finished')
  assert.equal(s.battle!.table.vp.deathwatch, 25)
})
test('WAR candidate gate uses permanent seal records, not current tags or plain VP', () => {
  const s = table('WAR')
  s.battle!.type = 'WAR'
  s.battle!.table.records['override:deathwatch'] = true
  s.battle!.table.objects[0].data['hack:deathwatch'] = true
  s.battle!.table.objects[1].data['hack:deathwatch'] = true
  const r = {
    vp: { deathwatch: 0, necrons: 48 },
    facts: { 'engine_alive_oc:deathwatch': true },
  } as unknown as Report
  assert.equal(outcome(s, r), 'deathwatch')
  r.facts['engine_alive_oc:deathwatch'] = false
  assert.equal(outcome(s, r), 'both_lose')
})
test('PACT keys and stationary valid Channelers are all required', () => {
  const s = table('PACT')
  s.battle!.type = 'PACT'
  for (const o of s.battle!.table.objects.filter((o) => o.id !== 'engine'))
    o.keys = ['deathwatch', 'necrons']
  s.battle!.table.primes = {
    deathwatch: s.units[0].id,
    necrons: s.units.find((u) => u.side === 'necrons')!.id,
  }
  const r = {
    vp: { deathwatch: 0, necrons: 0 },
    facts: { 'prime_valid:deathwatch': true, 'prime_valid:necrons': true },
  } as unknown as Report
  assert.equal(outcome(s, r), 'both_win')
  r.facts['prime_valid:necrons'] = false
  assert.equal(outcome(s, r), 'both_lose')
})
test('Emergency Muster restores cheapest legal roster, does not grant cash or battles', () => {
  const s = fixture()
  for (const u of s.units) u.damage = 3
  declareBattle(s, 'X', 'deathwatch', false, context(), 'encounter')
  s.phase = 'muster'
  s.players.deathwatch.supply = 0
  const x = run(s, 'emergency_muster')
  assert.equal(x.units.filter((u) => u.side === 'deathwatch' && u.damage === 2).length, 1)
  assert.equal(x.players.deathwatch.debt, 15)
  assert.equal(x.players.deathwatch.supply, 0)
  assert.equal(x.battles, 0)
  assert.throws(() => run(x, 'emergency_muster'), /Emergency Muster/)
})
