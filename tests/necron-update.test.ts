import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { STOCK_CATALOG, STOCK_DETACHMENTS } from '../shared/stock.generated.ts'
import { STOCK_ENHANCEMENTS, STOCK_BINDINGS } from '../shared/enhancements.generated.ts'
import { necronPrices, NECRON_SOURCE } from '../shared/necron-prices.ts'
import { updatedNecronSnapshot } from '../shared/necron-update.ts'
import { command } from '../shared/engine.ts'
import { attachmentTargets, enhancementEligible } from '../shared/enhancements.ts'
import { validateCard, sameDatasheet } from '../shared/datasheets.ts'
import { dispositionChoices } from '../shared/detachments.ts'
import { context, fixture } from './fixture.ts'
import { validateMuster, musterCosts } from '../shared/muster.ts'
import { startingArmyPreview } from '../shared/setup.ts'
import { maximumReady } from '../shared/readiness.ts'

const necrons = STOCK_CATALOG.filter((c) => c.side === 'necrons')
const unit = (name: string, models = 1) =>
  necrons.find((c) => sameDatasheet(c.datasheet, name) && c.models === models)!
const enhancement = (name: string) => STOCK_ENHANCEMENTS.find((e) => e.name === name)!
const official = JSON.parse(
  readFileSync(new URL('../public/data/necrons.points.json', import.meta.url), 'utf8'),
)

function scenario(names: [string, number][], detachment = 'Cursed Legion') {
  const s = fixture(true)
  s.phase = 'setup'
  s.snapshot = updatedNecronSnapshot(s)
  s.stage = 6
  const template = s.units.find((u) => u.side === 'necrons')!
  s.units = names.map(([name, models], i) => {
    const c = unit(name, models)
    return {
      ...structuredClone(template),
      id: `necron-${i}`,
      name,
      catalogId: c.id,
      rc: c.rc,
      flags: {},
    }
  })
  s.players.necrons.package = [s.snapshot.detachments.find((d) => d.name === detachment)!.id]
  s.players.necrons.startingEnhancements = {}
  const { muster, battle } = startingArmyPreview(s, 'necrons')
  battle.al = 2000
  battle.stage = 6
  return { s, m: muster, b: battle }
}

test('All 52 Necron datasheets and every official size/copy tier are available with valid cards', () => {
  assert.equal(new Set(necrons.map((c) => c.datasheet)).size, 52)
  assert.equal(STOCK_DETACHMENTS.filter((d) => d.side === 'necrons').length, 12)
  assert.equal(STOCK_ENHANCEMENTS.filter((e) => e.detachment.includes(':necrons:')).length, 38)
  for (const sheet of official.units)
    for (const tier of sheet.tiers) {
      const c = unit(sheet.name, tier.models)
      assert(c, sheet.name)
      assert.equal(c.copyPrices[tier.copyFrom - 1], tier.points, sheet.name)
    }
  for (const c of necrons) {
    validateCard(c.card!, c.models)
    assert.deepEqual(c.copyPrices, necronPrices(c)!.copyPrices)
  }
  assert.equal(necronPrices({ ...unit('Immortals', 5), datasheet: 'Unknown homebrew' }), null)
})

