import assert from 'node:assert/strict'
import test from 'node:test'
import { declareBattle } from '../shared/battle.ts'
import { battlefieldFor, createBattlefield } from '../shared/battlefield.ts'
import { command, project } from '../shared/engine.ts'
import type { Battle, SectorKey, State } from '../shared/model.ts'
import { MISSION_CARDS } from '../shared/rules.generated.ts'
import { createTable } from '../shared/table.ts'
import { terrainProfile, terrainWalls } from '../shared/terrain.ts'
import { context, fixture } from './fixture.ts'

function selected(mission: string, stage = 0) {
  const s = fixture()
  s.stage = stage
  const special = ['WAR', 'PACT', 'encounter'].includes(mission)
  declareBattle(
    s,
    special ? 'X' : (mission[0] as SectorKey),
    'deathwatch',
    false,
    context(),
    special ? (mission as Battle['type']) : undefined,
  )
  s.battle!.options = [mission]
  s.battle!.usedMissions = [mission]
  return command(s, { type: 'choose_mission', payload: { code: mission } }, context())
}

test('every mission freezes public battlefield geometry that survives JSON and both projections', () => {
  for (const stage of [0, 1, 2])
    for (const mission of [...Object.keys(MISSION_CARDS), 'encounter', 'WAR', 'PACT']) {
      if (['WAR', 'PACT'].includes(mission) && stage !== 2) continue
      const s = selected(mission, stage)
      const setup = s.battle!.battlefield!
      assert.equal(setup.mission, mission)
      assert.equal(setup.version, 2)
      assert.equal(setup.terrain.version, 2)
      assert.ok(setup.terrain.pieces.length >= 10)
      for (const object of setup.objects)
        assert.deepEqual(Object.keys(object).sort(), ['id', 'kind', 'x', 'y'])
      assert.ok(!JSON.stringify(setup).includes('trueSignal'))
      for (const p of setup.terrain.pieces) {
        assert.ok(p.walls?.length)
        assert.deepEqual(terrainWalls(p), p.walls)
        assert.deepEqual(p.profile, {
          wallHeight: p.kind === 'dense' ? 4 : 1,
          maxWallThickness: 0.45,
          elevatedFloors: p.platforms?.length ? 1 : 0,
        })
        assert.deepEqual(terrainProfile(p), p.profile)
      }
      assert.equal(setup.terrain.pieces.filter((p) => p.platforms?.length).length, 2)
      const restored = JSON.parse(JSON.stringify(s)) as State
      assert.deepEqual(battlefieldFor(restored), setup)
      for (const side of ['deathwatch', 'necrons'] as const)
        assert.deepEqual(battlefieldFor(project(restored, side)), setup)
    }
})

test('later table movement and campaign changes cannot change a saved starting battlefield', () => {
  const s = selected('A2')
  const saved = structuredClone(s.battle!.battlefield!)
  s.stage = 2
  s.choir = 6
  s.battles = 16
  s.battle!.table.objects[0].x += 9
  assert.deepEqual(battlefieldFor(s), saved)
  assert.ok(!battlefieldFor(s).objects.some((o) => o.id === 'index'))
  const piece = saved.terrain.pieces[0]
  assert.deepEqual(terrainWalls({ ...piece, x: piece.x + 1 }), piece.walls)
  const custom = { wallHeight: 5, maxWallThickness: 0.3, elevatedFloors: 0 as const }
  assert.deepEqual(terrainProfile({ ...piece, profile: custom }), custom)
})

test('saved v1 and unsaved legacy battles keep their original ground-only setup', () => {
  const s = selected('F1', 2)
  s.battle!.battlefield = createBattlefield(s, s.battle!.table.objects, 1)
  const saved = structuredClone(s.battle!.battlefield)
  assert.equal(saved.terrain.version, 1)
  assert.ok(saved.terrain.pieces.every((p) => !p.outline && !p.platforms))
  assert.deepEqual(battlefieldFor(JSON.parse(JSON.stringify(s))), saved)
  delete s.battle!.battlefield
  assert.deepEqual(battlefieldFor(s), saved)
})

test('a mission reroll replaces the saved setup without spending extra game dice', () => {
  const s = selected('F1')
  s.battle!.usedMissions = ['F1', 'F2']
  const previous = structuredClone(s.battle!.battlefield)
  const next = command(s, { type: 'mission_reroll', payload: {} }, context())
  assert.equal(next.battle!.battlefield!.mission, 'F2')
  assert.notEqual(next.battle!.battlefield!.terrain.code, previous!.terrain.code)
  assert.deepEqual(next.log.at(-1)!.dice, [1])
  assert.ok(next.battle!.battlefield!.objects.every((o) => o.kind === 'interaction'))
  assert.deepEqual(
    battlefieldFor(project(next, 'deathwatch')),
    battlefieldFor(project(next, 'necrons')),
  )
})

test('legacy I2 keeps its markers and coordinates without mutating state on read', () => {
  const s = selected('I2')
  delete s.battle!.battlefield
  s.battle!.table.objects.forEach((o, i) => {
    o.x = 44 * [0.25, 0.5, 0.75][i]
  })
  const before = JSON.stringify(s)
  const setup = battlefieldFor(s)
  assert.equal(setup.version, 1)
  assert.equal(setup.legacyI2, true)
  assert.deepEqual(
    setup.objects.map((o) => o.x),
    [11, 22, 33],
  )
  assert.ok(setup.terrain.pieces.every((p) => !p.objectiveId))
  assert.equal(JSON.stringify(s), before)
  assert.equal(s.battle!.battlefield, undefined)
})

test('legacy moving objects are reconstructed at their initial positions', () => {
  for (const mission of ['B3', 'E1', 'C2']) {
    const s = selected(mission)
    delete s.battle!.battlefield
    const initial = createTable(s, mission, context()).objects[0]
    s.battle!.table.objects[0].x += 9
    s.battle!.table.objects[0].y += 4
    assert.deepEqual(battlefieldFor(s).objects[0], {
      id: initial.id,
      kind: initial.kind,
      x: initial.x,
      y: initial.y,
    })
  }
})
