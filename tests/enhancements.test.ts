import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, context } from './fixture.ts'
import { command, project } from '../shared/engine.ts'
import { startingArmy, startingArmyPreview } from '../shared/setup.ts'
import { expandStartingCatalogue } from '../shared/starting-catalogue.ts'
import {
  enhancementEligible,
  enhancementBearers,
  preferredEnhancement,
  bindEnhancement,
} from '../shared/enhancements.ts'
import { maximumReady } from '../shared/readiness.ts'
import { declareBattle } from '../shared/battle.ts'
import { validateMuster } from '../shared/muster.ts'
import { entry } from '../shared/rules.ts'
import { STOCK_BINDINGS } from '../shared/enhancements.generated.ts'
import type { Side, State, Enhancement, Muster } from '../shared/model.ts'

const run = (s: State, type: string, payload = {}, side: Side = 'necrons') =>
  command(s, { type, payload }, context(side))
function setup() {
  const s = fixture(true)
  s.phase = 'setup'
  s.activation = null
  s.setupApproved = []
  return s
}
const enhancement = (s: State, name: string) =>
  s.snapshot.enhancements.find((e) => e.name === name)!
const ownCharacter = (s: State) =>
  s.units.find((u) => u.side === 'necrons' && entry(s, u).character)!

test('Accepted detachment library is complete, maps default IDs and preserves owner choices and prices', () => {
  const s = setup()
  assert.equal(s.snapshot.enhancements.length, 100)
  for (const d of s.snapshot.detachments) {
    const optional = s.snapshot.enhancements.filter((e) => e.detachment === d.id)
    assert(
      optional.length ||
        (d.name === 'Pantheon of Woe' &&
          STOCK_BINDINGS.filter((o) => o.detachment === d.id).length === 4),
    )
  }
  assert.equal(enhancement(s, 'Veil of Darkness').detachment, s.players.necrons.package[0])
  assert.equal(enhancement(s, 'Artificer Armour').detachment, s.players.deathwatch.package[0])
  const e = enhancement(s, 'Veil of Darkness')
  e.id = 'owner-veil'
  e.cost = 15
  const before = structuredClone(s)
  expandStartingCatalogue(s)
  assert.deepEqual(s, before)
  assert.equal(s.snapshot.enhancements.filter((v) => v.name === e.name).length, 1)
})

test('Optional starter choice costs Effective, spends no Supply, resets only own readiness and binds at first use', () => {
  let s = setup()
  const u = ownCharacter(s),
    e = enhancement(s, 'Veil of Darkness'),
    wallet = s.players.necrons.supply
  assert.equal(startingArmy(s, 'necrons').effective, 475)
  s.setupApproved = ['deathwatch', 'necrons']
  s = run(s, 'setup_enhancement', { id: u.id, enhancement: e.id })
  assert.equal(startingArmy(s, 'necrons').effective, 495)
  assert.equal(s.units.find((v) => v.id === u.id)!.rc, u.rc)
  assert.equal(s.players.necrons.supply, wallet)
  assert.deepEqual(s.setupApproved, ['deathwatch'])
  assert.deepEqual(s.players.necrons.enhancements, {})
  assert.equal(
    preferredEnhancement(s, 'necrons', u.id, s.snapshot, s.players.necrons.package, 0),
    e.id,
  )
  s = run(s, 'ready_army')
  assert.equal(s.phase, 'strategy')
  declareBattle(s, 'X', 'deathwatch', false, context(), 'encounter')
  s.phase = 'muster'
  s.battle!.lock = { deathwatch: false, necrons: false }
  const m = startingArmyPreview(s, 'necrons').muster
  s = run(s, 'commit_muster', { muster: m })
  assert.equal(s.battle!.costs[u.id], u.rc + e.cost)
  assert.deepEqual(enhancementBearers(s.players.necrons, e.id), [u.id])
  const hidden = project(s, 'deathwatch')
  assert.deepEqual(hidden.players.necrons.enhancements, {})
  assert.deepEqual(hidden.players.necrons.enhancementExtras, {})
  assert.deepEqual(hidden.players.necrons.startingEnhancements, {})
})

test('Starter removal and over-budget changes keep the exact preview, while ready requires 470–500', () => {
  let s = setup()
  const u = ownCharacter(s),
    e = enhancement(s, 'Phasal Subjugator')
  s = run(s, 'setup_enhancement', { id: u.id, enhancement: e.id })
  assert.equal(startingArmyPreview(s, 'necrons').effective, 510)
  assert.throws(() => run(s, 'ready_army'), /Effective/)
  s = run(s, 'setup_enhancement', { id: u.id, enhancement: null })
  assert.equal(startingArmy(s, 'necrons').effective, 475)
  s = run(s, 'setup_enhancement', { id: u.id, enhancement: enhancement(s, 'Veil of Darkness').id })
  const det = s.snapshot.detachments.find((d) => d.name === 'Canoptek Court')!
  s = run(s, 'setup_package', { package: [det.id] })
  assert.deepEqual(s.players.necrons.startingEnhancements, {})
  s = run(s, 'setup_package', { package: [e.detachment] })
  s = run(s, 'setup_enhancement', { id: u.id, enhancement: e.id })
  s = run(s, 'setup_unit', { id: u.id, remove: true })
  assert.deepEqual(s.players.necrons.startingEnhancements, {})
})

