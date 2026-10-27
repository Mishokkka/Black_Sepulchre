import assert from 'node:assert/strict'
import test from 'node:test'
import {
  containsPoint,
  terrainArea,
  terrainOutline,
  terrainWalls,
  type TerrainPiece,
} from '../shared/terrain.ts'
import {
  generateTerrainV2,
  largestOpenLane,
  terrainKit,
  vehicleCanCrossV2,
} from '../shared/terrain-v2.ts'
import { createTable } from '../shared/table.ts'
import { STAGES } from '../shared/rules.ts'
import { MISSION_CARDS } from '../shared/rules.generated.ts'
import { context, fixture } from './fixture.ts'

const distance = (a: TerrainPiece, b: TerrainPiece) =>
  Math.hypot(
    Math.max(a.x - b.x - b.width, b.x - a.x - a.width, 0),
    Math.max(a.y - b.y - b.height, b.y - a.y - a.height, 0),
  )
const close = (a: number, b: number) => Math.abs(a - b) < 1e-6

test('polygon boundaries exclude the clipped corner and use the actual footprint area', () => {
  const p: TerrainPiece = {
    id: 'P',
    kind: 'dense',
    x: 0,
    y: 0,
    width: 8,
    height: 6,
    mirrored: false,
    outline: [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 8, y: 2 },
      { x: 8, y: 6 },
      { x: 0, y: 6 },
    ],
  }
  assert.equal(containsPoint(p, 7.9, 0.1), false)
  assert.equal(containsPoint(p, 7, 1), true)
  assert.equal(containsPoint(p, 4, 3), true)
  assert.equal(terrainArea(p), 46)
  assert.equal(terrainArea({ ...p, outline: undefined }), 48)
})

test('the vehicle route avoids low ceilings and respects the complete circular base', () => {
  const p: TerrainPiece = {
    id: 'F',
    kind: 'dense',
    x: 0,
    y: 8,
    width: 20,
    height: 4,
    mirrored: false,
    walls: [],
    platforms: [{ x: 0, y: 8, width: 20, height: 4, elevation: 3, thickness: 0.15 }],
  }
  assert.equal(vehicleCanCrossV2(20, 20, false, [p]), false)
  assert.equal(vehicleCanCrossV2(20, 20, false, [{ ...p, platforms: [] }]), true)
  assert.equal(vehicleCanCrossV2(20, 20, true, [p]), true)
})

