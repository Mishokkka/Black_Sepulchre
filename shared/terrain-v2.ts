import {
  infantryCanReachObjects,
  isTerrainObjective,
  terrainArea,
  terrainWalls,
  type TerrainInput,
  type TerrainPiece,
  type TerrainPlan,
  type TerrainWall,
} from './terrain.ts'

type Spec = {
  w: number
  h: number
  kind: 'dense' | 'light'
  home?: boolean
  floor?: boolean
  cut?: number
}

/** Campaign kits are scaled by table, rather than shrinking a 60×44 tournament map. */
export function terrainKit(length: number, width: number) {
  if (length >= 60)
    return {
      name: 'full' as const,
      home: [11.5, 7],
      large: [11.5, 7],
      polygon: [11.5, 8],
      strip: [10, 2.5],
      cut: 2,
      shortPairs: 2,
      target: 0.27,
      limit: 0.32,
    }
  if (width >= 44)
    return {
      name: 'square' as const,
      home: [10, 6],
      large: [10, 7],
      polygon: [9, 7],
      strip: [9, 2.5],
      cut: 2,
      shortPairs: 2,
      target: 0.28,
      limit: 0.32,
    }
  return {
    name: 'compact' as const,
    home: [8, 5],
    large: [8, 5],
    polygon: [6, 5],
    strip: [8, 2],
    cut: 1.5,
    shortPairs: 1,
    target: 0.27,
    limit: 0.32,
  }
}

const rectDistance = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  Math.hypot(
    Math.max(a.x - b.x - b.width, b.x - a.x - a.width, 0),
    Math.max(a.y - b.y - b.height, b.y - a.y - a.height, 0),
  )