test('Server rejects wrong ownership, detachment, non-character, duplicates and closed setup', () => {
  let s = setup()
  const u = ownCharacter(s),
    e = enhancement(s, 'Veil of Darkness')
  const body = s.units.find((v) => v.side === 'necrons' && !entry(s, v).character)!
  const enemy = s.units.find((v) => v.side === 'deathwatch')!
  assert.throws(() => run(s, 'setup_enhancement', { id: body.id, enhancement: e.id }), /нелегален/)
  assert.throws(() => run(s, 'setup_enhancement', { id: enemy.id, enhancement: e.id }), /starter/)
  assert.throws(
    () =>
      run(s, 'setup_enhancement', { id: u.id, enhancement: enhancement(s, 'Arisen Tyrant').id }),
    /detachment/,
  )
  s.units.push({ ...structuredClone(u), id: 'another-character' })
  s = run(s, 'setup_enhancement', { id: u.id, enhancement: e.id })
  assert.throws(
    () => run(s, 'setup_enhancement', { id: 'another-character', enhancement: e.id }),
    /Дубликат/,
  )
  assert.throws(
    () =>
      run(s, 'setup_enhancement', {
        id: 'another-character',
        enhancement: enhancement(s, 'Nether-realm Casket').id,
      }),
    /лимит/,
  )
  s.phase = 'strategy'
  assert.throws(() => run(s, 'setup_enhancement', { id: u.id, enhancement: null }), /закрыт/)
})

test('Keyword AND/OR, exclusions and specific unit exceptions match the accepted source', () => {
  const s = setup()
  const cat = (name: string) => s.snapshot.catalog.find((c) => c.datasheet === name)!
  assert(enhancementEligible(enhancement(s, 'Osseus Key'), cat('Watch Master')))
  assert(enhancementEligible(enhancement(s, 'Osseus Key'), cat('Techmarine')))
  assert(!enhancementEligible(enhancement(s, 'Osseus Key'), cat('Captain')))
  assert(enhancementEligible(enhancement(s, 'Shock Deployment'), cat('Captain in Gravis Armour')))
  assert(!enhancementEligible(enhancement(s, 'Shock Deployment'), cat('Captain')))
  assert(
    !enhancementEligible(enhancement(s, 'Veil of Darkness'), { ...cat('Overlord'), epic: true }),
  )
  assert(enhancementEligible(enhancement(s, 'Enlivened Sentinels'), cat('Necron Warriors')))
  assert(!enhancementEligible(enhancement(s, 'Enlivened Sentinels'), cat('Immortals')))
  assert(enhancementEligible(enhancement(s, 'Deepening Madness'), cat('Lokhust Heavy Destroyers')))
  assert(!enhancementEligible(enhancement(s, 'Deepening Madness'), cat('Skorpekh Destroyers')))
  assert(
    enhancementEligible(enhancement(s, 'Redoubtable Machine Spirit'), cat('Predator Destructor')),
  )
  assert(
    !enhancementEligible(
      enhancement(s, 'Redoubtable Machine Spirit'),
      cat('Redemptor Dreadnought'),
    ),
  )
  assert(
    !enhancementEligible(enhancement(s, 'Mark of the Nekrosor'), {
      ...cat('Overlord'),
      keywords: [...cat('Overlord').keywords, 'DESTROYER CULT'],
    }),
  )
})

test('Upgrade on two starter units uses one slot and charges each bearer', () => {
  let s = setup()
  const e = enhancement(s, 'Enlivened Sentinels')
  const warriors = s.units.find(
    (u) => u.side === 'necrons' && entry(s, u).datasheet === 'Necron Warriors',
  )!
  s.units.push({ ...structuredClone(warriors), id: 'second-warriors' })
  s = run(s, 'setup_package', { package: [e.detachment] })
  s = run(s, 'setup_enhancement', { id: warriors.id, enhancement: e.id })
  const base = startingArmyPreview(s, 'necrons').effective
  s = run(s, 'setup_enhancement', { id: 'second-warriors', enhancement: e.id })
  assert.equal(startingArmyPreview(s, 'necrons').effective, base + e.cost)
  assert.equal(new Set(Object.values(s.players.necrons.startingEnhancements!)).size, 1)
})

