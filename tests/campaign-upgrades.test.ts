import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, context } from './fixture.ts'
import { command } from '../shared/engine.ts'
import { declareBattle } from '../shared/battle.ts'
import { createTable } from '../shared/table.ts'
import { initialReport, reportFields } from '../shared/report-form.ts'
import { validateMuster } from '../shared/muster.ts'
import { entry, surcharge, armouryBlocked } from '../shared/rules.ts'
import { packageEnhancementImpact, bindEnhancement } from '../shared/enhancements.ts'
import { honourEligible, defaultActiveHonours } from '../shared/campaign-upgrades.ts'
import { logisticsPreview } from '../shared/logistics-preview.ts'
import type { State, Side, Muster } from '../shared/model.ts'

const run = (s: State, type: string, payload = {}, side: Side = 'deathwatch', die = 4) =>
  command(s, { type, payload }, context(side, die))
function logistics() {
  const s = fixture()
  s.phase = 'logistics'
  s.activation!.logistics = ['deathwatch']
  s.players.deathwatch.supply = 500
  return s
}
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
    commander: us.find((u) => entry(s, u).character)!.id,
  }
}
function finished() {
  const s = fixture()
  s.players.deathwatch.mf = 'D'
  s.players.necrons.mf = 'F'
  declareBattle(s, 'X', 'deathwatch', false, context(), 'encounter')
  const b = s.battle!
  b.mission = 'encounter'
  b.table = createTable(s, b.mission, context())
  b.table.step = 'finished'
  b.table.vp = { deathwatch: 10, necrons: 0 }
  for (const side of ['deathwatch', 'necrons'] as Side[]) b.muster[side] = army(s, side)
  s.phase = 'battle'
  return s
}
function preview(s: State, die = 4) {
  s = run(s, 'event_pass', {}, s.battle!.eventChooser)
  s = run(s, 'event_pass', {}, s.battle!.eventChooser === 'deathwatch' ? 'necrons' : 'deathwatch')
  for (const c of s.battle!.choices)
    s = run(
      s,
      'aftermath_choice',
      { key: c.key, value: c.options[0], unit: c.unitIds[0], sector: c.sectorKeys[0] },
      c.side,
    )
  return run(s, 'preview_aftermath', {}, 'deathwatch', die)
}
function aftermath(s: State, report = initialReport(s.battle!)) {
  s = run(s, 'submit_result', { report })
  s = run(s, 'confirm_result', {}, 'necrons')
  s.battle!.event = '15'
  s.battle!.eventOptions = []
  return s
}

test('Package change releases every bearer and starter once, retains other detachments and never pays Supply', () => {
  let s = logistics()
  s.stage = 3
  const p = s.players.deathwatch
  p.packageStage = -1
  const [old, retained, added] = s.snapshot.detachments.filter((d) => d.side === 'deathwatch')
  p.package = [old.id, retained.id]
  const us = s.units.filter((u) => u.side === 'deathwatch').slice(0, 3)
  s.snapshot.enhancements.push(
    {
      id: 'audit-upgrade',
      name: 'Upgrade',
      detachment: old.id,
      cost: 20,
      eligible: [],
      upgrade: true,
    },
    { id: 'retained', name: 'Retained', detachment: retained.id, cost: 10, eligible: [] },
  )
  bindEnhancement(
    p,
    'audit-upgrade',
    us.map((u) => u.id),
  )
  bindEnhancement(p, 'retained', [us[0].id])
  p.startingEnhancements = { [us[0].id]: 'audit-upgrade' }
  us[0].armoury = 'plating'
  us[0].relic = 'key'
  us[0].honours = ['hard_lessons']
  us[0].scars = [{ id: 1, progress: false, redemption: 0 }]
  const before = structuredClone(s)
  assert.equal(packageEnhancementImpact(s, 'deathwatch', [retained.id, added.id]).points, 60)
  assert.deepEqual(s, before)
  assert.equal(
    logisticsPreview(s, 'deathwatch', 'package', { package: [retained.id, added.id] }).allowed,
    true,
  )
  assert.throws(() => run(s, 'package', { package: [] }), /Package/)
  assert.deepEqual(s, before)
  s = run(s, 'package', { package: [retained.id, added.id] })
  assert.deepEqual(s.players.deathwatch.enhancements, { retained: us[0].id })
  assert.deepEqual(s.players.deathwatch.enhancementExtras, {})
  assert.deepEqual(s.players.deathwatch.startingEnhancements, {})
  assert.equal(s.players.deathwatch.supply, 500)
  assert.deepEqual(s.units, before.units)
  assert.equal(packageEnhancementImpact(s, 'deathwatch', s.players.deathwatch.package).points, 0)
})

