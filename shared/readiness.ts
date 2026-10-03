import { HONOURS } from './rules.generated.ts'
import type { Battle, Muster, Pick, Side, State, Unit } from './model.ts'
import { available, entry, STAGES, surcharge, effectPrice, ARMOURY, RELICS } from './rules.ts'
import { validateMuster } from './muster.ts'

// Search legal Field subsets, leader layouts and optional campaign loadouts. Caps
// prune the search and an exact AL deployment is an immediate optimum.
export function maximumReady(source: State, side: Side): number {
  const s = structuredClone(source),
    stage = STAGES[s.stage],
    al = stage.al
  const b = {
    al,
    stage: s.stage,
    type: 'field',
    snapshot: s.snapshot,
    attacker: side,
    defender: side === 'deathwatch' ? 'necrons' : 'deathwatch',
    initial: 0,
    pool: 0,
    effects: [],
  } as unknown as Battle
  s.battle = b
  const units = s.units.filter((u) => u.side === side && u.location === 'field' && available(s, u))
  if (!units.some((u) => entry(s, u).character) || !s.players[side].package.length) return 0
  let best = 0
  const pick = (u: Unit): Pick => ({
    id: u.id,
    role: 'field',
    formation: u.id,
    transport: null,
    reserve: false,
    enhancement: null,
    honours: [],
    armoury: false,
    relic: false,
    redemption: null,
    protocol: 'HOLD',
  })
  const packages: string[][] = []
  for (const id of s.players[side].package) {
    for (const a of [...packages]) packages.push([...a, id])
    packages.push([id])
  }
  const upper = new Map(
    units.map((u) => {
      const c = entry(s, u),
        formationRC = al
      let n = Math.max(c.rc, ...c.copyPrices)
      for (const id of u.honours) {
        const h = HONOURS.find((h) => h.id === id)!
        n += effectPrice(h.tier, h.formation, u.rc, formationRC)
      }
      for (const a of [u.armoury ? ARMOURY[u.armoury] : null, u.relic ? RELICS[u.relic] : null])
        if (a?.tier) n += effectPrice(a.tier, a.formation, u.rc, formationRC)
      n += Math.max(0, ...s.snapshot.enhancements.map((e) => e.cost))
      return [u.id, n]
    }),
  )
  const solve = (selected: Unit[]) => {
    const commander = selected.find((u) => entry(s, u).character)
    if (!commander) return
    const original = selected.map(pick),
      leaders = selected.filter((u) => entry(s, u).character),
      bodies = selected.filter((u) => !entry(s, u).character)
    const layout = (i: number, picks: Pick[]) => {
      if (best === al) return
      if (i < leaders.length) {
        const leader = leaders[i]
        layout(i + 1, picks)
        for (const body of bodies) {
          if (!entry(s, leader).leaderFor.includes(entry(s, body).datasheet)) continue
          const next = structuredClone(picks)
          next.find((p) => p.id === leader.id)!.formation = body.id
          layout(i + 1, next)
        }
        return
      }
      for (const detachments of packages) {
        const m: Muster = {
          picks,
          rest: [],
          detachments,
          commander: commander.id,
          dispositions: [],
        }
        let costs: Record<string, number>
        try {
          costs = validateMuster(s, side, m, b)
        } catch {
          continue
        }
        let dp = new Map<string, { cost: number; enh: string[] }>([['0', { cost: 0, enh: [] }]])
        for (const p of picks) {
          const u = selected.find((u) => u.id === p.id)!,
            cat = entry(s, u)
          const hs = u.honours.filter((id) => {
            const h = HONOURS.find((h) => h.id === id)!
            return (
              (!h.character || cat.character) &&
              (!h.side || h.side === side) &&
              !cat.epic &&
              (h.tier !== 'Signature' || u.xp >= 18)
            )
          })
          const combinations: string[][] = [[]]
          for (const h of hs) for (const a of [...combinations]) combinations.push([...a, h])
          const variants = combinations.filter(
            (ids) =>
              ids.filter((id) => HONOURS.find((h) => h.id === id)!.tier !== 'Signature').length <=
                Math.min(3, u.xp >= 12 ? 3 : u.xp >= 7 ? 2 : u.xp >= 3 ? 1 : 0) &&
              ids.filter((id) => HONOURS.find((h) => h.id === id)!.tier === 'Major').length <=
                (u.xp >= 18 ? 2 : 1),
          )
          const enhancements = [
            null,
            ...b.snapshot.enhancements
              .filter(
                (e) =>
                  cat.character &&
                  !cat.epic &&
                  detachments.includes(e.detachment) &&
                  e.eligible.every((k) => cat.keywords.includes(k)) &&
                  (!s.players[side].enhancements[e.id] ||
                    s.players[side].enhancements[e.id] === u.id ||
                    s.players[side].enhancementStage !== s.stage),
              )
              .map((e) => e.id),
          ]
          const options = new Map<string, { cost: number; enh: string | null }>()
          for (const honours of variants)
            for (const armoury of u.armoury && !cat.epic ? [false, true] : [false])
              for (const relic of u.relic && !cat.epic ? [false, true] : [false])
                for (const enhancement of enhancements) {
                  const v = { ...p, honours, armoury, relic, enhancement }
                  const cost =
                    costs[p.id] +
                    surcharge(s, u, v, picks) +
                    (enhancement
                      ? b.snapshot.enhancements.find((e) => e.id === enhancement)!.cost
                      : 0)
                  options.set(`${cost}:${enhancement}`, { cost, enh: enhancement })
                }
          const next = new Map<string, { cost: number; enh: string[] }>()
          for (const a of dp.values())
            for (const o of options.values()) {
              const cost = a.cost + o.cost
              if (
                cost > al ||
                (o.enh && a.enh.includes(o.enh)) ||
                a.enh.length + (o.enh ? 1 : 0) > stage.enhancements
              )
                continue
              const enh = o.enh ? [...a.enh, o.enh].sort() : a.enh
              next.set(`${cost}:${enh.join(',')}`, { cost, enh })
            }
          dp = next
        }
        for (const a of dp.values()) best = Math.max(best, a.cost)
      }
    }
    layout(0, original)
  }
  const walk = (i: number, selected: Unit[], base: number) => {
    if (
      best === al ||
      base > al ||
      [...selected, ...units.slice(i)].reduce((n, u) => n + upper.get(u.id)!, 0) <= best
    )
      return
    if (i === units.length) {
      solve(selected)
      return
    }
    walk(
      i + 1,
      [...selected, units[i]],
      base + Math.min(units[i].rc, ...entry(s, units[i]).copyPrices),
    )
    walk(i + 1, selected, base)
  }
  walk(0, [], 0)
  return best
}
