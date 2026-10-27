/** Terrain areas and mission objectives for the campaign, measured in inches. */
export interface TerrainObject {
  id?: string
  kind?: 'objective' | 'interaction' | 'item'
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
  /** An area objective uses the whole footprint, not a 40 mm marker. */
  objectiveId?: string
  /** Two opposite corners keep an area on the centre line symmetric. */
  symmetric?: boolean
  /** Saved wall segments keep physical geometry stable after future client updates. */
  walls?: TerrainWall[]
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
  /** Battles created before I2's geometry fix used objective markers. */
  legacyI2?: boolean
}

export interface TerrainWall {
  x1: number
  y1: number
  x2: number
  y2: number
}
type Rect = Pick<TerrainPiece, 'x' | 'y' | 'width' | 'height'>

/** Explicit campaign choices: all other objectives remain 40 mm markers. */
const AREA_OBJECTIVES: Record<string, readonly string[]> = {
  A2: ['2'],
  B2: ['1'],
  H1: ['1', '2', '3', '4', '5'],
  I1: ['5'],
  I2: ['1', '2', '3'],
}

export function isTerrainObjective(mission: string, object: TerrainObject, legacyI2 = false) {
  const code = mission.replace(/^K/, 'A')
  return (
    !(code === 'I2' && legacyI2) &&
    object.kind === 'objective' &&
    !!object.id &&
    !!AREA_OBJECTIVES[code]?.includes(object.id)
  )
}

/** I2 battles created before its coordinate correction keep their saved points. */
export function hasLegacyI2Coordinates(length: number, width: number, objects: TerrainObject[]) {
  return [0.25, 0.5, 0.75].every((fraction, i) => {
    const object = objects.find((o) => o.id === String(i + 1))
    return (
      object?.kind === 'objective' &&
      Math.abs(object.x - length * fraction) < 0.001 &&
      Math.abs(object.y - width / 2) < 0.001
    )
  })
}

const rectDistance = (a: Rect, b: Rect) =>
  Math.hypot(
    Math.max(a.x - b.x - b.width, b.x - a.x - a.width, 0),
    Math.max(a.y - b.y - b.height, b.y - a.y - a.height, 0),
  )

export const containsPoint = (r: Rect, x: number, y: number) =>
  x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height

/** Suggested physical walls inside an area. These are not the area boundary. */
export function terrainWalls(p: TerrainPiece): TerrainWall[] {
  if (p.walls) return p.walls
  const x1 = p.x + 0.7,
    x2 = p.x + p.width - 0.7,
    y1 = p.y + 0.7,
    y2 = p.y + p.height - 0.7
  if (p.kind === 'light') return p.mirrored ? [{ x1, y1: y2, x2, y2 }] : [{ x1, y1, x2, y2: y1 }]
  if (p.symmetric) {
    const xm = p.x + p.width / 2,
      ym = p.y + p.height / 2
    return [
      { x1, y1, x2: xm - 0.5, y2: y1 },
      { x1, y1, x2: x1, y2: ym - 0.3 },
      { x1: xm + 0.5, y1: y2, x2, y2 },
      { x1: x2, y1: ym + 0.3, x2, y2 },
    ]
  }
  return p.mirrored
    ? [
        { x1, y1: y2, x2, y2 },
        { x1: x2, y1: y2, x2, y2: y1 },
      ]
    : [
        { x1: x2, y1, x2: x1, y2: y1 },
        { x1, y1, x2: x1, y2 },
      ]
}

const distanceToSegment = (wall: TerrainWall, x: number, y: number) => {
  const dx = wall.x2 - wall.x1,
    dy = wall.y2 - wall.y1,
    square = dx * dx + dy * dy
  const t = square
    ? Math.max(0, Math.min(1, ((x - wall.x1) * dx + (y - wall.y1) * dy) / square))
    : 0
  return Math.hypot(x - wall.x1 - t * dx, y - wall.y1 - t * dy)
}

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

/** Conservative grid check: treat dense walls as impassable even for infantry.
 * An area objective is reached inside its footprint; other objects within 2.5″. */