test('Doctrine Refit charges only 25 Supply and returning a detachment does not restore enhancements', () => {
  let s = fixture()
  s.players.deathwatch.supply = 500
  const e = s.snapshot.enhancements.find((e) => e.detachment === s.players.deathwatch.package[0])!
  bindEnhancement(s.players.deathwatch, e.id, [s.units[0].id])
  const next = s.snapshot.detachments.find((d) => d.side === 'deathwatch' && d.id !== e.detachment)!
  s = run(s, 'action', { action: 'doctrine', package: [next.id] })
  assert.equal(s.players.deathwatch.supply, 475)
  assert.deepEqual(s.players.deathwatch.enhancements, {})
  s = run(s, 'action', { action: 'doctrine', package: [e.detachment] })
  assert.deepEqual(s.players.deathwatch.enhancements, {})
  assert.equal(s.players.deathwatch.supply, 450)
})

test('Armoury purchase, stock assignment, slot blocking and free discard have exact costs', () => {
  let s = logistics(),
    u = s.units[0]
  s = run(s, 'buy_armoury', { item: 'medicae' })
  assert.equal(s.players.deathwatch.supply, 485)
  assert.deepEqual(s.players.deathwatch.inventory, ['medicae'])
  assert.throws(() => run(s, 'buy_armoury', { item: 'plating' }), /Consumables/)
  s = run(s, 'assign_armoury', { id: u.id, item: 'medicae' })
  assert.equal(s.players.deathwatch.supply, 485)
  assert.deepEqual(s.players.deathwatch.inventory, [])
  assert.throws(() => run(s, 'buy_armoury', { id: u.id, item: 'plating' }), /Slot/)
  s = run(s, 'discard_armoury', { id: u.id })
  assert.equal(s.players.deathwatch.supply, 485)
  u = s.units[0]
  u.flags.damagedArmoury = true
  s = run(s, 'buy_armoury', { id: u.id, item: 'plating' })
  assert.equal(s.players.deathwatch.supply, 455)
  assert.equal(s.units[0].flags.damagedArmoury, false)
  s = run(s, 'discard_armoury', { id: u.id })
  s.units[0].scars.push({ id: 4, progress: false, redemption: 0 })
  assert.throws(() => run(s, 'buy_armoury', { id: u.id, item: 'medicae' }), /Slot/)
})

test('Relic replacement returns the old item to stock; transfer costs 10 and requires both local non-Epic slots', () => {
  let s = logistics()
  const from = s.units[0],
    to = s.units[1]
  s.players.deathwatch.relics = ['key', 'key', 'shard']
  from.relic = 'lens'
  s = run(s, 'assign_relic', { id: from.id, item: 'key' })
  assert.deepEqual(s.players.deathwatch.relics, ['key', 'shard', 'lens'])
  assert.equal(s.players.deathwatch.supply, 500)
  s = run(s, 'transfer_relic', { from: from.id, to: to.id })
  assert.equal(s.players.deathwatch.supply, 490)
  assert.equal(s.units[0].relic, null)
  assert.equal(s.units[1].relic, 'key')
  assert.throws(
    () =>
      run(s, 'transfer_relic', { from: to.id, to: s.units.find((u) => u.side === 'necrons')!.id }),
    /чужой/,
  )
  s.players.deathwatch.mf = 'D'
  s.units[0].location = 'garrison'
  s.units[0].sector = 'A'
  assert.throws(() => run(s, 'transfer_relic', { from: to.id, to: from.id }), /при своей Force/)
})

test('Honours enforce XP slots, character/Epic/Pathfinders eligibility and legendary active Major limit', () => {
  let s = logistics()
  const u = s.units[0],
    body = s.units[1]
  assert.throws(() => run(s, 'claim_honour', { id: u.id, honour: 'hard_lessons' }), /slot/)
  u.xp = 3
  s = run(s, 'claim_honour', { id: u.id, honour: 'hard_lessons' })
  assert.throws(() => run(s, 'claim_honour', { id: u.id, honour: 'hard_lessons' }), /неприменимо/)
  assert.throws(() => run(s, 'claim_honour', { id: u.id, honour: 'hold_fast' }), /slot/)
  body.xp = 3
  assert.equal(honourEligible('command_presence', entry(s, body)), false)
  const c = entry(s, u)
  assert.equal(honourEligible('pathfinders', { ...c, keywords: ['VEHICLE'] }), false)
  assert.equal(honourEligible('hard_lessons', { ...c, epic: true }), false)
  const legendary = {
    ...u,
    xp: 18,
    honours: ['last_line', 'operational_mastery', 'no_step_back', 'the_watch_endures'],
  }
  assert.deepEqual(defaultActiveHonours({ ...legendary, xp: 12 }, c), ['last_line'])
  assert.deepEqual(defaultActiveHonours(legendary, c), [
    'last_line',
    'operational_mastery',
    'the_watch_endures',
  ])
})

