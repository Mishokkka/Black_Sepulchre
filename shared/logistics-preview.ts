import { command } from './engine.ts'
import { STAGES, entry } from './rules.ts'
import type { Side, State } from './model.ts'

export function logisticsPreview(
  s: State,
  side: Side,
  type: string,
  payload: Record<string, unknown>,
) {
  try {
    const next = command(
      s,
      { type, payload },
      { actor: side, dice: () => 1, id: () => 'qol-preview-unit' },
    )
    const a = s.players[side],
      z = next.players[side]
    const personal = s.units.reduce(
      (n, u) =>
        n +
        (u.side === side
          ? u.recovery - (next.units.find((v) => v.id === u.id)?.recovery ?? u.recovery)
          : 0),
      0,
    )
    const local = Object.values(s.sectors).reduce(
      (n, sec) => n + Math.max(0, sec.local - next.sectors[sec.key].local),
      0,
    )
    const cache =
      (s.units.find((u) => u.id === payload.id)?.armoury === 'cache' &&
        next.units.find((u) => u.id === payload.id)?.armoury !== 'cache') ||
      z.inventory.filter((i) => i === 'cache').length <
        a.inventory.filter((i) => i === 'cache').length
    const location = String(payload.location ?? 'field')
    const cap =
      location === 'field'
        ? STAGES[s.stage].al * 1.5
        : location === 'stf'
          ? STAGES[s.stage].al * 0.75
          : null
    const used = next.units
      .filter(
        (u) =>
          u.side === side &&
          u.location === location &&
          (location === 'stf'
            ? u.status === 'active'
            : !['lost', 'archived', 'sealed'].includes(u.status)),
      )
      .reduce((n, u) => n + u.rc, 0)
    return {
      allowed: true as const,
      reason: '',
      supply: a.supply - z.supply,
      remaining: z.supply,
      local,
      localRemaining: payload.sector
        ? next.sectors[payload.sector as keyof State['sectors']]?.local
        : undefined,
      personal,
      recovery: a.recovery - z.recovery,
      cache: !!cache,
      garrisonUnitCap:
        type === 'buy_unit' && location === 'garrison'
          ? STAGES[s.stage].al *
            (entry(s, { catalogId: String(payload.catalogId) } as State['units'][number])
              .garrison === 'other'
              ? 0.35
              : 0.4)
          : null,
      capRemaining: type === 'buy_unit' && cap !== null ? cap - used : null,
    }
  } catch (e) {
    return { allowed: false as const, reason: (e as Error).message }
  }
}