test('Upgrade commits three bearers, preserves bindings across omissions and rejects a fourth until transfer', () => {
  let s = setup()
  const e = enhancement(s, 'Enlivened Sentinels'),
    leader = ownCharacter(s)
  const warriors = s.units.find(
    (u) => u.side === 'necrons' && entry(s, u).datasheet === 'Necron Warriors',
  )!
  for (const id of ['second-warriors', 'third-warriors', 'fourth-warriors'])
    s.units.push({ ...structuredClone(warriors), id })
  s.players.necrons.package = [e.detachment]
  s.stage = 3
  s.battles = 6
  declareBattle(s, 'X', 'deathwatch', false, context(), 'encounter')
  s.phase = 'muster'
  s.battle!.lock = { deathwatch: false, necrons: false }
  const m: Muster = {
    ...startingArmyPreview(s, 'necrons').muster,
    picks: startingArmyPreview(s, 'necrons')
      .muster.picks.filter((p) =>
        [leader.id, warriors.id, 'second-warriors', 'third-warriors'].includes(p.id),
      )
      .map((p) => ({ ...p, enhancement: p.id === leader.id ? null : e.id })),
  }
  s = run(s, 'commit_muster', { muster: m })
  assert.deepEqual(enhancementBearers(s.players.necrons, e.id), [
    warriors.id,
    'second-warriors',
    'third-warriors',
  ])
  for (const p of m.picks)
    assert.equal(
      s.battle!.costs[p.id],
      s.units.find((u) => u.id === p.id)!.rc + (p.enhancement ? e.cost : 0),
    )
  const bad = structuredClone(m)
  const replacement = bad.picks.find((p) => p.enhancement)!
  replacement.id = 'fourth-warriors'
  replacement.formation = 'fourth-warriors'
  assert.throws(() => validateMuster(s, 'necrons', bad), /закреплён/)
  const fewer = { ...m, picks: m.picks.filter((p) => p.id !== 'third-warriors') }
  assert.doesNotThrow(() => validateMuster(s, 'necrons', fewer))
  s.battle = null
  s.phase = 'logistics'
  s.activation = { ...fixture().activation!, side: 'necrons', logistics: ['necrons'] }
  s.active = 'necrons'
  const before = s.players.necrons.supply
  s = run(s, 'transfer_enhancement', {
    enhancement: e.id,
    from: 'third-warriors',
    to: 'fourth-warriors',
  })
  assert.equal(s.players.necrons.supply, before - 15)
  assert.deepEqual(enhancementBearers(s.players.necrons, e.id), [
    warriors.id,
    'second-warriors',
    'fourth-warriors',
  ])
  assert.throws(
    () => run(s, 'transfer_enhancement', { enhancement: e.id, from: warriors.id, to: leader.id }),
    /target/,
  )
  s.stage = 4
  const wallet = s.players.necrons.supply
  s = run(s, 'transfer_enhancement', {
    enhancement: e.id,
    from: 'fourth-warriors',
    to: 'third-warriors',
  })
  assert.equal(s.players.necrons.supply, wallet)
  assert.deepEqual(enhancementBearers(s.players.necrons, e.id), ['third-warriors'])
})

test('Readiness includes optional enhancements and limits Upgrade by all existing bound bearers', () => {
  const s = setup()
  assert.equal(maximumReady(s, 'deathwatch'), 500)
  assert.equal(maximumReady(s, 'necrons'), 495)
  const e: Enhancement = {
    id: 'bounded-upgrade',
    name: 'Bounded Upgrade',
    cost: 20,
    eligible: [],
    upgrade: true,
    detachment: s.players.necrons.package[0],
  }
  s.snapshot.enhancements = [e]
  bindEnhancement(s.players.necrons, e.id, ['absent-1', 'absent-2', 'absent-3'])
  assert.equal(maximumReady(s, 'necrons'), 475)
})

test('Pantheon binding is mandatory, priced once and cannot be assigned as an optional enhancement', () => {
  const s = setup(),
    leader = ownCharacter(s)
  const c = {
    ...structuredClone(entry(s, leader)),
    id: 'void-dragon-reference',
    datasheet: "C'tan Shard of the Void Dragon",
    epic: true,
    rc: 300,
    copyPrices: [300],
  }
  s.snapshot.catalog.push(c)
  expandStartingCatalogue(s)
  expandStartingCatalogue(s)
  assert.equal(c.packageCosts?.length, 1)
  assert.equal(c.packageCosts![0].cost, 35)
  assert.equal(c.packageCosts![0].optional, undefined)
  assert(!s.snapshot.enhancements.some((e) => e.name === 'Animus Damper'))
  s.units.push({ ...structuredClone(leader), id: 'void-dragon', catalogId: c.id, rc: c.rc })
  s.players.necrons.package = [c.packageCosts![0].detachments[0]]
  s.stage = 3
  s.battles = 6
  declareBattle(s, 'X', 'deathwatch', false, context(), 'encounter')
  const m = startingArmyPreview(s, 'necrons').muster
  const costs = validateMuster(s, 'necrons', m)
  assert.equal(costs['void-dragon'], 335)
})
