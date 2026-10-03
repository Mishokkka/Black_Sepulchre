import { HONOURS } from './rules.generated.ts'
import type { CatalogUnit, Pick, SectorKey, Side, Snapshot, State, Unit } from './model.ts'
export const ADJACENCY: Record<SectorKey, SectorKey[]> = {
  A: ['B', 'C'],
  B: ['A', 'D'],
  C: ['A', 'E'],
  D: ['B', 'F', 'G'],
  E: ['C', 'H', 'G'],
  F: ['D', 'I', 'G'],
  G: ['D', 'E', 'F', 'H'],
  H: ['E', 'J', 'G'],
  I: ['F', 'K'],
  J: ['H', 'K'],
  K: ['I', 'J'],
}
export const SECTORS: Record<SectorKey, { name: string; node: boolean; home: boolean }> = {
  A: { name: 'Watch Fortress Tenebris', node: false, home: true },
  B: { name: 'Basilica Ossuary', node: false, home: false },
  C: { name: 'Orbital Ossuary Lift', node: true, home: false },
  D: { name: 'Fleshworks IX', node: false, home: false },
  E: { name: 'Ash Meridian', node: true, home: false },
  F: { name: 'Noctis Relay', node: true, home: false },
  G: { name: 'Cathedral of Black Glass', node: true, home: false },
  H: { name: 'Glass Wastes', node: false, home: false },
  I: { name: 'Necropolis Khepra', node: false, home: false },
  J: { name: 'Canoptek Foundry', node: true, home: false },
  K: { name: 'Sepulchre of the Nameless King', node: false, home: true },
}
export const STAGES = [500, 750, 1000, 1250, 1500, 1750, 2000].map((al, i) => ({
  al,
  cap: al * 1.5,
  dp: i < 2 ? 1 : i < 5 ? 2 : 3,
  enhancements: i < 2 ? 1 : i < 4 ? 2 : i === 4 ? 3 : 4,
  copies: i < 2 ? 1 : i < 5 ? 2 : 3,
  battleline: i < 2 ? 2 : i < 5 ? 4 : 6,
  l: i < 2 ? 44 : 60,
  w: i === 0 ? 30 : 44,
  d: i === 0 ? 7 : i === 1 ? 10 : 12,
}))
export const stageFor = (b: number) => Math.min(6, Math.floor(b / 2))
export const up5 = (n: number) => Math.ceil(n / 5) * 5
export const down5 = (n: number) => Math.floor(n / 5) * 5
export const healCost = (rc: number) => Math.max(10, up5(rc * 0.15))
export const home = (s: Side): SectorKey => (s === 'deathwatch' ? 'A' : 'K')
export function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message)
}
export function integer(value: unknown, min = 0, max = 1000000): number {
  assert(
    typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max,
    'Недопустимое число',
  )
  return value
}
export function str(value: unknown, max = 120): string {
  assert(typeof value === 'string' && value.length > 0 && value.length <= max, 'Недопустимый текст')
  return value
}
export function key(value: unknown): SectorKey {
  assert(typeof value === 'string' && value in ADJACENCY, 'Неизвестный сектор')
  return value as SectorKey
}
export function distance(from: SectorKey, to: SectorKey): number {
  const q: [SectorKey, number][] = [[from, 0]],
    seen = new Set([from])
  while (q.length) {
    const [a, d] = q.shift()!
    if (a === to) return d
    for (const b of ADJACENCY[a])
      if (!seen.has(b)) {
        seen.add(b)
        q.push([b, d + 1])
      }
  }
  return Infinity
}
export function supplied(s: State, side: Side, sector: SectorKey): boolean {
  const q = [home(side)],
    seen = new Set<SectorKey>()
  while (q.length) {
    const a = q.pop()!
    if (seen.has(a) || s.sectors[a].owner !== side) continue
    if (a === sector) return true
    seen.add(a)
    q.push(...ADJACENCY[a])
  }
  return false
}
export function bonus(s: State, sector: SectorKey, side: Side): boolean {
  const a = s.sectors[sector]
  return (
    a.owner === side &&
    !a.exhausted &&
    !a.sabotaged &&
    !a.disrupted &&
    !a.contested &&
    !(sector === 'F' && a.relayUntil !== null) &&
    !(['C', 'F'].includes(sector) && s.effects.some((e) => e.code === '36'))
  )
}
export function entry(s: State, u: Unit, snapshot: Snapshot = s.snapshot): CatalogUnit {
  const c = snapshot.catalog.find((c) => c.id === u.catalogId) ?? u.retiredCatalog
  assert(c, 'Datasheet отсутствует в Snapshot')
  return c
}
export function unit(s: State, id: unknown, side?: Side): Unit {
  const u = s.units.find((u) => u.id === id)
  assert(
    u && u.status !== 'archived' && u.status !== 'lost' && u.status !== 'sealed',
    'Запись юнита недоступна',
  )
  assert(!side || u.side === side, 'Это чужой юнит')
  return u
}
export function available(s: State, u: Unit): boolean {
  return (
    u.status === 'active' &&
    u.damage < 3 &&
    !u.evacDebt &&
    !u.flags.outOfAction &&
    !u.flags.criticalPending &&
    s.snapshot.catalog.some((c) => c.id === u.catalogId)
  )
}
export const present = (s: State, u: Unit): SectorKey =>
  u.location === 'garrison'
    ? u.sector!
    : u.location === 'stf'
      ? s.players[u.side].stf!
      : s.players[u.side].mf
