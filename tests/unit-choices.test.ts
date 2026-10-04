import { test } from 'node:test'
import assert from 'node:assert/strict'
import { campaignChoices, modelLabel, sizeKey, priceKey } from '../shared/unit-choices.ts'
import { fixture, context } from './fixture.ts'
import { command, startingArmy } from '../shared/engine.ts'
import { validateMuster } from '../shared/muster.ts'
import { maximumReady } from '../shared/readiness.ts'
import type { Battle, Muster } from '../shared/model.ts'

test('Free equipment variants collapse to one choice per datasheet and size, without changing saved data', () => {
  const s = fixture()
  const before = structuredClone(s)
  const choices = campaignChoices(s.snapshot.catalog, 'necrons')
  for (const models of [1, 2, 3])
    assert.equal(
      choices.filter((c) => /Lokhust Heavy Destroyer/.test(c.datasheet) && c.models === models)
        .length,
      1,
    )
  assert.equal(choices.filter((c) => c.datasheet === 'Immortals' && c.models === 5).length, 1)
  assert.equal(
    choices.filter((c) => c.datasheet === 'Necron Warriors' && c.models === 10).length,
    1,
  )
  const dw = campaignChoices(s.snapshot.catalog, 'deathwatch')
  assert.equal(dw.filter((c) => c.datasheet === 'Intercessor Squad' && c.models === 5).length, 1)
  assert.equal(
    dw.filter((c) => c.datasheet === 'Bladeguard Veteran Squad' && c.models === 3).length,
    1,
  )
  assert.equal(dw.filter((c) => c.datasheet === 'Aggressor Squad' && c.models === 3).length, 1)
  assert.deepEqual(s, before)
  const equivalent = {
    ...structuredClone(choices[0]),
    id: 'same-price',
    copyPrices: [choices[0].rc, choices[0].rc, choices[0].rc],
  }
  const simple = { ...structuredClone(choices[0]), copyPrices: [] }
  assert.equal(campaignChoices([simple, equivalent], 'necrons').length, 1)
  for (const u of s.units) {
    const c = s.snapshot.catalog.find((c) => c.id === u.catalogId)!
    assert(choices.concat(dw).some((v) => sizeKey(v) === sizeKey(c) && priceKey(v) === priceKey(c)))
  }
})

test('Separate paid variant is selected after size; purchase/refit charge the actual RC and retain unit identity', () => {
  let s = fixture()
  const old = s.units.find(
    (u) =>
      u.side === 'deathwatch' && !s.snapshot.catalog.find((c) => c.id === u.catalogId)!.character,
  )!
  const base = s.snapshot.catalog.find((c) => c.id === old.catalogId)!
  const paid = {
    ...structuredClone(base),
    id: 'paid-kit',
    size: 'Платный комплект',
    rc: base.rc + 20,
    copyPrices: [base.rc + 20],
  }
  s.snapshot.catalog.push(paid)
  const choices = campaignChoices(s.snapshot.catalog, 'deathwatch').filter(
    (c) => sizeKey(c) === sizeKey(base),
  )
  assert(choices.some((c) => c.id === base.id))
  assert(choices.some((c) => c.id === paid.id))
  s.phase = 'setup'
  s.setupApproved = ['deathwatch', 'necrons']
  old.xp = 3
  const original = structuredClone(old)
  s = command(s, { type: 'setup_unit', payload: { id: old.id, catalogId: paid.id } }, context())
  const changed = s.units.find((u) => u.id === old.id)!
  assert.equal(changed.rc, original.rc + 20)
  assert.equal(changed.xp, original.xp)
  assert.deepEqual(s.setupApproved, ['necrons'])
  s = command(s, { type: 'setup_unit', payload: { id: old.id, catalogId: base.id } }, context())
  s.phase = 'logistics'
  s.activation!.logistics = ['deathwatch']
  s.players.deathwatch.supply = 300
  const before = s.players.deathwatch.supply
  s = command(
    s,
    { type: 'refit', payload: { id: old.id, catalogId: paid.id, kind: 'loadout' } },
    context(),
  )
  assert.equal(s.players.deathwatch.supply, before - 20)
  assert.equal(s.units.find((u) => u.id === old.id)!.rc, paid.rc)
  assert.equal(s.units.find((u) => u.id === old.id)!.xp, original.xp)
  s = command(
    s,
    {
      type: 'buy_unit',
      payload: {
        catalogId: paid.id,
        name: 'Paid squad',
        location: 'field',
        sector: s.players.deathwatch.mf,
        local: 0,
      },
    },
    context(),
  )
  assert.equal(s.players.deathwatch.supply, before - 20 - paid.rc)
})

