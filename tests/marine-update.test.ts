import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { STOCK_CATALOG, STOCK_DETACHMENTS } from '../shared/stock.generated.ts'
import { STOCK_ENHANCEMENTS } from '../shared/enhancements.generated.ts'
import { marinePrices, MARINE_SOURCE } from '../shared/marine-prices.ts'
import { updatedMarineSnapshot } from '../shared/marine-update.ts'
import { command } from '../shared/engine.ts'
import { enhancementEligible } from '../shared/enhancements.ts'
import { validateCard, sameDatasheet } from '../shared/datasheets.ts'
import { context, fixture } from './fixture.ts'
import { validateMuster } from '../shared/muster.ts'
import { startingArmyPreview } from '../shared/setup.ts'

const marines = STOCK_CATALOG.filter((c) => c.side === 'deathwatch')
const unit = (name: string, models = 1) =>
  marines.find((c) => c.datasheet === name && c.models === models)!
const official = JSON.parse(
  readFileSync(new URL('../public/data/space-marines.points.json', import.meta.url), 'utf8'),
)

test('Every official Deathwatch datasheet, size and copy tier has a validated current card', () => {
  assert.equal(new Set(marines.map((c) => c.datasheet)).size, 76)
  assert.equal(STOCK_DETACHMENTS.filter((d) => d.side === 'deathwatch').length, 16)
  assert.equal(STOCK_ENHANCEMENTS.filter((e) => e.detachment.includes(':deathwatch:')).length, 36)
  for (const sheet of official.units) {
    for (const tier of sheet.tiers) {
      const c = marines.find(
        (c) =>
          sameDatasheet(c.datasheet, sheet.name) &&
          c.models === tier.models &&
          !c.card!.paidOptions.length,
      )!
      assert(c, `${sheet.name}, ${tier.models} models`)
      assert.equal(c.copyPrices[tier.copyFrom - 1], tier.points, sheet.name)
    }
  }
  for (const c of marines) {
    validateCard(c.card!, c.models)
    assert.deepEqual(c.copyPrices, marinePrices(c)!.copyPrices, c.size)
    for (const g of c.card!.models)
      for (const k of ['M', 'T', 'SV', 'W', 'LD', 'OC'])
        assert(c.card!.profiles[g.stats[0]].values[k], `${c.datasheet}: missing ${k}`)
  }
  assert(
    !marines.some((c) =>
      ['Scout Squad', 'Tactical Squad', 'Terminator Squad', 'Predator Destructor'].includes(
        c.datasheet,
      ),
    ),
  )
})

test('Paid wargear is added to every copy price and shields only increase their bearers wounds', () => {
  const c = marines.find(
    (c) =>
      c.datasheet === 'Deathwatch Terminator Squad' &&
      c.models === 5 &&
      c.size.includes('Shield ×2, Cyclone ×3'),
  )!
  assert.equal(c.rc, 230)
  assert.deepEqual(c.copyPrices, [230, 230, 270, 270, 270, 270])
  assert.equal(
    c
      .card!.models.filter((g) => c.card!.profiles[g.stats[0]].values.W === '4')
      .reduce((n, g) => n + g.count, 0),
    2,
  )
  for (const name of ['Desolation Squad', 'Redemptor Dreadnought', 'Impulsor']) {
    const paid = marines.find((c) => c.datasheet === name && c.card!.paidOptions.length)!
    // Compare to the official base, independently of the selected default weapon.
    const base = marines.find(
      (c) => c.datasheet === name && c.models === paid.models && !c.card!.paidOptions.length,
    )!
    assert.equal(paid.rc - base.rc, name === 'Desolation Squad' ? 5 : 10)
  }
})