test('CR is charged once per bearer from Attached RC; inactive and blocked Armoury is free', () => {
  const s = finished(),
    m = s.battle!.muster.deathwatch!,
    u = s.units[0],
    body = s.units[1]
  u.honours = ['dig_in']
  u.armoury = 'beacon'
  u.relic = 'anchor'
  const p = m.picks[0]
  p.formation = body.id
  m.picks[1].formation = body.id
  p.honours = ['dig_in']
  p.armoury = true
  p.relic = true
  const total = u.rc + body.rc,
    minor = Math.max(5, Math.ceil((total * 0.05) / 5) * 5),
    major = Math.max(10, Math.ceil((total * 0.1) / 5) * 5)
  assert.equal(surcharge(s, u, p, m.picks), minor * 2 + major)
  u.scars = [{ id: 4, progress: false, redemption: 0 }]
  assert.equal(armouryBlocked(s, u), true)
  assert.equal(surcharge(s, u, p, m.picks), minor + major)
  p.honours = []
  p.relic = false
  p.armoury = false
  assert.equal(surcharge(s, u, p, m.picks), 0)
  p.relic = true
  u.relic = null
  assert.throws(() => validateMuster(s, 'deathwatch', m), /Предмет/)
})

test('Rehab failure grants Progress, repeat needs a new Window; guaranteed rehab releases Trauma', () => {
  let s = logistics()
  const u = s.units[0]
  u.scars = [{ id: 1, progress: false, redemption: 0 }]
  u.trauma = true
  s = run(s, 'rehabilitate', { id: u.id, scar: 1 }, 'deathwatch', 1)
  assert.equal(s.units[0].scars[0].progress, true)
  const cost = Math.max(10, Math.ceil((u.rc * 0.2) / 5) * 5)
  assert.equal(s.players.deathwatch.supply, 500 - cost)
  assert.throws(() => run(s, 'rehabilitate', { id: u.id, scar: 1 }), /Window/)
  s.units[0].flags.rehabWindow = false
  s = run(s, 'rehabilitate', { id: u.id, scar: 1 }, 'deathwatch', 1)
  assert.deepEqual(s.units[0].scars, [])
  assert.equal(s.units[0].trauma, false)
  assert.equal(s.players.deathwatch.supply, 500 - cost * 2)
})

test('Cache is consumed only for a legal recovery step and cannot bypass Scar, Damage or Window limits', () => {
  let s = logistics()
  const u = s.units[0]
  u.damage = 1
  u.armoury = 'cache'
  u.rc = 100
  u.scars = [{ id: 4, progress: false, redemption: 0 }]
  assert.throws(() => run(s, 'recover', { id: u.id, cache: true }), /Cache/)
  u.scars = []
  s = run(s, 'recover', { id: u.id, cache: true })
  assert.equal(s.units[0].armoury, null)
  assert.equal(s.units[0].damage, 0)
  assert.equal(s.players.deathwatch.supply, 500)
  assert.throws(() => run(s, 'recover', { id: u.id, cache: true }), /Window|Damage|лечить/)
})

test('Medicae uses entry-state eligibility: a newly rolled blocking Scar does not undo prevention', () => {
  let s = finished()
  const u = s.units[0],
    b = s.battle!
  u.armoury = 'medicae'
  b.before = structuredClone(s.units)
  b.muster.deathwatch!.picks[0].armoury = true
  const report = initialReport(b)
  report.units[0].destroyed = true
  report.units[0].usedMedicae = true
  s = aftermath(s, report)
  s.battle!.casualties[0].die = 1
  const p = preview(s, 4)
  const next = p.pendingAftermath!.units[0]
  assert.equal(next.scars[0].id, 4)
  assert.equal(next.damage, 1)
  assert.equal(next.armoury, null)
  assert.deepEqual(s.units[0].scars, [])
  assert.throws(() => run(p, 'preview_aftermath'), /Preview уже зафиксирован/)
})