function army() {
  const s = fixture()
  const units = s.units.filter((u) => u.side === 'necrons')
  const b = {
    stage: 0,
    al: 500,
    type: 'field',
    snapshot: s.snapshot,
    attacker: 'necrons',
    defender: 'deathwatch',
    pool: 0,
    initial: 0,
  } as Battle
  const m: Muster = {
    picks: units.map((u) => ({
      id: u.id,
      formation: u.id,
      role: 'field',
      transport: null,
      reserve: false,
      enhancement: null,
      honours: [],
      armoury: false,
      relic: false,
      redemption: null,
      protocol: 'HOLD',
    })),
    rest: [],
    detachments: s.players.necrons.package,
    dispositions: [],
    commander: units.find((u) => s.snapshot.catalog.find((c) => c.id === u.catalogId)!.character)!
      .id,
  }
  const u = units.find((u) => u.id === m.commander)!
  const cat = s.snapshot.catalog.find((c) => c.id === u.catalogId)!
  cat.packageCosts = [
    { name: 'Optional upgrade', cost: 25, detachments: m.detachments, optional: true },
  ]
  return { s, b, m, u, cat }
}

test('Optional battle points are charged only when checked, independently of RC and Supply', () => {
  const { s, b, m, u } = army()
  const before = structuredClone(s)
  const base = validateMuster(s, 'necrons', m, b)[u.id]
  m.picks.find((p) => p.id === u.id)!.paidOptions = ['Optional upgrade']
  assert.equal(validateMuster(s, 'necrons', m, b)[u.id], base + 25)
  m.picks.find((p) => p.id === u.id)!.paidOptions = []
  assert.equal(validateMuster(s, 'necrons', m, b)[u.id], base)
  assert.deepEqual(s, before)
  assert.equal(maximumReady(s, 'necrons'), 500)
  s.phase = 'setup'
  assert.equal(startingArmy(s, 'necrons').effective, 475)
})

test('Server rejects unknown, duplicate, wrong-detachment options and over-budget upgrades', () => {
  const { s, b, m, u, cat } = army()
  const p = m.picks.find((p) => p.id === u.id)!
  for (const selected of [['Free gun'], ['Optional upgrade', 'Optional upgrade']]) {
    p.paidOptions = selected
    assert.throws(() => validateMuster(s, 'necrons', m, b), /Платная опция/)
  }
  p.paidOptions = ['Optional upgrade']
  cat.packageCosts![0].detachments = ['other-detachment']
  assert.throws(() => validateMuster(s, 'necrons', m, b), /Платная опция/)
  cat.packageCosts![0].detachments = m.detachments
  cat.packageCosts![0].cost = 30
  assert.throws(() => validateMuster(s, 'necrons', m, b), /Effective выше AL/)
})

test('Mandatory detachment surcharges retain automatic pricing and cannot be unchecked as optional', () => {
  const { s, b, m, u, cat } = army()
  const base = validateMuster(s, 'necrons', m, b)[u.id]
  delete cat.packageCosts![0].optional
  assert.equal(validateMuster(s, 'necrons', m, b)[u.id], base + 25)
  m.picks.find((p) => p.id === u.id)!.paidOptions = ['Optional upgrade']
  assert.throws(() => validateMuster(s, 'necrons', m, b), /Платная опция/)
  cat.packageCosts!.push(structuredClone(cat.packageCosts![0]))
  assert.throws(
    () =>
      command(s, { type: 'save_catalog', payload: { snapshot: s.snapshot } }, context('necrons')),
    /платные опции/i,
  )
})

test('Mixed armour composition stays distinct because it changes transport eligibility, not weapon choice', () => {
  const s = fixture()
  const c = structuredClone(
    s.snapshot.catalog.find((c) => c.datasheet === 'Aggressor Squad' && c.models === 3)!,
  )
  const variant = structuredClone(c)
  variant.id = 'mixed-armour'
  variant.card!.models[0].keywords = ['TACTICUS']
  assert.equal(campaignChoices([c, variant], 'deathwatch').length, 2)
  assert.deepEqual([1, 2, 5, 11, 21].map(modelLabel), [
    '1 модель',
    '2 модели',
    '5 моделей',
    '11 моделей',
    '21 модель',
  ])
})
