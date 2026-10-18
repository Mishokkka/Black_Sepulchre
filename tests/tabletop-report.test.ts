import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, context } from './fixture.ts'
import { declareBattle } from '../shared/battle.ts'
import { command, project } from '../shared/engine.ts'
import { createTable } from '../shared/table.ts'
import { initialReport, cleanReport } from '../shared/report-form.ts'
import { missionInputs } from '../shared/tabletop-report.ts'
import { outcome } from '../shared/aftermath.ts'
import { casualtyMeaning, SALVAGE_REWARDS } from '../shared/aftermath-help.ts'
import { SIDES, type State, type Report, type Side } from '../shared/model.ts'

function setup(code = 'encounter') {
  const s = fixture()
  declareBattle(s, 'X', 'deathwatch', false, context(), 'encounter')
  const b = s.battle!
  b.mission = code
  b.table = createTable(s, code, context())
  for (const who of SIDES) {
    const us = s.units.filter((u) => u.side === who)
    b.muster[who] = {
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
      detachments: s.players[who].package,
      commander: us[0].id,
      dispositions: [],
    }
    b.assets[who] = { tactical: [], defensive: [], breach: [] }
  }
  s.phase = 'battle'
  return s
}
function send(
  s: State,
  type: string,
  payload: Record<string, unknown> = {},
  actor: Side = 'deathwatch',
) {
  return command(s, { type, payload }, context(actor, 3))
}
function resolve(s: State) {
  s = send(s, 'confirm_result', {}, 'necrons')
  for (let i = 0; i < 2; i++)
    s = send(
      s,
      'event_pass',
      {},
      s.battle!.eventPass.length
        ? SIDES.find((side) => side !== s.battle!.eventChooser)!
        : s.battle!.eventChooser,
    )
  for (const c of s.battle!.choices)
    s = send(
      s,
      'aftermath_choice',
      { key: c.key, value: c.options[0], unit: c.unitIds[0], sector: c.sectorKeys[0] },
      c.side,
    )
  s = send(s, 'preview_aftermath')
  assert.ok(s.pendingAftermath)
  s = send(s, 'confirm_aftermath')
  return send(s, 'confirm_aftermath', {}, 'necrons')
}

test('Offline result skips every table command, requires both confirmations and applies awards once', () => {
  const source = setup(),
    r = initialReport(source.battle!, true)
  r.vp = { deathwatch: 27, necrons: 18 }
  r.units[0].deed = 'HOLD'
  let s = send(source, 'submit_result', { report: r })
  assert.equal(source.battle!.table.step, 'start')
  assert.equal(s.phase, 'result')
  assert.equal(s.battle!.outcome, 'deathwatch')
  assert.equal(s.players.deathwatch.supply, source.players.deathwatch.supply)
  s = resolve(s)
  assert.equal(s.phase, 'logistics')
  assert.equal(s.battles, 1)
  assert.equal(s.units[0].xp, 2)
  // 100 participation +20 winner +15 Salvage +10 supplied E.
  assert.equal(s.players.deathwatch.supply - source.players.deathwatch.supply, 145)
  assert.throws(() => send(s, 'confirm_aftermath'), /preview/)
})

test('The exact stuck pattern: both D66 passes, old result confirmations, one saved deposit, remaining Necron deposit and Xenos Script', () => {
  let s = setup('G3')
  s = send(s, 'submit_result', { report: initialReport(s.battle!, true) })
  s = send(s, 'confirm_result', {}, 'necrons')
  for (const who of [s.battle!.eventChooser, SIDES.find((who) => who !== s.battle!.eventChooser)!])
    s = send(s, 'event_pass', {}, who)
  assert.equal(s.battle!.event, '33')
  assert.equal(s.battle!.confirm.length, 2)
  const dw = s.battle!.choices.find((c) => c.key === 'deposit:deathwatch')!
  s = send(s, 'aftermath_choice', { key: dw.key, value: 'deposit', sector: dw.sectorKeys[0] })
  const before = structuredClone(s)
  for (const ch of s.battle!.choices.filter((c) => c.side === 'necrons')) {
    assert.doesNotThrow(() =>
      send(
        project(s, 'necrons') as State,
        'aftermath_choice',
        { key: ch.key, value: ch.options[0], sector: ch.sectorKeys[0], unit: ch.unitIds[0] },
        'necrons',
      ),
    )
    s = send(
      s,
      'aftermath_choice',
      { key: ch.key, value: ch.options[0], sector: ch.sectorKeys[0], unit: ch.unitIds[0] },
      'necrons',
    )
  }
  assert.throws(
    () =>
      send(before, 'aftermath_choice', { key: 'deposit:necrons', value: 'deposit', sector: 'F' }),
    /закрыт/,
  )
  s = send(s, 'preview_aftermath')
  assert.ok(s.pendingAftermath)
  assert.equal(s.pendingAftermath!.sectors.F.local, before.sectors.F.local + 25)
  assert.equal(s.battle!.confirm.length, 0)
})