test('all campaign missions scale their v2 kit, retain goals and provide paired floors and routes', () => {
  const s = fixture()
  s.battles = 16
  s.choir = 6
  let count = 0
  for (const stage of [0, 1, 2])
    for (const mission of [...Object.keys(MISSION_CARDS), 'encounter', 'WAR', 'PACT']) {
      if (['WAR', 'PACT'].includes(mission) && stage !== 2) continue
      s.stage = stage
      const size = ['WAR', 'PACT'].includes(mission) ? { l: 60, w: 44, d: 12 } : STAGES[stage]
      const objects = createTable(s, mission, context()).objects
      for (let variant = 0; variant < 8; variant++) {
        const label = `${mission}/${size.l}x${size.w}/${variant}`
        const input = {
          battleId: `v2-audit-${variant}-${mission}`,
          mission,
          length: size.l,
          width: size.w,
          deployment: size.d,
          objects,
        }
        const plan = generateTerrainV2(input),
          pieces = plan.pieces,
          short = mission === 'C3',
          kit = terrainKit(size.l, size.w)
        count++
        assert.equal(plan.version, 2, label)
        assert.equal(plan.tableProfile, kit.name, label)
        assert.ok(pieces.length >= 10, label)
        const ratio = pieces.reduce((sum, p) => sum + terrainArea(p), 0) / (size.l * size.w)
        assert.ok(ratio >= 0.24 && ratio <= 0.33, `${label}: coverage ${ratio}`)
        assert.ok(largestOpenLane(size.l, size.w, short, pieces) <= 6, `${label}: exposed strip`)
        assert.ok(vehicleCanCrossV2(size.l, size.w, short, pieces), `${label}: vehicle route`)
        const floors = pieces.filter((p) => p.platforms?.length)
        assert.equal(floors.length, 2, `${label}: paired floors`)
        assert.ok(
          pieces.some((p) => p.kind === 'light' && Math.max(p.width, p.height) >= kit.strip[0]),
          `${label}: long strip`,
        )
        for (const fromEnd of [false, true]) {
          const home = pieces.filter(
            (p) =>
              p.kind === 'dense' &&
              (short
                ? fromEnd
                  ? p.x >= size.l - size.d
                  : p.x + p.width <= size.d
                : fromEnd
                  ? p.y >= size.w - size.d
                  : p.y + p.height <= size.d),
          )
          assert.ok(home.length >= 2, `${label}: home cover`)
        }
        for (const p of pieces) {
          assert.ok(
            p.x >= 1 && p.y >= 1 && p.x + p.width <= size.l - 1 && p.y + p.height <= size.w - 1,
            label,
          )
          for (const other of pieces)
            if (other !== p) assert.ok(distance(p, other) >= 1 - 1e-6, `${label}: area overlap`)
          for (const point of terrainOutline(p))
            assert.ok(containsPoint(p, point.x, point.y), label)
          for (const wall of terrainWalls(p)) {
            assert.ok(
              containsPoint(p, wall.x1, wall.y1) && containsPoint(p, wall.x2, wall.y2),
              `${label}: wall outside polygon`,
            )
            for (const o of objects) {
              const dx = wall.x2 - wall.x1,
                dy = wall.y2 - wall.y1
              const t = Math.max(
                0,
                Math.min(1, ((o.x - wall.x1) * dx + (o.y - wall.y1) * dy) / (dx * dx + dy * dy)),
              )
              assert.ok(
                Math.hypot(o.x - wall.x1 - t * dx, o.y - wall.y1 - t * dy) >= 1.05 - 1e-6,
                `${label}: wall on object`,
              )
            }
            if (['B3', 'E1', 'C2'].includes(mission) && p.kind === 'dense') {
              const a = mission === 'C2' ? wall.x1 - size.l / 2 : wall.y1 - size.w / 2
              const b = mission === 'C2' ? wall.x2 - size.l / 2 : wall.y2 - size.w / 2
              assert.ok(
                a * b > 0 && Math.min(Math.abs(a), Math.abs(b)) >= 2.25,
                `${label}: moving route`,
              )
            }
          }
          if (p.kind === 'light') {
            const wall = terrainWalls(p)[0]
            assert.ok(
              close(
                Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1),
                Math.max(p.width, p.height) - 1.4,
              ),
              `${label}: rotated barrier`,
            )
          }
          if (p.objectiveId)
            assert.equal(p.width * p.height, 24, `${label}: objective footprint changed`)
          for (const f of p.platforms ?? []) {
            assert.equal(f.elevation, 3, label)
            assert.equal(f.thickness, 0.15, label)
            assert.ok(f.width >= 3 && f.height >= 3, label)
            for (const o of objects)
              assert.ok(
                Math.hypot(
                  Math.max(f.x - o.x, o.x - f.x - f.width, 0),
                  Math.max(f.y - o.y, o.y - f.y - f.height, 0),
                ) >= 1.05,
                `${label}: low ceiling over a mission object`,
              )
            for (const x of [f.x, f.x + f.width])
              for (const y of [f.y, f.y + f.height])
                assert.ok(containsPoint(p, x, y), `${label}: floor outside area`)
          }
          if (mission === 'PACT')
            for (const o of objects)
              assert.ok(o.x < p.x - 0.5 || o.x > p.x + p.width + 0.5, `${label}: Seal sightline`)
          if (!p.symmetric) {
            const partner = pieces.find(
              (q) =>
                q !== p &&
                q.kind === p.kind &&
                close(q.x + p.x + p.width, size.l) &&
                close(q.y + p.y + p.height, size.w) &&
                q.width === p.width &&
                q.height === p.height,
            )
            assert.ok(partner, `${label}: symmetry`)
            for (const v of terrainOutline(p))
              assert.ok(
                terrainOutline(partner).some(
                  (q) => close(v.x + q.x, size.l) && close(v.y + q.y, size.w),
                ),
                `${label}: polygon symmetry`,
              )
            for (const f of p.platforms ?? [])
              assert.ok(
                partner.platforms?.some(
                  (g) => close(f.x + g.x + f.width, size.l) && close(f.y + g.y + f.height, size.w),
                ),
                `${label}: floor symmetry`,
              )
          }
        }
      }
    }
  assert.equal(count, 832)
})

test('the public seed is reproducible and each table size has its own construction kit', () => {
  const input = {
    battleId: 'v2-repeat',
    mission: 'F1',
    length: 44,
    width: 30,
    deployment: 7,
    objects: [],
  }
  assert.deepEqual(generateTerrainV2(input), generateTerrainV2(input))
  assert.notDeepEqual(
    generateTerrainV2(input),
    generateTerrainV2({ ...input, battleId: 'different' }),
  )
  assert.deepEqual(
    ['compact', 'square', 'full'],
    [
      [44, 30],
      [44, 44],
      [60, 44],
    ].map(([l, w]) => terrainKit(l, w).name),
  )
})