test('Necron update preserves saved loadouts, active IDs, archived units and the other faction', () => {
  const s = fixture(true)
  s.phase = 'setup'
  s.units[0].status = 'archived'
  const archived = s.units.find((u) => u.side === 'necrons')!
  archived.status = 'archived'
  const old = structuredClone(s)
  const next = command(s, { type: 'update_necrons', payload: {} }, context())
  assert.deepEqual(s, old)
  assert.deepEqual(next.players.deathwatch, s.players.deathwatch)
  assert.deepEqual(
    next.units.filter((u) => u.side === 'deathwatch' || u.status === 'archived'),
    s.units.filter((u) => u.side === 'deathwatch' || u.status === 'archived'),
  )
  assert.deepEqual(
    next.snapshot.catalog.filter((c) => c.side === 'deathwatch'),
    s.snapshot.catalog.filter((c) => c.side === 'deathwatch'),
  )
  assert.deepEqual(
    next.snapshot.detachments.filter((d) => d.side === 'deathwatch'),
    s.snapshot.detachments.filter((d) => d.side === 'deathwatch'),
  )
  const marineIds = s.snapshot.detachments.filter((d) => d.side === 'deathwatch').map((d) => d.id)
  assert.deepEqual(
    next.snapshot.enhancements.filter((e) => marineIds.includes(e.detachment)),
    s.snapshot.enhancements.filter((e) => marineIds.includes(e.detachment)),
  )
  for (const c of s.snapshot.catalog.filter((c) => c.side === 'necrons' && c.card)) {
    const saved = next.snapshot.catalog.find((v) => v.id === c.id)!
    assert.deepEqual(saved.card!.models, c.card!.models)
  }
  for (const u of next.units.filter((u) => u.side === 'necrons' && u.status !== 'archived')) {
    assert(s.units.some((v) => v.id === u.id && v.catalogId === u.catalogId))
    assert.equal(u.rc, next.snapshot.catalog.find((c) => c.id === u.catalogId)!.rc)
    assert.deepEqual(u, { ...s.units.find((v) => v.id === u.id), rc: u.rc })
  }
  for (const k of ['sectors', 'history', 'phase', 'battles'] as const)
    assert.deepEqual(next[k], s[k])
  for (const k of ['supply', 'intel', 'starter', 'package', 'packageStage'] as const)
    assert.deepEqual(next.players.necrons[k], s.players.necrons[k])
  assert.deepEqual(
    next.players.necrons.startingEnhancements ?? {},
    s.players.necrons.startingEnhancements ?? {},
  )
  assert.deepEqual(next.setupApproved, ['deathwatch'])
  assert.deepEqual(updatedNecronSnapshot(next), next.snapshot)
  const roundTrip = JSON.parse(JSON.stringify(next))
  assert.deepEqual(updatedNecronSnapshot(roundTrip), roundTrip.snapshot)
  next.battles = 1
  assert.throws(() => updatedNecronSnapshot(next), /первого боя/)
})

test('A stale editor cannot undo updated Necron prices or Cryptek restrictions by removing the source marker', () => {
  const s = fixture(true)
  s.phase = 'setup'
  const next = command(s, { type: 'update_necrons', payload: {} }, context())
  const snapshot = structuredClone(next.snapshot)
  snapshot.sources = []
  const c = snapshot.catalog.find(
    (c) => c.side === 'necrons' && c.datasheet === 'Immortals' && c.models === 5,
  )!
  c.rc = 70
  c.copyPrices = [70]
  delete snapshot.enhancements.find((e) => e.name === 'Atomic Disintegrators')!.eligibleAny
  const saved = command(next, { type: 'save_catalog', payload: { snapshot } }, context())
  assert(saved.snapshot.sources.includes(NECRON_SOURCE))
  assert.equal(saved.snapshot.catalog.find((v) => v.id === c.id)!.rc, 65)
  assert(
    !enhancementEligible(
      saved.snapshot.enhancements.find((e) => e.name === 'Atomic Disintegrators')!,
      unit('Overlord'),
    ),
  )
  assert.equal(c.rc, 70)
})

test('Cryptek-only enhancements reject an Overlord and Epic Heroes', () => {
  for (const name of ['Atomic Disintegrators', 'Gravitic Bolas']) {
    assert(enhancementEligible(enhancement(name), unit('Technomancer')))
    assert(!enhancementEligible(enhancement(name), unit('Overlord')))
    assert(!enhancementEligible(enhancement(name), unit('Orikan The Diviner')))
  }
})

