import { command } from './engine.ts'
import type { Phase, SectorKey, Side, State } from './model.ts'
import { SECTORS } from './rules.ts'

export type StrategyPreview =
  | { allowed: false; reason: string }
  | {
      allowed: true
      reason: ''
      before: { supply: number; intel: number; debt: number; mp: number; actions: number }
      after: { supply: number; intel: number; debt: number; mp: number; actions: number }
      phase: Phase
      outcome: 'move' | 'occupation' | 'contact' | 'home' | 'action'
      random: boolean
    }

/** Display-only projection. Never returns rolled missions, dice or a future battle payload. */
export function strategyPreview(
  s: State,
  side: Side,
  type: string,
  payload: Record<string, unknown>,
): StrategyPreview {
  try {
    let random = false
    const next = command(
      s,
      { type, payload },
      {
        actor: side,
        // Validate through Missing Hour's success branch; the UI marks rolled outcomes as uncertain.
        dice: (faces) => {
          random = true
          return faces
        },
        id: () => 'strategy-preview',
      },
    )
    const resources = (state: State) => ({
      supply: state.players[side].supply,
      intel: state.players[side].intel,
      debt: state.players[side].debt,
      mp: state.activation?.mp ?? 0,
      actions: state.activation?.actions ?? 0,
    })
    return {
      allowed: true,
      reason: '',
      before: resources(s),
      after: resources(next),
      phase: next.phase,
      outcome:
        type === 'move'
          ? 'move'
          : type !== 'attack'
            ? 'action'
            : SECTORS[payload.target as SectorKey]?.home
              ? 'home'
              : next.battle
                ? 'contact'
                : 'occupation',
      random,
    }
  } catch (error) {
    return { allowed: false, reason: (error as Error).message }
  }
}

export function strategyRoutes(s: State, side: Side, method: string, raid: boolean) {
  return Object.fromEntries(
    (Object.keys(SECTORS) as SectorKey[]).map((target) => [
      target,
      strategyPreview(s, side, s.sectors[target].owner === side ? 'move' : 'attack', {
        target,
        method,
        raid,
      }),
    ]),
  ) as Record<SectorKey, StrategyPreview>
}
