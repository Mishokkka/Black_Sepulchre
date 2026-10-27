import assert from 'node:assert/strict'
import test from 'node:test'
import { generateTerrain, infantryCanReachObjects } from '../shared/terrain.ts'
import { createTable } from '../shared/table.ts'
import { STAGES } from '../shared/rules.ts'
import { MISSION_CARDS } from '../shared/rules.generated.ts'
import { context, fixture } from './fixture.ts'

const distance = (
  p: { x: number; y: number; width: number; height: number },
  x: number,
  y: number,
) => Math.hypot(Math.max(p.x - x, 0, x - p.x - p.width), Math.max(p.y - y, 0, y - p.y - p.height))

test('Tomb Street objectives are at the centres of its three lanes', () => {
  const s = fixture()
  s.stage = 2
  assert.deepEqual(
    createTable(s, 'I2', context()).objects.map((o) => o.x),
    [10, 30, 50],
  )
})

test('terrain remains reproducible and varies with the shared battle ID', () => {
  const input = {
    battleId: 'battle-1',
    mission: 'F1',
    length: 44,
    width: 30,
    deployment: 7,
    objects: [
      { x: 11, y: 15 },
      { x: 22, y: 15 },
      { x: 33, y: 15 },
    ],
  }
  const first = generateTerrain(input)
  assert.deepEqual(generateTerrain(input), first)
  assert.notDeepEqual(generateTerrain({ ...input, battleId: 'battle-2' }).pieces, first.pieces)
  // A published v1 battle must not change when future terrain algorithms are added.
  assert.equal(first.code, '0XDQWRY')
  assert.deepEqual(
    first.pieces.map((p) => [p.id, p.x, p.y, p.width, p.height, p.kind]),
    [
      ['1A', 37, 2, 6, 4, 'dense'],
      ['1B', 1, 24, 6, 4, 'dense'],
      ['2A', 11, 7, 6, 4, 'dense'],
      ['2B', 27, 19, 6, 4, 'dense'],
      ['3A', 36, 12, 6, 4, 'dense'],
      ['3B', 2, 14, 6, 4, 'dense'],
      ['4A', 28, 10, 6, 2, 'light'],
      ['4B', 10, 18, 6, 2, 'light'],
    ],
  )
})

test('all campaign mission geometries have paired terrain, accessible points and the PACT sight lines', () => {
  const s = fixture()
  s.battles = 16
  s.choir = 6
  const missions = [...Object.keys(MISSION_CARDS), 'encounter', 'WAR', 'PACT']
  for (const stage of [0, 1, 2]) {
    s.stage = stage
    for (const mission of missions) {
      if (['WAR', 'PACT'].includes(mission) && stage !== 2) continue
      const size = ['WAR', 'PACT'].includes(mission) ? { l: 60, w: 44, d: 12 } : STAGES[stage]
      const objects = createTable(s, mission, context()).objects
      const plan = generateTerrain({
        battleId: `battle-${stage}-${mission}`,
        mission,
        length: size.l,
        width: size.w,
        deployment: size.d,
        objects,
      })
      assert.ok(plan.pieces.length >= 6, `${mission} / ${size.l}×${size.w}: too little terrain`)
      assert.ok(
        infantryCanReachObjects(size.l, size.w, mission === 'C3', plan.pieces, objects),
        mission,
      )
      const onAttackerSide = (p: (typeof plan.pieces)[number]) =>
        mission === 'C3' ? p.x + p.width <= size.d : p.y + p.height <= size.d
      const inMiddle = (p: (typeof plan.pieces)[number]) =>
        mission === 'C3'
          ? p.x >= size.d && p.x + p.width <= size.l - size.d
          : p.y >= size.d && p.y + p.height <= size.w - size.d
      assert.ok(
        plan.pieces.some((p) => p.kind === 'dense' && onAttackerSide(p)),
        `${mission}: deployment cover`,
      )
      assert.ok(
        plan.pieces.some((p) => p.kind === 'dense' && inMiddle(p)),
        `${mission}: forward cover`,
      )
      for (let i = 0; i < plan.pieces.length; i += 2) {
        const a = plan.pieces[i],
          b = plan.pieces[i + 1]
        assert.equal(a.kind, b.kind)
        assert.equal(a.x + b.x + a.width, size.l)
        assert.equal(a.y + b.y + a.height, size.w)
        for (const p of [a, b]) {
          assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.width <= size.l && p.y + p.height <= size.w)
          for (const o of objects)
            assert.ok(distance(p, o.x, o.y) >= 3, `${mission}: object clearance`)
          if (mission === 'PACT')
            for (const o of objects)
              assert.ok(o.x < p.x - 0.5 || o.x > p.x + p.width + 0.5, 'PACT sight line')
        }
      }
    }
  }
})
