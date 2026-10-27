import type { MissionObject, State } from './model.ts'
import { STAGES } from './rules.ts'
import { createTable } from './table.ts'
import { generateTerrain, hasLegacyI2Coordinates, type TerrainPlan } from './terrain.ts'
import { generateTerrainV2 } from './terrain-v2.ts'

export type BattlefieldObject = Pick<MissionObject, 'id' | 'kind' | 'x' | 'y'>

/** Public setup frozen with the battle, independently of later table actions. */
export interface BattlefieldSetup {
  version: 1 | 2
  mission: string
  length: number
  width: number
  deployment: number
  legacyI2: boolean
  objects: BattlefieldObject[]
  terrain: TerrainPlan
}

/** Capture only public initial geometry; never copy records, tags or hidden choices. */
export function createBattlefield(
  s: State,
  initialObjects?: readonly BattlefieldObject[],
  version: 1 | 2 = 2,
): BattlefieldSetup {
  const b = s.battle
  if (!b) throw new Error('Нет текущего боя')
  const mission = b.mission ?? b.type
  const size = ['WAR', 'PACT'].includes(b.type) ? { l: 60, w: 44, d: 12 } : STAGES[b.stage]
  const initial =
    initialObjects ??
    createTable({ ...s, stage: b.stage, battles: b.number - 1 }, mission, {
      actor: b.attacker,
      dice: () => 1,
      id: () => '',
    }).objects
  const objects = initial.map(({ id, kind, x, y }) => ({ id, kind, x, y }))
  const legacyI2 = mission === 'I2' && hasLegacyI2Coordinates(size.l, size.w, b.table.objects)
  if (legacyI2)
    for (const object of objects) {
      const saved = b.table.objects.find((o) => o.id === object.id)
      if (saved && ['1', '2', '3'].includes(object.id)) {
        object.x = saved.x
        object.y = saved.y
      }
    }
  return {
    version,
    mission,
    length: size.l,
    width: size.w,
    deployment: size.d,
    legacyI2,
    objects,
    terrain: (version === 1 ? generateTerrain : generateTerrainV2)({
      battleId: b.id,
      mission,
      length: size.l,
      width: size.w,
      deployment: size.d,
      objects,
      legacyI2,
    }),
  }
}

/** Old battles use the original deterministic fallback without writing during a read. */
export function battlefieldFor(s: State): BattlefieldSetup {
  const b = s.battle
  if (!b) throw new Error('Нет текущего боя')
  return b.battlefield?.mission === (b.mission ?? b.type)
    ? b.battlefield
    : createBattlefield(s, undefined, 1)
}