test('Reserve participation is entered after the game; absent pool and transports retain validation', () => {
  const s = setup(),
    b = s.battle!,
    pick = b.muster.deathwatch!.picks[0]
  pick.reserve = true
  let r = initialReport(b, true)
  assert.equal(r.units[0].entered, false)
  r.units[0].entered = true
  r.units[0].destroyed = false
  r = cleanReport(s, b, r)
  assert.equal(r.units[0].entered, true)
  assert.doesNotThrow(() => send(s, 'submit_result', { report: r }))
  pick.role = 'pool'
  r.units[0].entered = false
  r.units[0].destroyed = true
  assert.throws(() => send(s, 'submit_result', { report: r }), /Pool/)
})

test('Mission awards follow cards: H2 sixes add Supply and Choir, E3 SEARCH only Supply; replacement never doubles', () => {
  for (const code of ['H2', 'E3']) {
    let s = setup(code),
      r = initialReport(s.battle!, true)
    r.facts['supplySixes:deathwatch'] = 2
    s = send(s, 'submit_result', { report: r })
    s = send(s, 'submit_result', { report: r })
    assert.equal(s.battle!.table.records['supply10:deathwatch'], 2)
    assert.equal(!!s.battle!.table.records['shatter6:deathwatch'], code === 'H2')
    const result = resolve(s)
    assert.equal(result.choir, code === 'H2' ? 1 : 0)
    assert.equal(result.players.deathwatch.supply - s.players.deathwatch.supply, 155)
  }
  const s = setup('E2')
  assert.ok(
    !missionInputs(s, s.battle!, initialReport(s.battle!, true)).some((f) =>
      f.key.startsWith('supplySixes'),
    ),
  )
})

test('Special outcomes use the post-battle facts, not stale table state', () => {
  let s = setup('A3'),
    r = initialReport(s.battle!, true)
  r.vp = { deathwatch: 50, necrons: 0 }
  r.facts.throne_control = 'deathwatch'
  assert.equal(outcome(s, r), 'necrons')
  r.facts.claim = true
  assert.equal(outcome(s, r), 'deathwatch')
  s = setup('WAR')
  s.battle!.type = 'WAR'
  r = initialReport(s.battle!, true)
  r.facts = {
    'override:deathwatch': true,
    'seals:deathwatch': 2,
    'engine_alive_oc:deathwatch': true,
  }
  assert.equal(outcome(s, r), 'deathwatch')
  s = setup('PACT')
  s.battle!.type = 'PACT'
  r = initialReport(s.battle!, true)
  r.facts = {
    pact_keys: true,
    'prime:deathwatch': true,
    'prime:necrons': true,
    'prime_valid:deathwatch': true,
    'prime_valid:necrons': true,
  }
  assert.equal(outcome(s, r), 'both_win')
  r.facts.pact_failed = true
  assert.equal(outcome(s, r), 'both_lose')
})

test('Offline validation rejects excess rewards, invalid VP, early withdrawal and two deeds in one Attached formation', () => {
  const s = setup('D2'),
    r = initialReport(s.battle!, true)
  r.facts = { 'supplySixes:deathwatch': 4, 'supplySixes:necrons': 1 }
  assert.throws(() => send(s, 'submit_result', { report: r }), /объектов/)
  r.facts = {}
  r.vp.deathwatch = 51
  assert.throws(() => send(s, 'submit_result', { report: r }))
  r.vp.deathwatch = 0
  r.withdrawal = ['deathwatch']
  r.facts = { withdrawal_timing_valid: true, withdrawal_round: 2 }
  assert.throws(() => send(s, 'submit_result', { report: r }), /Command/)
  r.withdrawal = []
  s.battle!.muster.deathwatch!.picks[1].formation = s.battle!.muster.deathwatch!.picks[0].formation
  r.units[0].deed = 'HOLD'
  r.units[1].deed = 'OPERATE'
  assert.throws(() => send(s, 'submit_result', { report: r }), /общий Deed/)
})

test('Casualty and Salvage explanations match rule thresholds', () => {
  assert.equal(SALVAGE_REWARDS[2], '+15 Supply')
  assert.match(casualtyMeaning(-1, true), /Critical/)
  assert.doesNotMatch(casualtyMeaning(0, false), /Critical/)
  assert.equal(casualtyMeaning(2), '+2 Damage')
  assert.equal(casualtyMeaning(7), 'Без нового Damage, +1 XP')
})

test('Migrating an old mission separates overlay rewards from its own Intel and node XP', () => {
  const s = setup('I1'),
    b = s.battle!,
    u = b.before[0]
  b.table.records[`xp:${u.id}`] = 3
  b.table.records[`intel:${u.side}`] = 1
  b.table.records[`index:${u.side}`] = u.id
  b.table.actions.push({
    kind: 'SYNCHRONISE',
    side: u.side,
    actor: u.id,
    success: true,
  } as (typeof b.table.actions)[number])
  const r = initialReport(b, true)
  assert.equal(r.facts[`nodeXP:${u.id}`], 1)
  assert.equal(r.facts[`hacks:${u.side}`], 0)
  assert.equal(r.facts[`scanSixes:${u.side}`], 0)
  assert.equal(r.facts[`sync:${u.side}`], u.id)
})
