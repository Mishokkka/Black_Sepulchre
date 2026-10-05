import { test } from 'node:test'
import assert from 'node:assert/strict'
import { command } from '../shared/engine.ts'
import { strategyPreview, strategyRoutes } from '../shared/strategy-preview.ts'
import { addEffect } from '../shared/state.ts'
import { fixture, context } from './fixture.ts'

test('Route previews preserve the campaign and match friendly move and Occupation resource changes', () => {
  const s = fixture(),
    original = structuredClone(s)
  const routes = strategyRoutes(s, 'deathwatch', 'normal', false)
  assert.equal(routes.B.allowed, true)
  assert.equal(routes.C.allowed, true)
  assert.equal(routes.G.allowed, false)
  assert.equal(routes.A.allowed, false)
  const move = strategyPreview(s, 'deathwatch', 'move', { target: 'B', method: 'normal' })
  assert(move.allowed)
  assert.equal(move.after.mp, 1)
  assert.equal(move.after.actions, 2)
  assert.equal(move.outcome, 'move')
  const after = command(s, { type: 'move', payload: { target: 'B' } }, context())
  assert.equal(move.after.mp, after.activation!.mp)
  s.players.deathwatch.mf = 'D'
  const occupation = strategyPreview(s, 'deathwatch', 'attack', { target: 'G' })
  assert(occupation.allowed)
  assert.equal(occupation.outcome, 'occupation')
  assert.equal(occupation.after.mp, 0)
  assert.equal(occupation.after.actions, 0)
  assert.equal(occupation.phase, 'logistics')
  s.players.deathwatch.mf = 'A'
  assert.deepEqual(s, original)
})

test('Deep route display uses the engine discount and never consumes a token or reveals the rolled mission', () => {
  const s = fixture()
  s.players.deathwatch.mf = 'D'
  s.sectors.G.owner = 'deathwatch'
  s.sectors.E.owner = 'necrons'
  const original = structuredClone(s)
  const preview = strategyPreview(s, 'deathwatch', 'attack', { target: 'E', method: 'deep' })
  assert(preview.allowed)
  assert.equal(preview.before.intel - preview.after.intel, 1)
  assert.deepEqual(s, original)
  const committed = command(
    s,
    { type: 'attack', payload: { target: 'E', method: 'deep' } },
    context(),
  )
  assert.equal(preview.after.intel, committed.players.deathwatch.intel)
  s.players.deathwatch.flags.gDiscountStage = s.stage
  const blocked = strategyPreview(s, 'deathwatch', 'attack', { target: 'E', method: 'deep' })
  assert.equal(blocked.allowed, false)
  assert.match(blocked.reason, /Intel/)
  const contact = fixture()
  contact.players.deathwatch.mf = 'D'
  contact.players.necrons.mf = 'F'
  const battle = strategyPreview(contact, 'deathwatch', 'attack', { target: 'F', method: 'normal' })
  assert(battle.allowed)
  assert.equal(battle.outcome, 'contact')
  assert.equal('battle' in battle, false)
  assert.equal('mission' in battle, false)
  assert.equal('dice' in battle, false)
})

test('Previews reject empty raids, unsupplied Deep Raid, wrong actor and the closed reaction window', () => {
  const s = fixture()
  s.players.deathwatch.mf = 'D'
  assert.match(
    strategyPreview(s, 'deathwatch', 'attack', { target: 'G', raid: true }).reason,
    /Пустой сектор/,
  )
  s.players.deathwatch.mf = 'G'
  s.players.deathwatch.intel = 5
  assert.match(
    strategyPreview(s, 'deathwatch', 'attack', { target: 'I', method: 'deep' }).reason,
    /Supplied/,
  )
  assert.match(strategyPreview(s, 'necrons', 'move', { target: 'I' }).reason, /не ваша/)
  s.phase = 'reaction'
  assert.match(strategyPreview(s, 'deathwatch', 'action', { action: 'recon' }).reason, /не ваша/)
})

test('Airlift and Door Route use the selected physical Origin and preserve one-use effects', () => {
  const s = fixture()
  s.players.deathwatch.mf = 'C'
  s.activation!.origin = 'C'
  const airlift = strategyPreview(s, 'deathwatch', 'move', { target: 'B', method: 'airlift' })
  assert(airlift.allowed)
  assert.equal(airlift.after.intel, s.players.deathwatch.intel)
  assert.equal(airlift.after.mp, 1)
  addEffect(s, '64', 'deathwatch', 'route', { origin: 'C', target: 'I' })
  const before = structuredClone(s)
  const route = strategyPreview(s, 'deathwatch', 'attack', { target: 'I', method: 'route' })
  assert(route.allowed)
  assert.deepEqual(s, before)
  assert.match(
    strategyPreview(s, 'deathwatch', 'attack', { target: 'J', method: 'route' }).reason,
    /Route/,
  )
})

test('Missing Hour validates through its success branch and reports uncertainty without persisting rolls', () => {
  const s = fixture()
  addEffect(s, '23', 'deathwatch', 'activation')
  const original = structuredClone(s)
  const preview = strategyPreview(s, 'deathwatch', 'action', { action: 'recon' })
  assert(preview.allowed)
  assert.equal(preview.random, true)
  assert.equal(preview.after.actions, 1)
  assert.equal(preview.after.intel, 2)
  const fortify = strategyPreview(s, 'deathwatch', 'action', { action: 'fortify' })
  assert(fortify.allowed)
  assert.equal(fortify.after.supply, 25)
  s.players.deathwatch.supply = 0
  assert.match(strategyPreview(s, 'deathwatch', 'action', { action: 'fortify' }).reason, /Supply/)
  s.players.deathwatch.supply = original.players.deathwatch.supply
  assert.deepEqual(s, original)
})
