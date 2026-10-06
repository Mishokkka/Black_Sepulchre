import type { CatalogUnit, Enhancement, Pick, Player, Side, Snapshot, State } from './model.ts'
import { sameDatasheet } from './datasheets.ts'
import { assert } from './rules.ts'

export function enhancementEligible(e: Enhancement, c: CatalogUnit): boolean {
  const keywords = new Set([...c.keywords, c.side === 'necrons' ? 'NECRONS' : 'ADEPTUS ASTARTES'])
  return (
    !c.epic &&
    (c.character || !!e.upgrade || !!e.unitEligible) &&
    e.eligible.every((k) => keywords.has(k)) &&
    (!e.eligibleAny || e.eligibleAny.some((clause) => clause.every((k) => keywords.has(k)))) &&
    !(e.excluded ?? []).some((k) => keywords.has(k)) &&
    (!e.datasheets || e.datasheets.some((name) => sameDatasheet(name, c.datasheet)))
  )
}

export function enhancementBearers(p: Player, id: string): string[] {
  return [
    ...new Set([
      ...(p.enhancements[id] ? [p.enhancements[id]] : []),
      ...(p.enhancementExtras?.[id] ?? []),
    ]),
  ]
}

export function bindEnhancement(p: Player, id: string, bearers: string[]) {
  if (bearers.length) p.enhancements[id] = bearers[0]
  else delete p.enhancements[id]
  p.enhancementExtras ??= {}
  if (bearers.length > 1) p.enhancementExtras[id] = bearers.slice(1)
  else delete p.enhancementExtras[id]
}

export function enhancementBindingAllowed(
  p: Player,
  e: Enhancement,
  unitId: string,
  stage: number,
) {
  const bearers = p.enhancementStage === stage ? enhancementBearers(p, e.id) : []
  return bearers.includes(unitId) || bearers.length < (e.upgrade ? 3 : 1)
}

export function validateEnhancements(
  p: Player,
  snapshot: Snapshot,
  picks: Pick[],
  detachments: string[],
  stage: number,
  limit: number,
) {
  const selected = new Map<string, string[]>()
  for (const pick of picks) {
    if (!pick.enhancement) continue
    const e = snapshot.enhancements.find((e) => e.id === pick.enhancement)
    assert(e && detachments.includes(e.detachment), 'Enhancement вне выбранного detachment')
    const ids = [...(selected.get(e.id) ?? []), pick.id]
    assert(
      ids.length <= (e.upgrade ? 3 : 1),
      e.upgrade ? 'Upgrade доступен максимум трём отрядам' : 'Дубликат Enhancement',
    )
    const bound = p.enhancementStage === stage ? enhancementBearers(p, e.id) : []
    assert(
      new Set([...bound, ...ids]).size <= (e.upgrade ? 3 : 1),
      'Enhancement закреплён за другим ID; сначала передайте его в Logistics',
    )
    selected.set(e.id, ids)
  }
  assert(selected.size <= limit, 'Превышен лимит Enhancements')
  return selected
}

export function enhancementChoices(
  s: State,
  side: Side,
  unitId: string,
  snapshot: Snapshot,
  detachments: string[],
  stage: number,
): Enhancement[] {
  const u = s.units.find((u) => u.id === unitId && u.side === side)
  const c = snapshot.catalog.find((c) => c.id === u?.catalogId)
  return c
    ? snapshot.enhancements.filter(
        (e) =>
          detachments.includes(e.detachment) &&
          enhancementEligible(e, c) &&
          enhancementBindingAllowed(s.players[side], e, unitId, stage),
      )
    : []
}

export function preferredEnhancement(
  s: State,
  side: Side,
  unitId: string,
  snapshot: Snapshot,
  detachments: string[],
  stage: number,
): string | null {
  const p = s.players[side]
  const choices = enhancementChoices(s, side, unitId, snapshot, detachments, stage)
  // Once a stage has bound enhancements, its assignments take precedence over the starter.
  const selected =
    p.enhancementStage === stage
      ? choices.find((e) => enhancementBearers(p, e.id).includes(unitId))?.id
      : undefined
  const starter = s.battles === 0 ? p.startingEnhancements?.[unitId] : undefined
  return selected ?? (choices.some((e) => e.id === starter) ? starter! : null)
}

export function pruneStartingEnhancements(s: State, side: Side) {
  const p = s.players[side]
  p.startingEnhancements = Object.fromEntries(
    Object.entries(p.startingEnhancements ?? {}).filter(([id, enhancement]) => {
      const u = s.units.find(
        (u) => u.id === id && u.side === side && u.status === 'active' && u.location === 'field',
      )
      const c = s.snapshot.catalog.find((c) => c.id === u?.catalogId)
      const e = s.snapshot.enhancements.find((e) => e.id === enhancement)
      return c && e && p.package.includes(e.detachment) && enhancementEligible(e, c)
    }),
  )
}

/** Cost is returned to the army's Effective budget, never credited as Supply. */
export function packageEnhancementImpact(s: State, side: Side, next: string[]) {
  const p = s.players[side]
  const ids = new Set([
    ...Object.keys(p.enhancements),
    ...Object.keys(p.enhancementExtras ?? {}),
    ...Object.values(p.startingEnhancements ?? {}),
  ])
  const removed = [...ids].flatMap((id) => {
    const e = s.snapshot.enhancements.find((e) => e.id === id)
    if (e && next.includes(e.detachment)) return []
    const bearers = [
      ...new Set([
        ...enhancementBearers(p, id),
        ...Object.entries(p.startingEnhancements ?? {})
          .filter(([, value]) => value === id)
          .map(([unit]) => unit),
      ]),
    ]
    return [{ id, name: e?.name ?? id, cost: e?.cost ?? 0, bearers }]
  })
  return { removed, points: removed.reduce((n, e) => n + e.cost * e.bearers.length, 0) }
}

export function removePackageEnhancements(s: State, side: Side, next: string[]) {
  const p = s.players[side]
  for (const e of packageEnhancementImpact(s, side, next).removed) {
    bindEnhancement(p, e.id, [])
    p.startingEnhancements = Object.fromEntries(
      Object.entries(p.startingEnhancements ?? {}).filter(([, id]) => id !== e.id),
    )
  }
}
