import assert from 'node:assert/strict'
import test from 'node:test'
import {
  battleChronicle,
  campaignOverview,
  chronicleStatus,
  filterChronicle,
  historyRows,
  PREPARATION,
  resourceChanges,
} from '../shared/chronicle.ts'
import { declareBattle } from '../shared/battle.ts'
import { project } from '../shared/engine.ts'
import { ownHistory, type HistoryEntry } from '../shared/history.ts'
import type { State } from '../shared/model.ts'
import { fixture, context } from './fixture.ts'

const filter = { battle: '', actor: '', kind: '' as const, search: '' }
function battle() {
  const s = fixture(true)
  s.players.deathwatch.mf = 'D'
  s.players.necrons.mf = 'F'
  declareBattle(s, 'F', 'deathwatch', false, context())
  s.battle!.mission = 'F1'
  return s
}
const row = (version: number, patch: Partial<HistoryEntry> = {}): HistoryEntry => ({
  version,
  actor: 'deathwatch',
  command: 'recover',
  summary: 'Восстановлен Immortals',
  dice: [],
  ...patch,
})
test('Chronicle merges archive, live revision and journal-only battles without mutating state', () => {
  const s = battle(),
    b = s.battle!
  s.history = [structuredClone(b)]
  s.history[0].mission = 'F2'
  s.log = [
    row(1),
    row(2, { battle: { id: b.id, number: 1 } }),
    row(3, { battle: { id: 'legacy', number: 2 } }),
  ]
  const before = structuredClone(s),
    groups = battleChronicle(s)
  assert.deepEqual(
    groups.map((g) => g.id),
    ['legacy', b.id, PREPARATION],
  )
  assert.equal(groups[1].battle!.mission, 'F1')
  assert.equal(groups[1].rows.length, 1)
  assert.deepEqual(s, before)
})
test('Recorded resource deltas preserve spend, reward and correction reversal; missing history stays unknown', () => {
  const rows = [
    row(1, { resources: [{ side: 'deathwatch', supply: [100, 250], intel: [1, 2] }] }),
    row(2, { resources: [{ side: 'deathwatch', supply: [250, 220], intel: [2, 2] }] }),
    row(3, { resources: [{ side: 'deathwatch', supply: [220, 100], intel: [2, 1] }] }),
    row(4),
  ]
  const [dw, nc] = resourceChanges(rows)
  assert.equal(dw.supply, 0)
  assert.equal(dw.intel, 0)
  assert.equal(dw.known, true)
  assert.equal(dw.partial, true)
  assert.equal(nc.known, false)
  assert.ok(resourceChanges([]).every((r) => !r.known))
})
test('Search, battle, actor and action category compose; own export remains private under these filters', () => {
  const s = battle(),
    id = s.battle!.id
  s.log = [
    row(1),
    row(3, { battle: { id, number: 1 }, actor: 'necrons' }),
    row(2, {
      battle: { id, number: 1 },
      command: 'table_action',
      summary: 'Начато действие миссии',
    }),
    row(4, {
      battle: { id, number: 1 },
      resources: [
        { side: 'deathwatch', supply: [100, 85], intel: [1, 1] },
        { side: 'necrons', supply: [100, 95], intel: [1, 1] },
      ],
    }),
  ]
  assert.deepEqual(
    historyRows(s, { ...filter, battle: PREPARATION }).map((l) => l.version),
    [1],
  )
  assert.deepEqual(
    historyRows(s, {
      ...filter,
      battle: id,
      actor: 'deathwatch',
      kind: 'logistics',
      search: '  IMMORTALS  ',
    }).map((l) => l.version),
    [4],
  )
  assert.equal(historyRows(s, { ...filter, search: 'Kill the Signal' }).length, 3)
  const selected = new Set(
    historyRows(s, { ...filter, battle: id, kind: 'logistics' }).map((l) => l.version),
  )
  const exported = ownHistory(s, 'deathwatch').filter((l) => selected.has(l.version))
  assert.deepEqual(
    exported.map((l) => l.version),
    [4],
  )
  assert.ok(exported[0].resources?.every((r) => r.side === 'deathwatch'))
})
test('Archive-only chapters are searchable without inventing journal entries; actor filters require recorded evidence', () => {
  const s = battle()
  s.history = [s.battle!]
  s.battle = null
  s.log = []
  const groups = battleChronicle(s),
    query = { ...filter, search: 'kill the signal' }
  assert.equal(historyRows(s, query).length, 0)
  assert.equal(filterChronicle(groups, [], query).length, 1)
  assert.equal(filterChronicle(groups, [], { ...query, actor: 'necrons' }).length, 0)
})
test('Overview picks applied consequences, excludes inactive IDs and treats Commission as unavailable Field', () => {
  const s = battle(),
    old = structuredClone(s.battle!)
  old.aftermathApplied = true
  s.history = [old]
  s.battle!.id = 'next-battle'
  s.battle!.number = 2
  const units = s.units.filter((u) => u.side === 'deathwatch')
  units[0].damage = 3
  units[1].flags.commission = true
  units[2].status = 'lost'
  units[3].location = 'garrison'
  units[3].sector = 'B'
  s.log = [row(3), row(1), row(2)]
  const view = campaignOverview(s, 'deathwatch')
  assert.equal(view.lastBattle!.id, old.id)
  assert.equal(view.field, units.length - 2)
  assert.equal(view.unavailableField, 2)
  assert.equal(view.budgets.garrison.units, 1)
  assert.equal(view.activity[0].version, 3)
  assert.equal(
    view.territory.reduce((n, t) => n + t.count, view.neutral),
    11,
  )
})
test('Chapter status distinguishes awaiting result, aftermath and applied consequences', () => {
  const s = battle()
  s.phase = 'aftermath'
  assert.equal(chronicleStatus(battleChronicle(s)[0]), 'Расчёт последствий')
  s.battle!.aftermathApplied = true
  assert.equal(chronicleStatus(battleChronicle(s)[0]), 'Последствия применены')
})
test('History helpers use only the projected journal; hidden signal and redacted dice do not become searchable', () => {
  const s = battle()
  s.battle!.hiddenSignal = 'SECRET_SIGNAL'
  s.log = [
    row(1, {
      command: 'attack',
      summary: 'attack',
      dice: [6],
      battle: { id: s.battle!.id, number: 1 },
    }),
  ]
  const view = project(s, 'necrons') as unknown as State
  assert.equal(historyRows(view, { ...filter, search: 'SECRET_SIGNAL' }).length, 0)
  assert.equal(historyRows(view, { ...filter, search: '6' }).length, 0)
  assert.equal(battleChronicle(view)[0].battle!.hiddenSignal, '')
  assert.deepEqual(battleChronicle(view)[0].rows[0].dice, [])
})