test('Updated enhancement eligibility distinguishes Captain, Gravis and vehicle upgrades', () => {
  const e = (name: string) => STOCK_ENHANCEMENTS.find((e) => e.name === name)!
  assert.equal(e('Artificer Armour').cost, 15)
  assert.equal(e('The Tome Of Ectoclades').cost, 15)
  assert(enhancementEligible(e('Adept Of The Codex'), unit('Captain')))
  assert(!enhancementEligible(e('Adept Of The Codex'), unit('Librarian')))
  assert(enhancementEligible(e('Osseus Key (Aura)'), unit('Techmarine')))
  assert(enhancementEligible(e('Immovable Conquerors'), unit('Aggressor Squad', 3)))
  assert(!enhancementEligible(e('Immovable Conquerors'), unit('Intercessor Squad', 5)))
  assert(e('Gunnery Honours').upgrade)
  assert(enhancementEligible(e('Gunnery Honours'), unit('Gladiator Lancer')))
  assert(!enhancementEligible(e('Gunnery Honours'), unit('Redemptor Dreadnought')))
})

test('Campaign update keeps owned IDs, Necrons and resources, and is idempotent before battle one', () => {
  const old = fixture(true)
  old.phase = 'setup'
  old.setupApproved = ['necrons']
  const saved = structuredClone(old)
  const next = command(old, { type: 'update_space_marines', payload: {} }, context('necrons'))
  assert.deepEqual(old, saved)
  assert.deepEqual(next.players.necrons, old.players.necrons)
  assert.deepEqual(
    next.units.filter((u) => u.side === 'necrons'),
    old.units.filter((u) => u.side === 'necrons'),
  )
  assert.deepEqual(
    next.snapshot.catalog.filter((c) => c.side === 'necrons'),
    old.snapshot.catalog.filter((c) => c.side === 'necrons'),
  )
  assert.deepEqual(next.players.deathwatch.starter, old.players.deathwatch.starter)
  assert.deepEqual(next.players.deathwatch.package, old.players.deathwatch.package)
  for (const k of ['sectors', 'history', 'phase', 'battles', 'setupApproved'] as const)
    assert.deepEqual(next[k], old[k])
  for (const side of ['deathwatch', 'necrons'] as const)
    for (const k of ['supply', 'intel'] as const)
      assert.equal(next.players[side][k], old.players[side][k])
  for (const u of next.units.filter((u) => u.side === 'deathwatch')) {
    assert(old.units.some((v) => v.id === u.id && v.catalogId === u.catalogId))
    assert.equal(u.rc, next.snapshot.catalog.find((c) => c.id === u.catalogId)!.rc)
  }
  assert(next.snapshot.sources.includes(MARINE_SOURCE))
  assert.deepEqual(updatedMarineSnapshot(next), next.snapshot)
  next.battles = 1
  assert.throws(() => updatedMarineSnapshot(next), /первого боя/)
})

test('A stale editor cannot restore old unit prices after the versioned update', () => {
  const s = fixture(true)
  s.phase = 'setup'
  const next = command(s, { type: 'update_space_marines', payload: {} }, context())
  const snapshot = structuredClone(next.snapshot)
  const c = snapshot.catalog.find(
    (c) => c.side === 'deathwatch' && c.datasheet === 'Intercessor Squad',
  )!
  c.rc = 5
  c.copyPrices = [5]
  const result = command(next, { type: 'save_catalog', payload: { snapshot } }, context())
  assert.equal(result.snapshot.catalog.find((v) => v.id === c.id)!.rc, 85)
  assert.equal(c.rc, 5) // command inputs are immutable
})

test('Detachments with the same UNIQUE family cannot be fielded together', () => {
  const s = fixture(true)
  const { muster, battle } = startingArmyPreview(s, 'deathwatch')
  const ids = s.snapshot.detachments
    .filter((d) => ['Assault Brethren', 'Tactical Brethren'].includes(d.name))
    .map((d) => d.id)
  assert.equal(ids.length, 2)
  s.players.deathwatch.package = ids
  muster.detachments = ids
  assert.throws(() => validateMuster(s, 'deathwatch', muster, battle), /UNIQUE/)
})