test('Medicae stays equipped without new Damage; an entry blocked slot cannot use it', () => {
  let s = finished()
  const u = s.units[0],
    b = s.battle!
  u.armoury = 'medicae'
  b.before = structuredClone(s.units)
  b.muster.deathwatch!.picks[0].armoury = true
  const report = initialReport(b)
  report.units[0].destroyed = true
  report.units[0].usedMedicae = true
  s = aftermath(s, report)
  s.battle!.casualties[0].die = 4
  assert.equal(preview(s).pendingAftermath!.units[0].armoury, 'medicae')
  b.before[0].scars = [{ id: 4, progress: false, redemption: 0 }]
  assert.equal(reportFields(s, b, report.units[0]).medicae, false)
})

test('A newly received Memory Bleed/Gene-seed Shock cannot be redeemed in its acquisition battle', () => {
  let s = finished()
  const report = initialReport(s.battle!)
  report.units[0].destroyed = true
  report.units[0].deed = 'OPERATE'
  s = aftermath(s, report)
  s.battle!.casualties[0].die = 1
  const p = preview(s, 10) // The legacy Librarian omits PSYKER, so Scar 6 is excluded.
  assert.equal(p.pendingAftermath!.units[0].scars[0].id, 11)
  assert.equal(p.pendingAftermath!.units[0].xp, 2)
})

test('Existing Memory/Gene-seed Shock follows its specific Deed, not EXTRACT; participation stays blocked', () => {
  for (const deed of ['EXTRACT', 'OPERATE'] as const) {
    let s = finished()
    const u = s.units[0]
    u.scars = [{ id: 11, progress: false, redemption: 0 }]
    s.battle!.before = structuredClone(s.units)
    const report = initialReport(s.battle!)
    report.units[0].deed = deed
    s = aftermath(s, report)
    const next = preview(s).pendingAftermath!.units[0]
    assert.equal(next.scars.length, deed === 'OPERATE' ? 0 : 1)
    assert.equal(next.xp, 1)
  }
})

test('Command Scars require two declared OPERATE battles; other Deeds cannot fill progress', () => {
  const s = finished(),
    u = s.units[0],
    m = s.battle!.muster.deathwatch!
  u.scars = [{ id: 8, progress: false, redemption: 0 }]
  m.picks[0].redemption = 8
  m.picks[0].redemptionDeed = 'EXTRACT'
  assert.throws(() => validateMuster(s, 'deathwatch', m), /OPERATE/)
  m.picks[0].redemptionDeed = 'OPERATE'
  assert.doesNotThrow(() => validateMuster(s, 'deathwatch', m))
})

test('Lost/Disband clears equipment without returning a Relic to stock', () => {
  let s = logistics()
  const u = s.units[0]
  u.armoury = 'plating'
  u.relic = 'key'
  u.xp = 8
  s = run(s, 'disband', { id: u.id })
  assert.equal(s.units[0].status, 'archived')
  assert.equal(s.units[0].relic, null)
  assert.equal(s.units[0].armoury, null)
  assert.deepEqual(s.players.deathwatch.relics, [])
  assert.equal(s.units[0].xp, 8)
})

test('Deep Reconstruction and Corpse Ledger have their own exact costs and consume the shared Rehab Window', () => {
  let s = logistics(),
    u = s.units[0]
  u.scars = [{ id: 1, progress: false, redemption: 0 }]
  u.flags.rehabLedger = true
  const cost = Math.max(20, Math.ceil((u.rc * 0.35) / 5) * 5)
  s = run(s, 'rehabilitate', { id: u.id, scar: 1, deep: true }, 'deathwatch', 1)
  assert.deepEqual(s.units[0].scars, [])
  assert.equal(s.players.deathwatch.supply, 500 - cost)
  assert.equal(s.units[0].flags.rehabLedger, false)
  assert.equal(s.units[0].flags.rehabWindow, true)
  s = logistics()
  u = s.units[0]
  u.scars = [{ id: 1, progress: false, redemption: 0 }]
  u.flags.rehabLedger = true
  s = run(s, 'rehabilitate', { id: u.id, scar: 1 }, 'deathwatch', 2)
  assert.deepEqual(s.units[0].scars, [])
  assert.equal(s.units[0].flags.rehabLedger, false)
})

