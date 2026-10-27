import assert from 'node:assert/strict'
import test from 'node:test'
import {
  containsPoint,
  generateTerrain,
  hasLegacyI2Coordinates,
  infantryCanReachObjects,
  isTerrainObjective,
  terrainWalls,
  vehicleCanCross,
} from '../shared/terrain.ts'
import { createTable } from '../shared/table.ts'
import { STAGES } from '../shared/rules.ts'
import { MISSION_CARDS } from '../shared/rules.generated.ts'
import { context, fixture } from './fixture.ts'

type Rect = { x: number; y: number; width: number; height: number }
const distance = (a: Rect, b: Rect) =>
  Math.hypot(
    Math.max(a.x - b.x - b.width, b.x - a.x - a.width, 0),
    Math.max(a.y - b.y - b.height, b.y - a.y - a.height, 0),
  )

// Independent point/line distance, including the endpoints of a wall segment.
const distanceToWall = (
  wall: { x1: number; y1: number; x2: number; y2: number },
  x: number,
  y: number,
) => {
  const dx = wall.x2 - wall.x1
  const dy = wall.y2 - wall.y1
  const fraction = Math.max(
    0,
    Math.min(1, ((x - wall.x1) * dx + (y - wall.y1) * dy) / (dx * dx + dy * dy)),
  )
  return Math.hypot(x - wall.x1 - fraction * dx, y - wall.y1 - fraction * dy)
}

test('Tomb Street objectives are at the centres of its three lanes', () => {
  const s = fixture()
  s.stage = 2
  assert.deepEqual(
    createTable(s, 'I2', context()).objects.map((o) => o.x),
    [10, 30, 50],
  )
})

test('already-created I2 battles retain their legacy coordinates', () => {
  const s = fixture()
  for (const stage of [0, 1, 2]) {
    s.stage = stage
    const { l, w } = STAGES[stage]
    const objects = createTable(s, 'I2', context()).objects
    assert.equal(hasLegacyI2Coordinates(l, w, objects), false)
    const old = objects.map((o) => ({ ...o }))
    old.forEach((o, i) => {
      o.x = l * [0.25, 0.5, 0.75][i]
    })
    assert.equal(hasLegacyI2Coordinates(l, w, old), true)
    assert.ok(old.every((o) => !isTerrainObjective('I2', o, true)))
    const plan = generateTerrain({
      battleId: 'old-i2',
      mission: 'I2',
      length: l,
      width: w,
      deployment: STAGES[stage].d,
      objects: old,
      legacyI2: true,
    })
    assert.ok(
      plan.pieces.every((p) => !p.objectiveId),
      'legacy I2 must keep marker objectives',
    )
    old[0].kind = 'item'
    assert.equal(hasLegacyI2Coordinates(l, w, old), false)
  }
})

test('terrain remains reproducible and varies with the shared battle ID', () => {
  const input = {
    battleId: 'battle-1',
    mission: 'F1',
    length: 44,
    width: 30,
    deployment: 7,
    objects: [
      { id: '1', kind: 'objective' as const, x: 11, y: 15 },
      { id: '2', kind: 'objective' as const, x: 22, y: 15 },
      { id: '3', kind: 'objective' as const, x: 33, y: 15 },
    ],
  }
  const first = generateTerrain(input)
  assert.deepEqual(generateTerrain(input), first)
  assert.notDeepEqual(generateTerrain({ ...input, battleId: 'battle-2' }).pieces, first.pieces)
  assert.equal(first.code, '0XDQWRY')
  // Once published, the same version and public battle ID must keep their layout.
  assert.deepEqual(
    first.pieces.map((p) => [p.id, p.x, p.y, p.width, p.height, p.kind]),
    [
      ['1A', 37, 2, 6, 4, 'dense'],
      ['1B', 1, 24, 6, 4, 'dense'],
      ['2A', 15, 2, 6, 4, 'dense'],
      ['2B', 23, 24, 6, 4, 'dense'],
      ['3A', 13, 8, 8, 4, 'dense'],
      ['3B', 23, 18, 8, 4, 'dense'],
      ['4A', 1, 12, 6, 4, 'dense'],
      ['4B', 37, 14, 6, 4, 'dense'],
      ['5A', 24, 12, 6, 4, 'light'],
      ['5B', 14, 14, 6, 4, 'light'],
      ['6A', 26, 8, 6, 2, 'light'],
      ['6B', 12, 20, 6, 2, 'light'],
    ],
  )
})

test('the campaign chooses terrain objectives explicitly without converting items or hidden signals', () => {
  const s = fixture()
  const selected: Record<string, string[]> = {
    A2: ['2'],
    K2: ['2'],
    B2: ['1'],
    H1: ['1', '2', '3', '4', '5'],
    I1: ['5'],
    I2: ['1', '2', '3'],
  }
  for (const [mission, ids] of Object.entries(selected)) {
    const objects = createTable(s, mission, context()).objects
    assert.deepEqual(
      objects.filter((o) => isTerrainObjective(mission, o)).map((o) => o.id),
      ids,
      mission,
    )
    assert.equal(isTerrainObjective(mission, { id: ids[0], kind: 'item', x: 0, y: 0 }), false)
  }
  for (const mission of ['F1', 'G1', 'G3', 'F2', 'A3', 'B1', 'B3', 'C2']) {
    const objects = createTable(s, mission, context()).objects
    assert.ok(
      objects.every((o) => !isTerrainObjective(mission, o)),
      mission,
    )
  }
})

