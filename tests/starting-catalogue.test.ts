import { test } from 'node:test'
import assert from 'node:assert/strict'
import { command, startingArmy } from '../shared/engine.ts'
import {
  expandStartingCatalogue,
  starterChoices,
  starterUnavailable,
} from '../shared/starting-catalogue.ts'
import { STOCK_CATALOG } from '../shared/stock.generated.ts'
import { modelCount, sameDatasheet, validateCard } from '../shared/datasheets.ts'
import { declareBattle } from '../shared/battle.ts'
import { fixture, context } from './fixture.ts'
import type { State, Side } from '../shared/model.ts'

function setup() {
  const s = fixture(true)
  s.phase = 'setup'
  s.activation = null
  s.setupApproved = []
  return s
}
const run = (s: State, type: string, payload = {}, side: Side = 'necrons') =>
  command(s, { type, payload }, context(side))

test('Ready library supplies broad faction choices with complete model and weapon references', () => {
  const s = setup()
  for (const side of ['necrons', 'deathwatch'] as Side[]) {
    const units = s.snapshot.catalog.filter((c) => c.side === side && c.card)
    assert(new Set(units.map((c) => c.datasheet.toUpperCase())).size > 35)
    assert(s.snapshot.detachments.filter((d) => d.side === side).length >= 12)
  }
  assert.doesNotThrow(() => run(s, 'save_catalog', { snapshot: s.snapshot }))
  for (const c of STOCK_CATALOG) {
    validateCard(c.card!, c.models)
    assert.equal(modelCount(c.card!), c.models)
    for (const g of c.card!.models)
      for (const e of g.equipment)
        assert(e.count % g.count === 0, `${c.datasheet}: equipment is total per group`)
  }
  assert(
    !STOCK_CATALOG.some((c) =>
      ['TERMINATOR SQUAD', 'TERMINATOR ASSAULT SQUAD'].includes(c.datasheet.toUpperCase()),
    ),
  )
  assert(!STOCK_CATALOG.some((c) => c.datasheet === 'Deathwatch Veterans' && c.models > 10))
})

test('Library upgrade is idempotent and preserves custom prices, IDs, wallets, package and readiness', () => {
  const s = setup()
  s.snapshot.catalog = s.snapshot.catalog.filter((c) => !c.id.startsWith('stock:'))
  s.snapshot.detachments = s.snapshot.detachments.filter((d) => d.id.startsWith('snapshot-'))
  s.snapshot.catalog.find((c) => c.datasheet === 'Necron Warriors')!.rc = 95
  s.setupApproved = ['deathwatch']
  const before = structuredClone(s)
  const next = run(s, 'expand_starting_catalogue')
  assert.deepEqual(next.units, before.units)
  assert.deepEqual(next.players, before.players)
  assert.deepEqual(next.sectors, before.sectors)
  assert.deepEqual(next.setupApproved, before.setupApproved)
  assert.deepEqual(
    next.snapshot.catalog.slice(0, before.snapshot.catalog.length),
    before.snapshot.catalog,
  )
  assert(
    next.snapshot.catalog
      .filter((c) => sameDatasheet(c.datasheet, 'Necron Warriors') && c.models === 10)
      .every((c) => c.rc === 95),
  )
  const snapshot = structuredClone(next.snapshot)
  expandStartingCatalogue(next)
  assert.deepEqual(next.snapshot, snapshot)
})

test('Start detachment selector accepts one 1/2/3 DP option and resets only own readiness', () => {
  let s = setup()
  s.setupApproved = ['deathwatch', 'necrons']
  const other = s.players.deathwatch.package
  for (const dp of [1, 2, 3]) {
    const d = s.snapshot.detachments.find((d) => d.side === 'necrons' && d.dp === dp)!
    assert(d)
    s = run(s, 'setup_package', { package: [d.id] })
    assert.equal(s.players.necrons.package.length, 1)
    assert.deepEqual(s.players.deathwatch.package, other)
    assert.deepEqual(s.setupApproved, ['deathwatch'])
    assert.equal(startingArmy(s, 'necrons').effective, 475)
  }
  const ids = s.snapshot.detachments
    .filter((d) => d.side === 'necrons')
    .slice(0, 2)
    .map((d) => d.id)
  assert.throws(() => run(s, 'setup_package', { package: ids }), /DP/)
  assert.throws(() => run(s, 'setup_package', { package: s.players.deathwatch.package }), /фракция/)
})