export function credit(s: State, side: Side, n: number) {
  integer(n)
  const p = s.players[side],
    paid = Math.min(p.debt, n)
  p.debt -= paid
  p.supply += n - paid
}
export function spend(s: State, side: Side, n: number, resource: 'supply' | 'intel' = 'supply') {
  integer(n)
  const p = s.players[side]
  assert(p[resource] >= n, resource === 'intel' ? 'Недостаточно Intel' : 'Недостаточно Supply')
  p[resource] -= n
}
export function intel(s: State, side: Side, n: number, soft = false) {
  s.players[side].intel = soft
    ? Math.max(s.players[side].intel, Math.min(6, s.players[side].intel + n))
    : s.players[side].intel + n
}
export function choir(s: State, n: number, min = 0) {
  s.choir = Math.min(8, Math.max(min, s.choir + n))
}
export function garrisonLegal(s: State, u: Unit, sector: SectorKey, purchase = false): boolean {
  const c = entry(s, u),
    meta = SECTORS[sector],
    advanced = meta.node || meta.home || s.sectors[sector].fortified,
    al = STAGES[s.stage].al
  if (
    c.epic ||
    c.keywords.some((k) => ['TITANIC', 'AIRCRAFT'].includes(k)) ||
    c.garrison === 'forbidden'
  )
    return false
  if (
    (c.side === 'necrons' && /c.tan/i.test(c.datasheet)) ||
    (c.side === 'deathwatch' &&
      (/corvus/i.test(c.datasheet) ||
        c.keywords.includes('MOUNTED') ||
        c.keywords.includes('JUMP PACK')))
  )
    return false
  if ((c.character || c.garrison !== 'core') && !advanced) return false
  if (
    c.character &&
    s.units.some(
      (v) =>
        v.id !== u.id &&
        v.side === u.side &&
        v.status === 'active' &&
        v.location === 'garrison' &&
        v.sector === sector &&
        entry(s, v).character,
    )
  )
    return false
  return !purchase || u.rc <= al * (c.garrison === 'other' ? 0.35 : 0.4)
}
export function effectPrice(tier: string, formation: boolean, rc: number, total: number): number {
  if (formation)
    return Math.max(
      tier === 'Minor' ? 5 : tier === 'Major' ? 10 : 15,
      up5(total * (tier === 'Minor' ? 0.05 : tier === 'Major' ? 0.1 : 0.15)),
    )
  return tier === 'Minor'
    ? 5
    : Math.max(tier === 'Major' ? 10 : 15, up5(rc * (tier === 'Major' ? 0.05 : 0.1)))
}
export const ARMOURY: Record<
  string,
  { name: string; cost: number; tier: string; formation: boolean; consumable: boolean }
