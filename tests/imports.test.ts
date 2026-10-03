import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  parseNewRecruit,
  cardFromImport,
  modelCount,
  validateCard,
  suggestedTransport,
  type DatasheetCard,
} from '../shared/datasheets.ts'
import { validateCargo } from '../shared/transport.ts'
import { command } from '../shared/engine.ts'
import { validateMuster } from '../shared/muster.ts'
import type { CatalogUnit } from '../shared/model.ts'
import { fixture, context } from './fixture.ts'
import {
  draftCatalog,
  referenceImport,
  snapshotWithCatalog,
  type ReferenceLibrary,
} from '../shared/catalogue.ts'
import type { Battle, Muster } from '../shared/model.ts'
const raw = (file: string) =>
  readFileSync(new URL(`fixtures/${file}.json`, import.meta.url), 'utf8')
const nr = () => parseNewRecruit(raw('NecronTeamExample'), 'NecronTeamExample.json')
const dw = () => parseNewRecruit(raw('DeathwatchTeamExample'), 'DeathwatchTeamExample.json')

test('reference candidates require equipment choice; enrichment preserves existing catalogue ID and starter references', () => {
  const reference = JSON.parse(
    readFileSync(new URL('../public/data/wahapedia.reference.json', import.meta.url), 'utf8'),
  ) as ReferenceLibrary
  assert.equal(reference.datasheets.length, 142)
  for (const d of reference.datasheets) {
    const source = referenceImport(d),
      c = draftCatalog(source, source.units[0], 'draft')
    assert.ok(Object.keys(c.card!.profiles).length > 0)
    assert.equal(c.card!.models.flatMap((g) => g.equipment).length, 0)
  }
  const source = dw(),
    u = source.units.find((v) => v.datasheet === 'Intercessor Squad')!,
    c = draftCatalog(source, u, 'new-id'),
    s = fixture()
  c.card!.reviewedAgainst = 'Official test revision'
  const old = s.snapshot.catalog.find((v) => v.datasheet === 'Intercessor Squad')!
  const next = snapshotWithCatalog(s.snapshot, c, old.id, '2026-10-04', 'new-snapshot')
  assert.equal(next.catalog.length, s.snapshot.catalog.length)
  assert.equal(next.catalog.find((v) => v.id === old.id)!.card!.sourceSelectionId, u.id)
  assert.deepEqual(
    s.units.map((v) => [v.id, v.catalogId]),
    fixture().units.map((v) => [v.id, v.catalogId]),
  )
  const veterans = source.units.find((v) => v.datasheet === 'Deathwatch Veterans')!,
    bad = draftCatalog(source, veterans, 'invalid-example')
  bad.card!.reviewedAgainst = 'Official test revision'
  assert.equal(bad.models, 14)
  assert.throws(() => validateCard(bad.card!, bad.models), /диапазон/)
})

