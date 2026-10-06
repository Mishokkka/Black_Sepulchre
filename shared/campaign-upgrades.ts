import { HONOURS } from './rules.generated.ts'
import type { CatalogUnit, Unit, Side } from './model.ts'

export function scarHasOnceUse(side: Side, id: number) {
  return (side === 'deathwatch' ? [1, 2, 4, 5, 6, 9] : [1, 3, 4, 5, 7, 8]).includes(id)
}

export function honourEligible(id: string, c: CatalogUnit) {
  const h = HONOURS.find((h) => h.id === id)
  return (
    !!h &&
    !c.epic &&
    (!h.side || h.side === c.side) &&
    (!h.character || c.character) &&
    (id !== 'pathfinders' ||
      (!c.keywords.some((k) => ['VEHICLE', 'MONSTER'].includes(k)) &&
        !Object.values(c.card?.profiles ?? {}).some((p) => /^Scouts(?:\s|\d|$)/i.test(p.name))))
  )
}

export function defaultActiveHonours(u: Unit, c: CatalogUnit) {
  let regular = 0,
    major = 0,
    signature = 0
  const limit = u.xp >= 12 ? 3 : u.xp >= 7 ? 2 : u.xp >= 3 ? 1 : 0
  return u.honours.filter((id) => {
    if (!honourEligible(id, c)) return false
    const h = HONOURS.find((h) => h.id === id)!
    if (h.tier === 'Signature') return u.xp >= 18 && signature++ === 0
    if (regular >= limit || (h.tier === 'Major' && major >= (u.xp >= 18 ? 2 : 1))) return false
    regular++
    if (h.tier === 'Major') major++
    return true
  })
}
