import type { CatalogUnit } from './model.ts'
import type { CargoGroup } from './datasheets.ts'
import { modelKeywords, keyword } from './datasheets.ts'
import { assert } from './rules.ts'

export interface Cargo {
  catalog: CatalogUnit
  attachedTo?: CatalogUnit
}
function eligible(keys: string[], group: CargoGroup, attachedTo?: CatalogUnit) {
  const has = (k: string) => keys.includes(keyword(k))
  if (!group.all.every(has) || (group.any.length && !group.any.some(has))) return false
  return !group.exclude.some((k) => {
    if (
      keyword(k) === 'TACTICUS' &&
      group.attachedTacticusCharacter &&
      has('CHARACTER') &&
      attachedTo
    ) {
      const body = (attachedTo.card?.unitKeywords ?? attachedTo.keywords).map(keyword)
      if (!body.includes('TACTICUS')) return false
    }
    return has(k)
  })
}
/** Match individual models to finite categories of seats; overlapping groups need matching. */
export function validateCargo(transport: CatalogUnit, cargo: Cargo[]) {
  assert(transport.transport > 0, 'Это не транспорт')
  const individuals = cargo.flatMap(({ catalog, attachedTo }) => {
    if (catalog.card)
      return catalog.card.models.flatMap((g) =>
        Array.from({ length: g.count }, () => ({ keys: modelKeywords(catalog, g), attachedTo })),
      )
    return Array.from({ length: catalog.models }, () => ({
      keys: catalog.keywords.map(keyword),
      attachedTo,
    }))
  })
  assert(individuals.length <= transport.transport, 'Превышена вместимость транспорта')
  if (!transport.transportRule) {
    assert(
      individuals.every((m) => transport.cargoKeywords.every((k) => m.keys.includes(keyword(k)))),
      'Нелегальный груз',
    )
    return
  }
  const seats = transport.transportRule.groups.flatMap((g) =>
      Array.from({ length: g.capacity }, () => g),
    ),
    occupied = seats.map(() => -1)
  const assign = (model: number, visited: Set<number>): boolean => {
    for (let seat = 0; seat < seats.length; seat++) {
      if (
        visited.has(seat) ||
        !eligible(individuals[model].keys, seats[seat], individuals[model].attachedTo)
      )
        continue
      visited.add(seat)
      if (occupied[seat] < 0 || assign(occupied[seat], visited)) {
        occupied[seat] = model
        return true
      }
    }
    return false
  }
  assert(
    individuals.every((_, i) => assign(i, new Set())),
    'Модели не соответствуют типам мест или исключениям транспорта',
  )
}