test('Murdermind extends Support only for its eligible bearer in the selected detachment', () => {
  const { s, m, b } = scenario([
    ['Lokhust Lord', 1],
    ['Technomancer', 1],
    ['Lokhust Destroyers', 3],
  ])
  m.picks.forEach((p) => (p.formation = m.picks[2].id))
  assert.throws(() => validateMuster(s, 'necrons', m, b), /Bodyguard/)
  m.picks[1].enhancement = enhancement('Murdermind').id
  assert.equal(validateMuster(s, 'necrons', m, b)[m.picks[1].id], 95)
  assert.deepEqual(unit('Technomancer').supportFor, [
    'CANOPTEK WRAITHS',
    'IMMORTALS',
    'NECRON WARRIORS',
  ])
  assert.equal(
    attachmentTargets(unit('Technomancer'), b.snapshot, enhancement('Murdermind').id, []).support
      .length,
    3,
  )
  assert(
    !attachmentTargets(unit('Overlord'), b.snapshot, enhancement('Murdermind').id, m.detachments)
      .support.length,
  )
  m.picks[1].enhancement = null
  assert.throws(() => validateMuster(s, 'necrons', m, b), /Bodyguard/)
})

test('Murdermind does not let two Supports occupy the Leader and Support slots', () => {
  const { s, m, b } = scenario([
    ['Technomancer', 1],
    ['Plasmancer', 1],
    ['Immortals', 5],
  ])
  m.picks.forEach((p) => (p.formation = m.picks[2].id))
  m.picks[0].enhancement = enhancement('Murdermind').id
  assert.throws(() => validateMuster(s, 'necrons', m, b), /один Leader и один Support/)
})

test('Readiness accounts for a formation enabled by Murdermind, with its price paid once', () => {
  const { s, m, b } = scenario([
    ['Technomancer', 1],
    ['Lokhust Destroyers', 6],
  ])
  s.snapshot.enhancements = [structuredClone(enhancement('Murdermind'))]
  s.units[0].xp = 7
  s.units[0].honours = ['operational_mastery']
  m.picks[0].honours = ['operational_mastery']
  m.picks[0].enhancement = enhancement('Murdermind').id
  m.picks[0].formation = m.picks[1].id
  const total = Object.values(validateMuster(s, 'necrons', m, b)).reduce((a, b) => a + b, 0)
  assert.equal(maximumReady(s, 'necrons'), total)
  const without = structuredClone(m)
  without.picks[0].formation = without.picks[0].id
  const separate = Object.values(validateMuster(s, 'necrons', without, b)).reduce(
    (a, b) => a + b,
    0,
  )
  assert(total > separate)
})

test('UNIQUE families and detachment Force Dispositions restrict battle choices', () => {
  const { s, m, b } = scenario([['Lokhust Lord', 1]])
  const dynasty = s.snapshot.detachments
    .filter((d) => d.side === 'necrons' && d.uniqueGroup === 'DYNASTY')
    .map((d) => d.id)
  assert.equal(dynasty.length, 2)
  s.players.necrons.package = dynasty
  m.detachments = dynasty
  assert.throws(() => validateMuster(s, 'necrons', m, b), /UNIQUE/)
  m.detachments = [s.snapshot.detachments.find((d) => d.name === 'Cursed Legion')!.id]
  s.players.necrons.package = m.detachments
  const choices = dispositionChoices(s.snapshot, 'necrons', m.detachments)
  assert.deepEqual(
    choices.map((d) => d.name),
    ['PURGE THE FOE'],
  )
  m.dispositions = [choices[0].id]
  assert.doesNotThrow(() => validateMuster(s, 'necrons', m, b))
  m.dispositions = [s.snapshot.dispositions!.find((d) => d.name === 'TAKE AND HOLD')!.id]
  assert.throws(() => validateMuster(s, 'necrons', m, b), /Disposition/)
})

test('Every Ctan binding remains mandatory only in Pantheon and stacks with copy pricing', () => {
  for (const binding of STOCK_BINDINGS) {
    const { s, m, b } = scenario([[binding.datasheet, 1]], 'Pantheon of Woe')
    const c = unit(binding.datasheet)
    assert.equal(musterCosts(s, m, b)[m.picks[0].id], c.rc + binding.cost)
    assert(!c.packageCosts![0].optional)
    m.detachments = []
    assert.equal(musterCosts(s, m, b)[m.picks[0].id], c.rc)
  }
  const { s, m, b } = scenario(
    [
      ["Transcendent C'tan", 1],
      ["Transcendent C'tan", 1],
    ],
    'Pantheon of Woe',
  )
  assert.deepEqual(Object.values(musterCosts(s, m, b)), [380, 400])
})