export function infantryCanReachObjects(
  length: number,
  width: number,
  short: boolean,
  pieces: TerrainPiece[],
  objects: TerrainObject[],
) {
  const walls = pieces.filter((p) => p.kind === 'dense').flatMap(terrainWalls)
  function reachable(fromEnd: boolean) {
    const queue: number[] = []
    const seen = new Uint8Array(length * width)
    const add = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= length || y >= width) return
      const i = y * length + x
      if (seen[i] || walls.some((w) => distanceToSegment(w, x + 0.5, y + 0.5) < 0.85)) return
      seen[i] = 1
      queue.push(i)
    }
    if (short) for (let y = 0; y < width; y++) add(fromEnd ? length - 2 : 1, y)
    else for (let x = 0; x < length; x++) add(x, fromEnd ? width - 2 : 1)
    for (let i = 0; i < queue.length; i++) {
      const x = queue[i] % length,
        y = Math.floor(queue[i] / length)
      add(x - 1, y)
      add(x + 1, y)
      add(x, y - 1)
      add(x, y + 1)
    }
    return objects.every((o) => {
      const area = o.id ? pieces.find((p) => p.objectiveId === o.id) : undefined
      return queue.some((i) => {
        const x = (i % length) + 0.5,
          y = Math.floor(i / length) + 0.5
        return area ? containsPoint(area, x, y) : Math.hypot(x - o.x, y - o.y) < 2.5
      })
    })
  }
  return reachable(false) && reachable(true)
}

/** Checks for a continuous 3″-wide ground-level route between deployments.
 * Dense walls are solid obstacles; Light features can be crossed by all models. */
export function vehicleCanCross(
  length: number,
  width: number,
  short: boolean,
  pieces: TerrainPiece[],
) {
  const walls = pieces.filter((p) => p.kind === 'dense').flatMap(terrainWalls)
  const blocked = new Uint8Array(length * width)
  const seen = new Uint8Array(length * width)
  const queue: number[] = []
  for (let y = 1; y < width - 1; y++)
    for (let x = 1; x < length - 1; x++)
      // Half a grid step is added so the segments between adjacent samples,
      // not just their endpoints, retain clearance for the whole base.
      if (walls.some((w) => distanceToSegment(w, x + 0.5, y + 0.5) < 2.225))
        blocked[y * length + x] = 1
  const add = (x: number, y: number) => {
    if (x < 1 || y < 1 || x >= length - 1 || y >= width - 1) return
    const i = y * length + x
    if (!seen[i] && !blocked[i]) {
      seen[i] = 1
      queue.push(i)
    }
  }
  if (short) for (let y = 1; y < width - 1; y++) add(1, y)
  else for (let x = 1; x < length - 1; x++) add(x, 1)
  for (let i = 0; i < queue.length; i++) {
    const x = queue[i] % length,
      y = Math.floor(queue[i] / length)
    if (short ? x === length - 2 : y === width - 2) return true
    add(x - 1, y)
    add(x + 1, y)
    add(x, y - 1)
    add(x, y + 1)
  }
  return false
}

