import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, context } from './fixture.ts'
import { command } from '../shared/engine.ts'
import { available } from '../shared/rules.ts'
import {
  availabilityReasons,
  filterRoster,
  forceBudgets,
  logisticsJournal,
  rosterUnits,
  unitAttention,
} from '../shared/roster.ts'
import { logisticsPreview } from '../shared/logistics-preview.ts'

test('Attention flags do not invent battle unavailability for Trauma, Commission or a pending Honour', () => {
  const s = fixture(),
    u = s.units.find((u) => u.side === 'deathwatch')!
  u.damage = 2
  u.trauma = true
  u.flags.commission = true
  u.flags.pendingHonours = 'test'
  assert.equal(available(s, u), true)
  assert.deepEqual(availabilityReasons(s, u), [])
  assert.deepEqual(
    unitAttention(s, u).map((i) => i.key),
    ['damage', 'trauma', 'honour', 'commission'],
  )
  u.flags.ammunitionDue = true
  u.evacDebt = 15
  u.flags.outOfAction = true
  assert.equal(available(s, u), false)
  assert.ok(unitAttention(s, u).some((i) => i.key === 'ammo'))
  assert.ok(availabilityReasons(s, u).some((reason) => reason.includes('Out of Action')))
  assert.ok(availabilityReasons(s, u).some((reason) => reason.includes('15')))
})
test('Roster search and filters combine without changing the campaign, retaining damaged available units', () => {
  const s = fixture(),
    u = s.units.find((u) => u.side === 'deathwatch')!
  u.name = 'Пятый дозор'
  u.damage = 1
  u.location = 'garrison'
  u.sector = 'B'
  u.xp = 8
  const before = structuredClone(s),
    query = { search: 'ДОЗОР', location: 'garrison', status: 'damaged', role: '', sort: 'xp' }
  assert.deepEqual(
    filterRoster(s, 'deathwatch', query).map((v) => v.id),
    [u.id],
  )
  assert.equal(filterRoster(s, 'deathwatch', { ...query, status: 'ready' }).length, 0)
  assert.equal(filterRoster(s, 'necrons', query).length, 0)
  assert.deepEqual(
    filterRoster(s, 'deathwatch', { ...query, search: u.id }).map((v) => v.id),
    [u.id],
  )
  assert.deepEqual(s, before)
})
test('Field and STF counters match their different status rules and exclude archived IDs', () => {
  const s = fixture(),
    us = rosterUnits(s, 'deathwatch')
  us.forEach((u) => (u.status = 'archived'))
  us[0].status = 'active'
  us[0].location = 'field'
  us[1].status = 'displaced'
  us[1].location = 'field'
  us[2].status = 'active'
  us[2].location = 'stf'
  us[3].status = 'displaced'
  us[3].location = 'stf'
  us[4].status = 'active'
  us[4].location = 'garrison'
  us[4].sector = 'B'
  const b = forceBudgets(s, 'deathwatch')
  assert.equal(b.field.used, us[0].rc + us[1].rc)
  assert.equal(b.stf.used, us[2].rc)
  assert.equal(b.field.cap, 750)
  assert.equal(b.stf.cap, 375)
  assert.deepEqual(b.garrison, { units: 1, rc: us[4].rc })
})
test('Logistics journal follows committed entry boundaries and the own actor across reopening and closing', () => {
  let s = command(fixture(), { type: 'end_strategy', payload: {} }, context())
  const u = s.units.find((u) => u.side === 'deathwatch')!
  u.damage = 2
  s = command(s, { type: 'recover', payload: { id: u.id } }, context())
  s.activation!.logistics.push('necrons')
  s = command(s, { type: 'buy_armoury', payload: { item: 'cache' } }, context('necrons'))
  assert.equal(logisticsJournal(s, 'deathwatch').rows.length, 1)
  assert.equal(logisticsJournal(s, 'deathwatch').rows[0].command, 'recover')
  assert.equal(logisticsJournal(s, 'necrons').rows[0].command, 'buy_armoury')
  s = command(s, { type: 'end_logistics', payload: {} }, context())
  assert.equal(logisticsJournal(s, 'deathwatch').rows.length, 1)
  s.log.push({ ...s.log.at(-1)!, version: s.version + 1, command: 'end_strategy' })
  assert.equal(logisticsJournal(s, 'deathwatch').rows.length, 0)
  assert.equal(logisticsJournal({ ...s, log: [] }, 'deathwatch').known, false)
})
test('Recovery projections include deterministic Damage and reserves, but Rehab remains explicitly random', () => {
  const s = command(fixture(), { type: 'end_strategy', payload: {} }, context()),
    u = s.units.find((u) => u.side === 'deathwatch')!
  u.damage = 2
  u.recovery = 5
  s.players.deathwatch.recovery = 10
  u.scars = [{ id: 1, progress: false, redemption: 0 }]
  const before = structuredClone(s),
    p = logisticsPreview(s, 'deathwatch', 'recover', { id: u.id })
  assert(p.allowed)
  const next = command(s, { type: 'recover', payload: { id: u.id } }, context())
  assert.deepEqual(p.unit?.damage, [2, 1])
  assert.equal(p.random, false)
  assert.equal(p.recoveryRemaining, next.players.deathwatch.recovery)
  const rehab = logisticsPreview(s, 'deathwatch', 'rehabilitate', { id: u.id, scar: 1 })
  assert(rehab.allowed)
  assert.equal(rehab.random, true)
  const deep = logisticsPreview(s, 'deathwatch', 'rehabilitate', { id: u.id, scar: 1, deep: true })
  assert(deep.allowed)
  assert.equal(deep.random, false)
  assert.deepEqual(s, before)
})
test('Finish preview rejects Ammunition Debt and remains read-only after checking the next phase', () => {
  const s = command(fixture(), { type: 'end_strategy', payload: {} }, context()),
    u = s.units.find((u) => u.side === 'deathwatch')!
  u.flags.ammunitionDue = true
  const invalid = logisticsPreview(s, 'deathwatch', 'end_logistics', {})
  assert.equal(invalid.allowed, false)
  assert.match(invalid.reason, /Ammunition/)
  u.flags.ammunitionDue = false
  const before = structuredClone(s),
    preview = logisticsPreview(s, 'deathwatch', 'end_logistics', {})
  assert(preview.allowed)
  assert.equal(preview.phase, command(s, { type: 'end_logistics', payload: {} }, context()).phase)
  assert.deepEqual(s, before)
})