test('Armoury rewards recheck the final slot after Casualty and use their source compensation', () => {
  let s = finished()
  const report = initialReport(s.battle!)
  report.units[0].destroyed = true
  s = aftermath(s, report)
  s.battle!.event = '16'
  s.battle!.casualties[0].die = 1
  s = run(s, 'event_pass', {}, s.battle!.eventChooser)
  s = run(s, 'event_pass', {}, s.battle!.eventChooser === 'deathwatch' ? 'necrons' : 'deathwatch')
  const reward = s.battle!.choices.find((c) => c.kind === '16')!
  s.battle!.table.records.damagedArmoury = 'plating'
  for (const c of s.battle!.choices)
    s = run(
      s,
      'aftermath_choice',
      {
        key: c.key,
        value: c === reward ? 'item' : c.options[0],
        unit: c === reward ? s.units[0].id : c.unitIds[0],
        sector: c.sectorKeys[0],
      },
      c.side,
    )
  const blocked = run(s, 'preview_aftermath')
  assert.equal(blocked.pendingAftermath!.units[0].scars[0].id, 4)
  assert.equal(blocked.pendingAftermath!.units[0].armoury, null)
  const paid = structuredClone(s)
  paid.battle!.choices.find((c) => c.kind === '16')!.value = 'supply'
  assert.equal(
    blocked.pendingAftermath!.players.deathwatch.supply,
    run(paid, 'preview_aftermath').pendingAftermath!.players.deathwatch.supply,
  )
})

test('Optional Field Engineers and Ossuary Key can be saved for a later Action; each use is then spent once', () => {
  let s = finished(),
    b = s.battle!
  const actor = s.units[0].id
  s.units[0].relic = 'key'
  b.muster.deathwatch!.picks[0].relic = true
  b.muster.deathwatch!.picks[0].honours = ['field_engineers']
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
      { ...context(), id: () => `audit-listen-${round}` },
    )
    s.battle!.table.step = 'end_turn'
    s = run(s, 'table_complete', {
      id: s.battle!.table.actions.at(-1)!.id,
      success: true,
      alive: true,
      stationary: true,
      notShocked: true,
      inRange: true,
      fieldEngineers: round !== 1,
      ossuaryKey: round !== 1,
    })
    if (round === 1) assert.equal(s.battle!.table.records[`use:deathwatch:${actor}:key`], undefined)
  }
  assert.equal(s.battle!.table.vp.deathwatch, 11)
  assert.equal(s.battle!.table.records['jamUntil:1'], 3)
})

test('Honour Action permissions spend the selected use once, prohibit Advance + Shoot and share no duplicate manual tracker', () => {
  let s = finished()
  const b = s.battle!,
    actor = s.units[0].id
  b.mission = 'G3'
  b.table = createTable(s, 'G3', context())
  b.table.step = 'movement'
  b.muster.deathwatch!.picks[0].honours = [
    'operational_mastery',
    'black_spear_veteran',
    'secure_and_extract',
  ]
  const action = { actor, object: '1', kind: 'LISTEN', eligible: true, inRange: true }
  assert.throws(
    () => run(s, 'table_action', { ...action, advanced: true, actionShoot: true }),
    /не разрешает Shoot/,
  )
  assert.throws(
    () => run(s, 'table_use', { actor, item: 'operational_mastery' }),
    /при выполнении Action/,
  )
  s = run(s, 'table_action', { ...action, actionShoot: true, actionHonour: 'operational_mastery' })
  assert.equal(s.battle!.table.records[`use:deathwatch:${actor}:operational_mastery`], true)
  s.battle!.table.round = 2
  assert.throws(
    () =>
      run(s, 'table_action', { ...action, actionShoot: true, actionHonour: 'operational_mastery' }),
    /израсходовано/,
  )
  s = run(s, 'table_action', { ...action, actionShoot: true, actionHonour: 'black_spear_veteran' })
  assert.equal(s.battle!.table.records[`use:deathwatch:${actor}:black_spear_veteran`], true)
})

test('Scar bonus tracker requires an owned applicable Scar and arrival; penalties remain and second use is rejected', () => {
  let s = finished()
  s.battle!.table.step = 'movement'
  const actor = s.units[0].id
  s.units[0].scars = [{ id: 1, progress: false, redemption: 0 }]
  assert.throws(() => run(s, 'table_use', { actor, item: 'scar:8' }), /не активно/)
  s = run(s, 'table_use', { actor, item: 'scar:1' })
  assert.equal(s.units[0].scars.length, 1)
  assert.throws(() => run(s, 'table_use', { actor, item: 'scar:1' }), /потрачено/)
  s.battle!.table.records = {}
  s.battle!.muster.deathwatch!.picks[0].reserve = true
  assert.throws(() => run(s, 'table_use', { actor, item: 'scar:1' }), /не прибыл/)
})