test('all mission layouts have rotated areas, accessible points, routes and mission-specific geometry', () => {
  const s = fixture()
  s.battles = 16
  s.choir = 6
  const missions = [...Object.keys(MISSION_CARDS), 'encounter', 'WAR', 'PACT']
  let markersInside = 0
  let markersOutside = 0
  let layouts = 0
  for (const stage of [0, 1, 2]) {
    s.stage = stage
    for (const mission of missions) {
      if (['WAR', 'PACT'].includes(mission) && stage !== 2) continue
      const size = ['WAR', 'PACT'].includes(mission) ? { l: 60, w: 44, d: 12 } : STAGES[stage]
      const objects = createTable(s, mission, context()).objects
      for (let variant = 0; variant < 8; variant++) {
        const scenario = `${mission} / ${size.l}×${size.w} / ${variant}`
        const plan = generateTerrain({
          battleId: `sample-${variant}-${mission}`,
          mission,
          length: size.l,
          width: size.w,
          deployment: size.d,
          objects,
        })
        layouts++
        assert.ok(plan.pieces.length >= 10, `${scenario}: terrain count`)
        assert.ok(
          infantryCanReachObjects(size.l, size.w, mission === 'C3', plan.pieces, objects),
          `${scenario}: access`,
        )
        assert.ok(
          vehicleCanCross(size.l, size.w, mission === 'C3', plan.pieces),
          `${scenario}: vehicle route`,
        )
        const home = plan.pieces.filter(
          (p) =>
            p.kind === 'dense' &&
            (mission === 'C3' ? p.x + p.width <= size.d : p.y + p.height <= size.d),
        )
        const away = plan.pieces.filter(
          (p) =>
            p.kind === 'dense' &&
            (mission === 'C3' ? p.x >= size.l - size.d : p.y >= size.w - size.d),
        )
        assert.ok(
          home.length >= 2 && away.length >= 2,
          `${scenario}: cover in both deployment zones`,
        )
        for (const p of plan.pieces) {
          assert.ok(
            p.x >= 0 && p.y >= 0 && p.x + p.width <= size.l && p.y + p.height <= size.w,
            scenario,
          )
          if (p.symmetric) {
            assert.equal(p.x * 2 + p.width, size.l, scenario)
            assert.equal(p.y * 2 + p.height, size.w, scenario)
          } else {
            assert.ok(
              plan.pieces.some(
                (other) =>
                  other !== p &&
                  other.kind === p.kind &&
                  Math.abs(p.x + other.x + p.width - size.l) < 0.001 &&
                  Math.abs(p.y + other.y + p.height - size.w) < 0.001 &&
                  p.width === other.width &&
                  p.height === other.height,
              ),
              `${scenario}: missing rotated partner`,
            )
          }
          for (const other of plan.pieces)
            if (other !== p)
              assert.ok(distance(p, other) >= 2 - 0.001, `${scenario}: overlapping areas`)
          for (const o of objects)
            for (const wall of terrainWalls(p))
              assert.ok(
                distanceToWall(wall, o.x, o.y) >= 1.05 - 0.001,
                `${scenario}: wall on object ${o.id}`,
              )
          if (mission === 'PACT')
            for (const o of objects)
              assert.ok(
                o.x < p.x - 0.5 || o.x > p.x + p.width + 0.5,
                `${scenario}: Seal sight line`,
              )
          if (p.objectiveId) {
            const object = objects.find((o) => o.id === p.objectiveId)
            assert.ok(
              object && isTerrainObjective(mission, object),
              `${scenario}: wrong area objective`,
            )
            assert.ok(
              containsPoint(p, object.x, object.y),
              `${scenario}: objective outside its area`,
            )
            if (mission === 'I2') {
              const lane = Number(p.objectiveId) - 1
              assert.ok(
                p.x >= (lane * size.l) / 3 && p.x + p.width <= ((lane + 1) * size.l) / 3,
                `${scenario}: wrong lane`,
              )
            }
          }
        }
        for (const o of objects) {
          const selected = isTerrainObjective(mission, o)
          assert.equal(
            plan.pieces.filter((p) => p.objectiveId === o.id).length,
            selected ? 1 : 0,
            scenario,
          )
          if (o.kind === 'objective' && !selected) {
            if (plan.pieces.some((p) => containsPoint(p, o.x, o.y))) markersInside++
            else markersOutside++
          }
        }
      }
    }
  }
  assert.ok(layouts >= 800, `only ${layouts} layouts checked`)
  assert.ok(
    markersInside > 0 && markersOutside > 0,
    'marker objectives must be possible both inside and outside terrain',
  )
})
