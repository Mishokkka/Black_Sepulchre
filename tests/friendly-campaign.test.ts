import { test } from 'node:test'
import assert from 'node:assert/strict'
import { command } from '../shared/engine.ts'
import { declareBattle } from '../shared/battle.ts'
import { SITE_RULES_SOURCE } from '../shared/snapshot.ts'
import { fixture, context } from './fixture.ts'
import type { State, Side } from '../shared/model.ts'

const run = (s: State, type: string, payload = {}, side: Side = 'deathwatch') =>
  command(s, { type, payload }, context(side))

function setup() {
  const s = fixture()
  s.phase = 'setup'
  s.activation = null
  s.setupApproved = []
  s.snapshot.sources = []
  s.snapshot.approved = []
  for (const d of s.snapshot.detachments) d.name = `Укажите legal Detachment ${d.side}`
  return s
}

test('Owner agreement accepts site data without changing armies, resources or phase', () => {
  const old = setup()
  const next = run(old, 'accept_site_rules')
  assert.deepEqual(next.snapshot.approved, ['deathwatch', 'necrons'])
  assert.deepEqual(next.snapshot.sources, [SITE_RULES_SOURCE])
  assert.deepEqual(next.units, old.units)
  assert.deepEqual(next.players, old.players)
  assert.deepEqual(next.sectors, old.sectors)
  assert.deepEqual(next.setupApproved, [])
  assert.equal(next.phase, 'setup')
  assert.equal(next.flags.siteRulesAccepted, true)
  assert(next.snapshot.detachments.every((d) => !d.name.startsWith('Укажите')))
})

test('Armies can become ready and start without document fields or catalogue signatures', () => {
  let s = setup()
  s = run(s, 'ready_army')
  assert.equal(s.phase, 'setup')
  assert.deepEqual(s.setupApproved, ['deathwatch'])
  assert.deepEqual(s.snapshot.approved, ['deathwatch', 'necrons'])
  s = run(s, 'ready_army', {}, 'necrons')
  assert.equal(s.phase, 'strategy')
  assert(s.activation)
})

test('A catalogue save preserves army readiness and detachment locks', () => {
  let s = setup()
  s = run(s, 'ready_army')
  const before = structuredClone(s.players)
  const snapshot = structuredClone(s.snapshot)
  snapshot.catalog.push({ ...snapshot.catalog[0], id: 'additional-variant' })
  s = run(s, 'save_catalog', { snapshot })
  assert.deepEqual(s.setupApproved, ['deathwatch'])
  for (const side of ['deathwatch', 'necrons'] as Side[]) {
    assert.deepEqual(s.players[side].package, before[side].package)
    assert.equal(s.players[side].packageStage, before[side].packageStage)
    assert.equal(s.players[side].supply, before[side].supply)
  }
  assert.equal(s.snapshotProposal, null)
  s = run(s, 'ready_army', {}, 'necrons')
  assert.equal(s.phase, 'strategy')
})

test('Starting again validates a previously ready army after a price change', () => {
  let s = run(setup(), 'ready_army')
  const snapshot = structuredClone(s.snapshot)
  snapshot.catalog.find((c) => c.side === 'deathwatch')!.rc += 50
  s = run(s, 'save_catalog', { snapshot })
  assert.throws(() => run(s, 'ready_army', {}, 'necrons'), /AL|лимит|470|500/)
  assert.equal(s.phase, 'setup')
})

test('Old browser catalogue commands apply without waiting for the friend', () => {
  let s = fixture()
  const snapshot = structuredClone(s.snapshot)
  snapshot.catalog[0].rc += 5
  s = run(s, 'propose_snapshot', { snapshot })
  assert.equal(s.units[0].rc, snapshot.catalog[0].rc)
  assert.equal(s.snapshotProposal, null)
  assert.doesNotThrow(() => run(s, 'action', { action: 'recon' }))
})

test('Catalogue edits during an announced battle remain blocked and its cards stay fixed', () => {
  const s = fixture()
  s.players.deathwatch.mf = 'D'
  s.players.necrons.mf = 'F'
  declareBattle(s, 'F', 'deathwatch', false, context())
  const frozen = structuredClone(s.battle!.snapshot)
  const snapshot = structuredClone(s.snapshot)
  snapshot.catalog[0].rc += 5
  assert.throws(() => run(s, 'save_catalog', { snapshot }), /между боями/)
  assert.deepEqual(s.battle!.snapshot, frozen)
})
