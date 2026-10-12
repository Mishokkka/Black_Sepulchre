import type { CatalogUnit } from './model.ts'

export const EPIC_HERO_UNLOCK_BATTLES = 4

/** Use completed tabletop battles, never the announced battle number or strategic activations. */
export function epicHeroPurchaseReason(completedBattles: number, unit: Pick<CatalogUnit, 'epic'>) {
  return unit.epic && completedBattles < EPIC_HERO_UNLOCK_BATTLES
    ? `Epic Heroes можно покупать после четвёртого завершённого боя: сейчас завершено ${completedBattles} из ${EPIC_HERO_UNLOCK_BATTLES}.`
    : null
}
