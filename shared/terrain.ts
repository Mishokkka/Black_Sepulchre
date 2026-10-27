/** Battlefield terrain for the campaign's fixed mission geometry, in inches.
 * Version 1 is deterministic: never change its placement rules for an existing battle.
 */
export interface TerrainObject {
  x: number
  y: number
}

export interface TerrainPiece {
  id: string
  kind: 'dense' | 'light'
  x: number
  y: number
  width: number
  height: number
  mirrored: boolean
}

export interface TerrainPlan {
  version: 1
  code: string
  pieces: TerrainPiece[]
}

interface Input {
  battleId: string
  mission: string
  length: number
  width: number
  deployment: number
  objects: TerrainObject[]
}

type Rect = Pick<TerrainPiece, 'x' | 'y' | 'width' | 'height'>
const pointDistance = (r: Rect, x: number, y: number) =>
  Math.hypot(Math.max(r.x - x, 0, x - r.x - r.width), Math.max(r.y - y, 0, y - r.y - r.height))
const rectDistance = (a: Rect, b: Rect) =>
  Math.hypot(
    Math.max(a.x - b.x - b.width, b.x - a.x - a.width, 0),
    Math.max(a.y - b.y - b.height, b.y - a.y - a.height, 0),
  )

function hash(value: string) {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619)
  return h >>> 0
}

function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let n = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n)
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(values: T[], roll: () => number) {
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(roll() * (i + 1))
    ;[values[i], values[j]] = [values[j], values[i]]
  }
  return values
}

/** A conservative 1-inch grid: treats entire terrain areas as obstacles and checks
 * that a small infantry base can reach every object from either deployment edge. */
export function infantryCanReachObjects(
  length: number,
  width: number,
  short: boolean,
  pieces: Rect[],
  objects: TerrainObject[],
) {
  function reachable(fromEnd: boolean) {
    const queue: number[] = []
    const seen = new Uint8Array(length * width)
    const add = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= length || y >= width) return
      const i = y * length + x
      if (seen[i] || pieces.some((p) => pointDistance(p, x + 0.5, y + 0.5) < 0.65)) return
      seen[i] = 1
      queue.push(i)
    }
    if (short) for (let y = 0; y < width; y++) add(fromEnd ? length - 1 : 0, y)
    else for (let x = 0; x < length; x++) add(x, fromEnd ? width - 1 : 0)
    for (let i = 0; i < queue.length; i++) {
      const x = queue[i] % length,
        y = Math.floor(queue[i] / length)
      add(x - 1, y)
      add(x + 1, y)
      add(x, y - 1)
      add(x, y + 1)
    }
    return objects.every((o) =>
      queue.some(
        (i) => Math.hypot((i % length) + 0.5 - o.x, Math.floor(i / length) + 0.5 - o.y) < 2.5,
      ),
    )
  }
  return reachable(false) && reachable(true)
}

/** Create paired terrain areas. Both players reconstruct the same plan from the
 * public battle ID and mission; no private choices or current unit positions enter it. */
export function generateTerrain(input: Input): TerrainPlan {
  const { battleId, mission, length, width, deployment, objects } = input
  const short = mission === 'C3'
  const seed = hash(`black-sepulchre-terrain-v1:${battleId}:${mission}:${length}:${width}`)
  const roll = random(seed)
  const code = seed.toString(36).toUpperCase().padStart(7, '0')
  const specs: { kind: TerrainPiece['kind']; w: number; h: number; home?: boolean }[] = [
    { kind: 'dense', w: 6, h: 4, home: true },
    { kind: 'dense', w: length >= 60 ? 8 : 6, h: length >= 60 ? 6 : 4 },
    { kind: 'dense', w: 6, h: 4 },
    { kind: 'light', w: 6, h: 2 },
    ...(width >= 44 ? [{ kind: 'light' as const, w: 6, h: 4 }] : []),
    ...(length >= 60
      ? [
          { kind: 'dense' as const, w: 8, h: 6 },
          { kind: 'light' as const, w: 6, h: 2 },
        ]
      : []),
  ]
  const pieces: TerrainPiece[] = []
  for (const spec of specs) {
    // The first pair sits in the two deployment zones, including short-edge C3.
    const w = short && spec.home ? spec.h : spec.w,
      h = short && spec.home ? spec.w : spec.h
    const candidates: Rect[] = []
    for (let y = 1; y + h <= width - 1; y += 1)
      for (let x = 1; x + w <= length - 1; x += 1) {
        if (short ? x + w / 2 >= length / 2 : y + h / 2 >= width / 2) continue
        if (spec.home && (short ? x + w > deployment : y + h > deployment)) continue
        candidates.push({ x, y, width: w, height: h })
      }
    shuffle(candidates, roll)
    // Prefer forward cover outside the deployment zone after securing a home pair;
    // otherwise a random layout can leave the entire centre without dense terrain.
    if (!spec.home)
      candidates.sort(
        (a, b) =>
          Number(short ? b.x >= deployment : b.y >= deployment) -
          Number(short ? a.x >= deployment : a.y >= deployment),
      )
    for (const first of candidates) {
      const second: Rect = {
        ...first,
        x: length - first.x - first.width,
        y: width - first.y - first.height,
      }
      const pair = [first, second]
      if (rectDistance(first, second) < 2) continue
      if (pair.some((r) => pieces.some((p) => rectDistance(r, p) < 2))) continue
      // Keep a clear 3-inch disc at ground level around every mission point.
      if (pair.some((r) => objects.some((o) => pointDistance(r, o.x, o.y) < 3))) continue
      // PACT requires a firing line to each Seal from both sides. No terrain area
      // crosses the vertical ray to a Seal; features must remain inside their areas.
      if (
        mission === 'PACT' &&
        pair.some((r) => objects.some((o) => o.x >= r.x - 0.5 && o.x <= r.x + r.width + 0.5))
      )
        continue
      const number = pieces.length / 2 + 1
      pieces.push(
        { ...first, id: `${number}A`, kind: spec.kind, mirrored: false },
        { ...second, id: `${number}B`, kind: spec.kind, mirrored: true },
      )
      if (!infantryCanReachObjects(length, width, short, pieces, objects)) {
        pieces.pop()
        pieces.pop()
        continue
      }
      break
    }
  }
  return { version: 1, code, pieces }
}