test('Two-model destroyer variant is one unit; plural alias cannot bypass the copy limit', () => {
  let s = setup()
  const old = s.units.find((u) =>
    sameDatasheet(
      s.snapshot.catalog.find((c) => c.id === u.catalogId)!.datasheet,
      'Lokhust Heavy Destroyers',
    ),
  )!
  const variant = s.snapshot.catalog.find(
    (c) => c.datasheet === 'Lokhust Heavy Destroyers' && c.models === 2,
  )!
  old.xp = 2
  s = run(s, 'setup_unit', { id: old.id, catalogId: variant.id })
  assert.equal(s.units.find((u) => u.id === old.id)!.xp, 2)
  const one = s.snapshot.catalog.find(
    (c) => c.datasheet === 'Lokhust Heavy Destroyers' && c.models === 1,
  )!
  assert.match(starterUnavailable(s, 'necrons', one)!, /максимум/)
  assert.throws(() => run(s, 'setup_add', { catalogId: one.id, name: 'Second' }), /максимум/)
  const scarabs = s.units.find((u) => u.side === 'necrons' && u.name.includes('Scarab'))!
  s = run(s, 'setup_unit', { id: scarabs.id, remove: true })
  assert.equal(startingArmy(s, 'necrons').effective, 485)
  assert.equal(s.units.filter((u) => u.status === 'active' && u.catalogId === variant.id).length, 1)
})

test('Available start choices exclude epic/titanic, oversized and exhausted copy limits', () => {
  const s = setup()
  const options = starterChoices(s, 'deathwatch')
  assert(options.some((c) => c.datasheet === 'Captain'))
  assert(options.some((c) => c.datasheet === 'Aggressor Squad'))
  assert(
    options.every(
      (c) => c.side === 'deathwatch' && !c.epic && !c.keywords.includes('TITANIC') && c.rc <= 200,
    ),
  )
  const epic = s.snapshot.catalog.find((c) => c.side === 'necrons' && c.epic)!
  assert.throws(() => run(s, 'setup_add', { catalogId: epic.id, name: epic.datasheet }), /Epic/)
  assert(options.some((c) => c.datasheet === 'Intercessor Squad')) // second Battleline copy is legal
  assert(!options.some((c) => c.datasheet === 'Eliminator Squad'))
})

test('Alternative fire modes share one physical weapon, including both profiles in the ready card', () => {
  const plasma = STOCK_CATALOG.find(
    (c) => c.datasheet === 'Inceptor Squad' && c.size.includes('plasma') && c.models === 3,
  )!
  for (const g of plasma.card!.models) {
    const e = g.equipment.find((e) => e.name.includes('plasma'))!
    assert.equal(e.count, g.count)
    assert.equal(e.profiles.length, 2)
  }
  const mixed = STOCK_CATALOG.find(
    (c) =>
      c.datasheet === 'Lokhust Heavy Destroyers' && c.models === 2 && c.size.includes('смешанное'),
  )!
  assert.equal(mixed.card!.models.length, 2)
  assert.deepEqual(
    mixed.card!.models.map((g) => g.count),
    [1, 1],
  )
})

test('Battle history freezes owned profiles without duplicating the entire shopping library', () => {
  const s = fixture()
  s.players.deathwatch.mf = 'D'
  s.players.necrons.mf = 'F'
  declareBattle(s, 'F', 'deathwatch', false, context())
  assert(s.battle!.snapshot.catalog.length < 20)
  for (const u of s.units) assert(s.battle!.snapshot.catalog.some((c) => c.id === u.catalogId))
  const old = structuredClone(s.battle!.snapshot)
  s.snapshot.catalog[0].rc += 10
  assert.deepEqual(s.battle!.snapshot, old)
})