test('muster accepts Leader + Support, rejects two Supports, charges Package options once and groups aliases as one datasheet', () => {
  const s = fixture(),
    base = s.units.find(
      (u) =>
        u.side === 'deathwatch' &&
        s.snapshot.catalog.find((c) => c.id === u.catalogId)!.datasheet === 'Intercessor Squad',
    )!,
    leader = s.units.find(
      (u) =>
        u.side === 'deathwatch' && s.snapshot.catalog.find((c) => c.id === u.catalogId)!.character,
    )!
  const lc = s.snapshot.catalog.find((c) => c.id === leader.catalogId)!,
    bc = s.snapshot.catalog.find((c) => c.id === base.catalogId)!
  lc.leaderFor = ['Intercessors']
  lc.supportFor = []
  lc.rc = 50
  leader.rc = 50
  const sc = {
    ...structuredClone(lc),
    id: 'support-cat',
    datasheet: 'Test Support',
    leaderFor: [],
    supportFor: ['Intercessor Squad'],
  }
  s.snapshot.catalog.push(sc)
  const support = { ...structuredClone(leader), id: 'support-id', catalogId: sc.id }
  s.units.push(support)
  const b = {
    stage: 2,
    al: 1000,
    type: 'field',
    snapshot: s.snapshot,
    attacker: 'deathwatch',
    defender: 'necrons',
    pool: 0,
    initial: 0,
  } as Battle
  const m: Muster = {
    picks: [base, leader, support].map((u) => ({
      id: u.id,
      formation: base.id,
      role: 'field',
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
    detachments: s.players.deathwatch.package,
    dispositions: [],
    commander: leader.id,
  }
  const before = validateMuster(s, 'deathwatch', m, b)
  lc.packageCosts = [{ name: 'Binding', cost: 165, detachments: [m.detachments[0], 'irrelevant'] }]
  const after = validateMuster(s, 'deathwatch', m, b)
  assert.equal(after[leader.id] - before[leader.id], 165)
  lc.leaderFor = []
  lc.supportFor = ['Intercessors']
  assert.throws(() => validateMuster(s, 'deathwatch', m, b), /Leader.*Support/)
  lc.leaderFor = ['Intercessors']
  lc.supportFor = []
  delete lc.packageCosts
  const alias = {
    ...structuredClone(bc),
    id: 'alias-cat',
    datasheet: 'Intercessors',
    copyPrices: [bc.rc, bc.rc + 10],
  }
  s.snapshot.catalog.push(alias)
  const second = { ...structuredClone(base), id: 'zz-second-id', catalogId: alias.id }
  s.units.push(second)
  m.picks = [m.picks[0], m.picks[1], { ...m.picks[0], id: second.id, formation: second.id }]
  assert.equal(validateMuster(s, 'deathwatch', m, b)[second.id], bc.rc + 10)
})

test('actual supplied shapes: all four files parse without multiplying counts or losing mixed statlines', () => {
  for (const [name, units] of [
    ['NecronsExample', 26],
    ['DeathwatchExample', 26],
    ['NecronTeamExample', 9],
    ['DeathwatchTeamExample', 15],
  ] as const)
    assert.equal(parseNewRecruit(raw(name)).units.length, units)
  const n = nr(),
    d = dw()
  assert.equal(n.units[0].models[0].count, 5)
  assert.equal(n.units[0].models[0].equipment.find((e) => e.name === 'Gauss blaster')!.count, 5)
  assert.equal(n.units[2].models[0].equipment.find((e) => e.name === 'Gauss flayer')!.count, 10)
  assert.equal(
    d.units
      .find((u) => u.datasheet === 'Intercessor Squad')!
      .models[1].equipment.find((e) => e.name === 'Bolt Rifle')!.count,
    9,
  )
  const dec = d.units.filter((u) => u.datasheet === 'Decimus Kill Team')
  assert.deepEqual(dec.map(modelCount), [10, 5, 5])
  const gravis = dec[0].models.filter((g) => g.keywords.includes('GRAVIS'))
  assert.equal(gravis.length, 2)
  gravis.forEach((g) => {
    assert.equal(d.profiles[g.stats[0]].values.T, '6')
    assert.equal(d.profiles[g.stats[0]].values.W, '3')
  })
  assert.equal(dec[0].models.find((g) => g.name.includes('xenophase'))!.profileOrigin, 'missing')
  assert.equal(d.issues.find((i) => i.code === 'points_limit')?.blocking, false)
  assert.deepEqual(
    d.units.filter((u) => u.datasheet === 'Deathwatch Veterans').map(modelCount),
    [14, 14, 14, 14, 14, 10],
  )
})
test('physical equipment retains alternative modes, transport text, source identity and contextual price', () => {
  const n = nr(),
    d = dw(),
    monoliths = n.units.filter((u) => u.datasheet === 'Monolith')
  assert.deepEqual(
    monoliths.map((u) => [u.copyOrdinal, u.exportedPoints]),
    [
      [1, 420],
      [2, 440],
    ],
  )
  assert.equal(monoliths[0].models[0].equipment.find((e) => e.name === 'Gauss flux arc')!.count, 4)
  const im = d.units.filter((u) => u.datasheet === 'Impulsor')
  assert.equal(im[0].models[0].equipment.find((e) => e.name === 'Storm bolter')!.count, 2)
  const missile = im[1].models[0].equipment.find((e) => e.name === 'Bellicatus Missile Array')!
  assert.equal(missile.count, 1)
  assert.equal(missile.profiles.length, 3)
  const ark = n.units.find((u) => u.datasheet === 'Ghost Ark')!
  assert.ok(ark.profiles.some((id) => n.profiles[id].type === 'Transport'))
  assert.equal(d.units.find((u) => u.datasheet === 'Drop Pod')!.models[0].equipment.length, 0)
  assert.equal(n.units[0].models[0].profileOrigin, 'unit')
  assert.ok(n.source.catalogueId && n.source.gameId)
})
test('configuration rules are excluded and Leader/Support targets stay separate', () => {
  const n = nr()
  assert.equal(n.detachments.length, 1)
  assert.ok(
    n.units.every((u) => u.rules.every((id) => n.profiles[id].name !== 'Command Protocols')),
  )
  const characters = parseNewRecruit(raw('NecronsExample'))
  const chrono = characters.units.find((u) => u.datasheet === 'Chronomancer')!
  assert.ok(chrono.supportFor.some((n) => /Immortals/i.test(n)))
  const marine = parseNewRecruit(raw('DeathwatchExample'))
  const jud = marine.units.find((u) => u.datasheet === 'Judiciar')!
  assert.ok(jud.leaderFor.length > 0 && jud.supportFor.length > 0)
  assert.notDeepEqual(jud.leaderFor, jud.supportFor)
})
test('reject unsupported games, multiple forces, oversized input and grouped copies; never silently drop them', () => {
  const r = JSON.parse(raw('NecronTeamExample'))
  r.roster.forces.push(structuredClone(r.roster.forces[0]))
  assert.throws(() => parseNewRecruit(JSON.stringify(r)), /один Force/)
  r.roster.forces.pop()
  r.roster.gameSystemName = 'Warhammer 40,000 10th Edition'
  assert.throws(() => parseNewRecruit(JSON.stringify(r)), /11th/)
  r.roster.gameSystemName = 'Warhammer 40,000 11th Edition'
  r.roster.forces[0].selections.find((n: { type: string }) => n.type === 'unit').number = 2
  assert.throws(() => parseNewRecruit(JSON.stringify(r)), /копии/)
  assert.throws(() => parseNewRecruit(' '.repeat(2_000_001)), /2 МБ/)
})
test('cards require reviewed source and every model statline; same profile IDs can hold distinct variant values', () => {
  const source = dw(),
    unit = source.units.find((u) => u.datasheet === 'Decimus Kill Team')!,
    card = cardFromImport(source, unit)
  assert.throws(() => validateCard(card, 10), /документ/)
  card.reviewedAgainst = 'Official reviewed fixture v1'
  assert.throws(() => validateCard(card, 10), /statline/)
  const missing = card.models.find((g) => !g.stats.length)!,
    peer = card.models.find((g) => g.name === 'Deathwatch Veteran w/ combat knife')!
  missing.stats = [...peer.stats]
  missing.profileOrigin = 'reviewed'
  validateCard(card, 10)
  assert.throws(() => validateCard(card, 5), /Количество/)
})

const catalog = (name: string, models = 1): CatalogUnit => ({
  id: name,
  side: 'deathwatch',
  datasheet: name,
  size: String(models),
  models,
  rc: 50,
  copyPrices: [],
  keywords: ['INFANTRY', 'ADEPTUS ASTARTES'],
  character: false,
  epic: false,
  battleline: false,
  garrison: 'other',
  leaderFor: [],
  transport: 0,
  cargoKeywords: [],
  ranged: true,
  restoration: false,
  unique: false,
})
test('mixed Gravis cargo is rejected by Impulsor and Drop Pod even when unit has Tacticus keyword', () => {
  const source = dw(),
    u = source.units.filter((u) => u.datasheet === 'Decimus Kill Team')[1],
    cargo = catalog(u.datasheet, 5)
  cargo.card = cardFromImport(source, u)
  for (const name of ['Impulsor', 'Drop Pod']) {
    const t = catalog(name)
    t.transportRule = suggestedTransport(name)
    t.transport = t.transportRule!.groups.reduce((n, g) => n + g.capacity, 0)
    assert.throws(() => validateCargo(t, [{ catalog: cargo }]), /Модели/)
  }
})
test('Ghost Ark seats distinguish ten Warriors and one character; matching handles overlapping seat categories', () => {
  const t = catalog('Ghost Ark')
  t.transport = 11
  t.transportRule = suggestedTransport('Ghost Ark')
  const warriors = catalog('Necron Warriors', 10)
  warriors.keywords = ['NECRON WARRIORS', 'NECRONS', 'INFANTRY']
  const char = catalog('Chronomancer')
  char.keywords = ['NECRONS', 'INFANTRY', 'CHARACTER']
  validateCargo(t, [{ catalog: warriors }, { catalog: char }])
  warriors.models = 11
  assert.throws(() => validateCargo(t, [{ catalog: warriors }]), /Модели/)
  warriors.models = 9
  char.models = 2
  assert.throws(() => validateCargo(t, [{ catalog: warriors }, { catalog: char }]), /Модели/)
  // One flexible model must take the exclusive seat so an inflexible model fits.
  t.transport = 2
  t.transportRule = {
    groups: [
      { capacity: 1, all: ['A'], any: [], exclude: [] },
      { capacity: 1, all: ['B'], any: [], exclude: [] },
    ],
  }
  const both = catalog('both')
  both.keywords = ['A', 'B']
  const a = catalog('a')
  a.keywords = ['A']
  validateCargo(t, [{ catalog: both }, { catalog: a }])
})
test('Rhino Tacticus character exception requires an attached non-Tacticus bodyguard', () => {
  const t = catalog('Rhino')
  t.transport = 12
  t.transportRule = suggestedTransport('Rhino')
  const char = catalog('Ancient')
  char.keywords.push('CHARACTER', 'TACTICUS')
  const body = catalog('Deathwatch Veterans', 5)
  assert.throws(() => validateCargo(t, [{ catalog: char }]), /Модели/)
  validateCargo(t, [{ catalog: body }, { catalog: char, attachedTo: body }])
  body.keywords.push('TACTICUS')
  assert.throws(() => validateCargo(t, [{ catalog: char, attachedTo: body }]), /Модели/)
})
test('Snapshot update cannot replace a known loadout for free, source-stat updates preserve IDs and XP', () => {
  const s = fixture(),
    source = dw(),
    iu = source.units.find((u) => u.datasheet === 'Intercessor Squad')!,
    old = s.snapshot.catalog.find((c) => c.side === 'deathwatch' && !c.character)!
  old.models = 10
  old.card = cardFromImport(source, iu)
  old.card.reviewedAgainst = 'Fixture'
  const next = structuredClone(s.snapshot)
  next.catalog.find((c) => c.id === old.id)!.card!.models[0].equipment[0].name = 'Different weapon'
  assert.throws(
    () => command(s, { type: 'propose_snapshot', payload: { snapshot: next } }, context()),
    /Refit/,
  )
  const good = structuredClone(s.snapshot)
  good.catalog.find((c) => c.id === old.id)!.card!.profiles[old.card.models[0].stats[0]].values.T =
    '5'
  const before = s.units.map((u) => [u.id, u.xp, u.honours, u.scars])
  const accepted = command(s, { type: 'save_catalog', payload: { snapshot: good } }, context())
  assert.deepEqual(
    accepted.units.map((u) => [u.id, u.xp, u.honours, u.scars]),
    before,
  )
})