/** The version is stable for a battle and uses only public mission information. */
export function generateTerrain(input: Input): TerrainPlan {
  const { battleId, mission, length, width, deployment, objects } = input
  const short = mission === 'C3'
  const seed = hash(`black-sepulchre-terrain-v1:${battleId}:${mission}:${length}:${width}`)
  const roll = random(seed)
  const code = seed.toString(36).toUpperCase().padStart(7, '0')
  const pieces: TerrainPiece[] = []
  const areaObjects = objects.filter((o) => isTerrainObjective(mission, o, input.legacyI2))
  const done = new Set<string>()
  let index = 1

  // Objective footprints are anchored at the mission's points. Counterparts
  // use equal areas; a centre objective receives two opposite wall corners.
  for (const o of areaObjects) {
    if (!o.id || done.has(o.id)) continue
    const centred = Math.abs(o.x * 2 - length) < 0.001 && Math.abs(o.y * 2 - width) < 0.001
    const counterpart = areaObjects.find(
      (other) =>
        other.id !== o.id &&
        Math.abs(other.x + o.x - length) < 0.001 &&
        Math.abs(other.y + o.y - width) < 0.001,
    )
    if (!centred && !counterpart?.id) throw new Error(`Нет симметричной пары objective ${o.id}`)
    const w = 6,
      h = 4
    const first: TerrainPiece = {
      id: centred ? `${index}C` : `${index}A`,
      kind: 'dense',
      x: o.x - w / 2,
      y: o.y - h / 2,
      width: w,
      height: h,
      mirrored: false,
      objectiveId: o.id,
      symmetric: centred,
    }
    pieces.push(first)
    done.add(o.id)
    if (counterpart?.id) {
      pieces.push({
        ...first,
        id: `${index}B`,
        x: length - first.x - w,
        y: width - first.y - h,
        mirrored: true,
        objectiveId: counterpart.id,
        symmetric: false,
      })
      done.add(counterpart.id)
    }
    index++
  }

  const homeSpecs =
    length >= 60
      ? [
          { w: 8, h: 6 },
          { w: 6, h: 4 },
        ]
      : [
          { w: 6, h: 4 },
          { w: 6, h: 4 },
        ]
  const specs: { kind: TerrainPiece['kind']; w: number; h: number; home?: boolean }[] = [
    ...homeSpecs.map((r) => ({ ...r, kind: 'dense' as const, home: true })),
    { kind: 'dense', w: length >= 60 ? 10 : 8, h: width >= 44 ? 6 : 4 },
    { kind: 'dense', w: width >= 44 ? 8 : 6, h: width >= 44 ? 6 : 4 },
    ...(length >= 60 ? [{ kind: 'dense' as const, w: 6, h: 4 }] : []),
    { kind: 'light', w: 6, h: 4 },
    { kind: 'light', w: 6, h: 2 },
    ...(width >= 44 ? [{ kind: 'light' as const, w: 6, h: 2 }] : []),
  ]
  for (const spec of specs) {
    if (spec.home) {
      const homeCover = pieces.filter(
        (p) =>
          p.kind === 'dense' &&
          (short ? p.x + p.width <= deployment : p.y + p.height <= deployment),
      ).length
      if (homeCover >= 2) continue
    }
    const w = short && spec.home ? spec.h : spec.w,
      h = short && spec.home ? spec.w : spec.h
    const candidates: Rect[] = []
    for (let y = 1; y + h <= width - 1; y++)
      for (let x = 1; x + w <= length - 1; x++) {
        if (short ? x + w / 2 >= length / 2 : y + h / 2 >= width / 2) continue
        if (spec.home && (short ? x + w > deployment : y + h > deployment)) continue
        candidates.push({ x, y, width: w, height: h })
      }
    shuffle(candidates, roll)
    if (!spec.home)
      candidates.sort(
        (a, b) =>
          Number(short ? b.x >= deployment : b.y >= deployment) -
          Number(short ? a.x >= deployment : a.y >= deployment),
      )
    for (const first of candidates) {
      const second: Rect = { ...first, x: length - first.x - w, y: width - first.y - h }
      if (
        rectDistance(first, second) < 2 ||
        [first, second].some((r) => pieces.some((p) => rectDistance(r, p) < 2))
      )
        continue
      const pair: TerrainPiece[] = [
        { ...first, id: `${index}A`, kind: spec.kind, mirrored: false },
        { ...second, id: `${index}B`, kind: spec.kind, mirrored: true },
      ]
      // The footprint can contain a marker or an interaction point, but the
      // suggested walls must not physically occupy the marker's location.
      if (
        pair.some((p) =>
          terrainWalls(p).some((wall) =>
            objects.some((o) => distanceToSegment(wall, o.x, o.y) < 1.05),
          ),
        )
      )
        continue
      // PACT explicitly requires a shooting line to every Seal from each side.
      if (
        mission === 'PACT' &&
        pair.some((r) => objects.some((o) => o.x >= r.x - 0.5 && o.x <= r.x + r.width + 0.5))
      )
        continue
      pieces.push(...pair)
      if (
        !infantryCanReachObjects(length, width, short, pieces, objects) ||
        !vehicleCanCross(length, width, short, pieces)
      ) {
        pieces.pop()
        pieces.pop()
        continue
      }
      index++
      break
    }
  }
  return { version: 1, code, pieces: pieces.map((p) => ({ ...p, walls: terrainWalls(p) })) }
}