const segmentDistance = (wall: TerrainWall, x: number, y: number) => {
  const dx = wall.x2 - wall.x1,
    dy = wall.y2 - wall.y1
  const t = Math.max(
    0,
    Math.min(1, ((x - wall.x1) * dx + (y - wall.y1) * dy) / (dx * dx + dy * dy || 1)),
  )
  return Math.hypot(x - wall.x1 - t * dx, y - wall.y1 - t * dy)
}
const hash = (value: string) => {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619)
  return h >>> 0
}
const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), seed | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const shuffle = <T>(list: T[], roll: () => number) => {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(roll() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

/** Conservative route for a circular base. A low ceiling is blocked for tall vehicles. */
export function vehicleCanCrossV2(
  length: number,
  width: number,
  short: boolean,
  pieces: TerrainPiece[],
  diameter = 4,
) {
  const radius = diameter / 2,
    clearance = radius + 0.225 + 0.5
  const walls = pieces.filter((p) => p.kind === 'dense').flatMap(terrainWalls)
  const ceilings = pieces.flatMap((p) => p.platforms ?? [])
  const low = Math.ceil(radius - 0.5),
    maxX = Math.floor(length - radius - 0.5),
    maxY = Math.floor(width - radius - 0.5)
  const blocked = new Uint8Array(length * width),
    seen = new Uint8Array(length * width),
    queue: number[] = []
  for (let y = low; y <= maxY; y++)
    for (let x = low; x <= maxX; x++) {
      const px = x + 0.5,
        py = y + 0.5
      if (
        walls.some((w) => segmentDistance(w, px, py) < clearance) ||
        ceilings.some(
          (p) =>
            Math.hypot(
              Math.max(p.x - px, px - p.x - p.width, 0),
              Math.max(p.y - py, py - p.y - p.height, 0),
            ) <
            radius + 0.5,
        )
      )
        blocked[y * length + x] = 1
    }
  const add = (x: number, y: number) => {
    if (x < low || x > maxX || y < low || y > maxY) return
    const i = y * length + x
    if (!seen[i] && !blocked[i]) {
      seen[i] = 1
      queue.push(i)
    }
  }
  if (short) for (let y = low; y <= maxY; y++) add(low, y)
  else for (let x = low; x <= maxX; x++) add(x, low)
  for (let n = 0; n < queue.length; n++) {
    const x = queue[n] % length,
      y = Math.floor(queue[n] / length)
    if (short ? x === maxX : y === maxY) return true
    add(x - 1, y)
    add(x + 1, y)
    add(x, y - 1)
    add(x, y + 1)
  }
  return false
}

/** Largest completely empty strip along the deployment-to-deployment axis.
 * This is a footprint check, not a simulation of model visibility or Hidden. */
export function largestOpenLane(
  length: number,
  width: number,
  short: boolean,
  pieces: TerrainPiece[],
) {
  const intervals = pieces
    .map((p) => (short ? [p.y, p.y + p.height] : [p.x, p.x + p.width]))
    .sort((a, b) => a[0] - b[0])
  let edge = 0,
    gap = 0
  for (const [start, end] of intervals) {
    gap = Math.max(gap, start - edge)
    edge = Math.max(edge, end)
  }
  return Math.max(gap, (short ? width : length) - edge)
}

function pieceAt(x: number, y: number, spec: Spec, id: string): TerrainPiece {
  const p: TerrainPiece = {
    id,
    kind: spec.kind,
    x,
    y,
    width: spec.w,
    height: spec.h,
    mirrored: false,
    profile: {
      wallHeight: spec.kind === 'dense' ? 4 : 1,
      maxWallThickness: 0.45,
      elevatedFloors: spec.floor ? 1 : 0,
    },
  }
  if (spec.cut)
    p.outline = [
      { x, y },
      { x: x + p.width - spec.cut, y },
      { x: x + p.width, y: y + spec.cut },
      { x: x + p.width, y: y + p.height },
      { x, y: y + p.height },
    ]
  p.walls =
    spec.kind === 'light'
      ? [
          p.width >= p.height
            ? { x1: x + 0.7, y1: y + 0.7, x2: x + p.width - 0.7, y2: y + 0.7 }
            : { x1: x + 0.7, y1: y + 0.7, x2: x + 0.7, y2: y + p.height - 0.7 },
        ]
      : [
          { x1: x + 0.7, y1: y + 0.7, x2: x + p.width - (spec.cut ?? 0) - 0.7, y2: y + 0.7 },
          { x1: x + 0.7, y1: y + 0.7, x2: x + 0.7, y2: y + p.height - 0.7 },
        ]
  if (spec.floor)
    p.platforms = [
      {
        x: x + 0.925,
        y: y + 0.925,
        width: Math.min(4, p.width - 2),
        height: Math.min(4, p.height - 2),
        elevation: 3,
        thickness: 0.15,
      },
    ]
  return p
}

function rotate(p: TerrainPiece, length: number, width: number, id: string): TerrainPiece {
  const rotated: TerrainPiece = {
    ...p,
    id,
    mirrored: true,
    x: length - p.x - p.width,
    y: width - p.y - p.height,
    walls: p.walls?.map((w) => ({
      x1: length - w.x1,
      y1: width - w.y1,
      x2: length - w.x2,
      y2: width - w.y2,
    })),
  }
  if (p.outline) rotated.outline = p.outline.map((v) => ({ x: length - v.x, y: width - v.y }))
  if (p.platforms)
    rotated.platforms = p.platforms.map((f) => ({
      ...f,
      x: length - f.x - f.width,
      y: width - f.y - f.height,
    }))
  return rotated
}

function anchors(input: TerrainInput): TerrainPiece[] {
  const selected = input.objects.filter((o) => isTerrainObjective(input.mission, o, input.legacyI2))
  return selected.map((o, i) => {
    const symmetric =
      Math.abs(o.x * 2 - input.length) < 0.001 && Math.abs(o.y * 2 - input.width) < 0.001
    const mirrored = o.y > input.width / 2 || (o.y === input.width / 2 && o.x > input.length / 2)
    const p: TerrainPiece = {
      id: `O${i + 1}`,
      kind: 'dense',
      x: o.x - 3,
      y: o.y - 2,
      width: 6,
      height: 4,
      mirrored,
      objectiveId: o.id,
      symmetric,
      profile: { wallHeight: 4, maxWallThickness: 0.45, elevatedFloors: 0 },
    }
    p.walls = terrainWalls(p)
    return p
  })
}

function keepsMissionRoutes(p: TerrainPiece, input: TerrainInput) {
  const { mission, length, width, objects } = input
  // Mission objects start on the ground; do not put a low ceiling over their bases.
  if (
    p.platforms?.some((f) =>
      objects.some(
        (o) =>
          Math.hypot(
            Math.max(f.x - o.x, o.x - f.x - f.width, 0),
            Math.max(f.y - o.y, o.y - f.y - f.height, 0),
          ) < 1.05,
      ),
    )
  )
    return false
  if (mission === 'PACT' && objects.some((o) => o.x >= p.x - 0.5 && o.x <= p.x + p.width + 0.5))
    return false
  if (p.kind === 'dense' && ['B3', 'E1', 'C2'].includes(mission)) {
    const horizontal = mission !== 'C2',
      centre = horizontal ? width / 2 : length / 2
    for (const wall of terrainWalls(p)) {
      const a = (horizontal ? wall.y1 : wall.x1) - centre,
        b = (horizontal ? wall.y2 : wall.x2) - centre
      if (a * b <= 0 || Math.min(Math.abs(a), Math.abs(b)) < 2.25) return false
    }
    if (
      p.platforms?.some((f) =>
        horizontal
          ? f.y < centre + 2.25 && f.y + f.height > centre - 2.25
          : f.x < centre + 2.25 && f.x + f.width > centre - 2.25,
      )
    )
      return false
  }
  return terrainWalls(p).every((w) => objects.every((o) => segmentDistance(w, o.x, o.y) >= 1.05))
}

function pack(input: TerrainInput, seed: number) {
  const { length, width, deployment } = input,
    short = input.mission === 'C3',
    kit = terrainKit(length, width)
  const pieces = anchors(input),
    roll = random(seed)
  let index = 1
  const home = (p: TerrainPiece) =>
    p.kind === 'dense' && (short ? p.x + p.width <= deployment : p.y + p.height <= deployment)
  const place = (spec: Spec) => {
    if (spec.home && !spec.floor && pieces.filter(home).length >= 2) return true
    const candidates: TerrainPiece[] = []
    const orientations = spec.home
      ? [short ? { ...spec, w: spec.h, h: spec.w } : spec]
      : [spec, { ...spec, w: spec.h, h: spec.w }]
    for (const shape of orientations)
      for (let y = 1; y + shape.h <= width - 1; y++)
        for (let x = 1; x + shape.w <= length - 1; x++) {
          if (short ? x + shape.w / 2 >= length / 2 : y + shape.h / 2 >= width / 2) continue
          if (shape.home && (short ? x + shape.w > deployment : y + shape.h > deployment)) continue
          candidates.push(pieceAt(x, y, shape, `${index}A`))
        }
    shuffle(candidates, roll)
    if (!spec.home)
      candidates.sort(
        (a, b) =>
          Number(
            short
              ? b.x >= deployment && b.x + b.width <= length - deployment
              : b.y >= deployment && b.y + b.height <= width - deployment,
          ) -
          Number(
            short
              ? a.x >= deployment && a.x + a.width <= length - deployment
              : a.y >= deployment && a.y + a.height <= width - deployment,
          ),
      )
    for (const first of candidates) {
      const second = rotate(first, length, width, `${index}B`)
      if (rectDistance(first, second) < 1) continue
      const pair = [first, second]
      if (
        pair.some(
          (p) => pieces.some((q) => rectDistance(p, q) < 1) || !keepsMissionRoutes(p, input),
        )
      )
        continue
      if (
        spec.home &&
        pieces
          .filter(home)
          .some(
            (p) =>
              Math.abs(
                (short ? p.y + p.height / 2 : p.x + p.width / 2) -
                  (short ? first.y + first.height / 2 : first.x + first.width / 2),
              ) <
              (short ? width : length) * 0.2,
          )
      )
        continue
      pieces.push(...pair)
      index++
      return true
    }
    return false
  }
  const homeFloor = place({
    w: kit.home[0],
    h: kit.home[1],
    kind: 'dense',
    home: true,
    floor: true,
  })
  const homeSmall = place({ w: 6, h: 4, kind: 'dense', home: true })
  const large = place({ w: kit.large[0], h: kit.large[1], kind: 'dense' })
  const long = place({ w: kit.strip[0], h: kit.strip[1], kind: 'light' })
  const sum = () => pieces.reduce((n, p) => n + terrainArea(p), 0)
  const polygon: Spec = { w: kit.polygon[0], h: kit.polygon[1], kind: 'dense', cut: kit.cut }
  if (sum() + 2 * (polygon.w * polygon.h - (kit.cut * kit.cut) / 2) <= length * width * kit.limit)
    place(polygon)
  for (let i = 0; i < kit.shortPairs; i++) place({ w: 6, h: 2, kind: 'light' })
  if (sum() < length * width * kit.target) place({ w: 6, h: 4, kind: 'dense' })
  return { pieces, core: homeFloor && homeSmall && large && long }
}

/** New battles use v2. Legacy reconstruction continues to call the frozen v1 generator. */
export function generateTerrainV2(input: TerrainInput): TerrainPlan {
  const seed = hash(
    `black-sepulchre-terrain-v2:${input.battleId}:${input.mission}:${input.length}:${input.width}`,
  )
  const kit = terrainKit(input.length, input.width),
    short = input.mission === 'C3'
  for (let attempt = 0; attempt < 32; attempt++) {
    const result = pack(input, hash(`${seed}:${attempt}`)),
      pieces = result.pieces
    if (
      !result.core ||
      !infantryCanReachObjects(input.length, input.width, short, pieces, input.objects) ||
      !vehicleCanCrossV2(input.length, input.width, short, pieces)
    )
      continue
    const area = pieces.reduce((n, p) => n + terrainArea(p), 0) / (input.length * input.width)
    const gap = largestOpenLane(input.length, input.width, short, pieces)
    if (area >= 0.245 && gap <= 6)
      return {
        version: 2,
        code: seed.toString(36).toUpperCase().padStart(7, '0'),
        tableProfile: kit.name,
        pieces,
      }
  }
  throw new Error('Не удалось разместить террейн с доступом к целям и проходом техники')
}