> = {
  medicae: {
    name: 'Medicae / Repair Node',
    cost: 15,
    tier: '',
    formation: false,
    consumable: true,
  },
  plating: {
    name: 'Reinforced Plating',
    cost: 30,
    tier: 'Minor',
    formation: false,
    consumable: false,
  },
  relay: { name: 'Tactical Relay', cost: 25, tier: 'Minor', formation: false, consumable: false },
  beacon: { name: 'Reserve Beacon', cost: 30, tier: 'Minor', formation: true, consumable: false },
  cache: { name: 'Recovery Cache', cost: 20, tier: '', formation: false, consumable: true },
  ward: { name: 'Blackglass Ward', cost: 25, tier: 'Minor', formation: true, consumable: false },
  auspex: { name: 'Combat Auspex', cost: 25, tier: 'Minor', formation: false, consumable: false },
}
export const RANDOM_ARMOURY = ['medicae', 'plating', 'relay', 'beacon', 'cache', 'auspex']
export const RELICS: Record<string, { name: string; tier: string; formation: boolean }> = {
  shard: { name: 'Blackglass Shard', tier: 'Minor', formation: true },
  sliver: { name: 'Chronal Sliver', tier: 'Minor', formation: true },
  key: { name: 'Ossuary Key', tier: 'Minor', formation: false },
  lens: { name: 'Blackglass Lens', tier: 'Minor', formation: false },
  crown: { name: 'Mnemonic Crown', tier: 'Minor', formation: false },
  anchor: { name: 'Anchor Fragment', tier: 'Major', formation: true },
}
export function surcharge(s: State, u: Unit, p: Pick, picks: Pick[]): number {
  const total = picks
    .filter((v) => v.formation === p.formation)
    .reduce((n, v) => n + unit(s, v.id).rc, 0)
  let cr = 0
  for (const id of p.honours) {
    const h = HONOURS.find((h) => h.id === id)
    assert(h && u.honours.includes(id), 'Неизвестное Honour')
    cr += effectPrice(h.tier, h.formation, u.rc, total)
  }
  const armouryBlocked =
    u.scars.some((v) => u.side === 'deathwatch' && v.id === 4) ||
    s.battle?.effects.some((e) => e.code === '41' && e.side === u.side && e.data.unit === u.id)
  if (p.armoury && u.armoury && !armouryBlocked) {
    const a = ARMOURY[u.armoury]
    if (a.tier) cr += effectPrice(a.tier, a.formation, u.rc, total)
  }
  if (p.relic && u.relic) {
    const a = RELICS[u.relic]
    cr += effectPrice(a.tier, a.formation, u.rc, total)
  }
  return cr
}
export const TACTICAL = ['barricades', 'smoke', 'coordinates', 'reserves', 'booby', 'evacuation']
export const DEFENSIVE = ['barricades', 'mines', 'beacon', 'stores']
export const BREACH = ['suppression', 'charge', 'infiltration', 'extraction']
export function tier(s: State, sector: SectorKey) {
  const a = s.sectors[sector],
    m = SECTORS[sector],
    al = STAGES[s.stage].al
  const bad = !supplied(s, a.owner ?? 'deathwatch', sector) || a.exhausted > 0 || a.sabotaged
  const pool = m.home
    ? (s.players[a.owner ?? 'deathwatch'].poolOverride ?? 75)
    : a.fortified
      ? 50
      : m.node
        ? 35
        : 25
  return {
    initial: down5(al * (m.home || a.fortified ? 1 : m.node ? 0.75 : 0.5)),
    pool: down5((al * Math.max(0, pool - (bad ? 10 : 0))) / 100),
    firstSlot: (m.home || a.fortified ? 2 : 3) + (bad ? 1 : 0),
    breaches: m.home ? 3 : a.fortified ? 2 : m.node ? 1 : 0,
    defAsset: (m.home || a.fortified) && !a.sabotaged && !(sector === 'E' && a.exhausted > 0),
  }
}
