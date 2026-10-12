import type { Snapshot, State } from './model.ts'
import { sameDatasheet, suggestedTransport } from './datasheets.ts'
import { STOCK_CATALOG, STOCK_DETACHMENTS } from './stock.generated.ts'
import { STOCK_ENHANCEMENTS } from './enhancements.generated.ts'
import { MARINE_DATA_VERSION } from './marine-prices.generated.ts'
import { MARINE_SOURCE } from './marine-prices.ts'

/** Explicit pre-campaign update. Keep owned IDs and leave the other faction's data intact. */
export function updatedMarineSnapshot(s: State): Snapshot {
  if (s.phase !== 'setup' || s.battles || s.battle)
    throw Error('Обновление Space Marines рассчитано на подготовку до первого боя')
  if (s.snapshot.sources.includes(MARINE_SOURCE)) return structuredClone(s.snapshot)
  const next = structuredClone(s.snapshot)
  const oldMarineDetachments = next.detachments.filter((d) => d.side === 'deathwatch')
  const otherEnhancements = next.enhancements.filter(
    (e) => !oldMarineDetachments.some((d) => d.id === e.detachment),
  )
  const marines = structuredClone(STOCK_CATALOG.filter((c) => c.side === 'deathwatch'))
  for (const c of marines) {
    const transport = suggestedTransport(c.datasheet)
    if (transport) {
      c.transportRule = transport
      c.transport = transport.groups.reduce((n, g) => n + g.capacity, 0)
    }
  }
  const owned = new Set([
    ...s.units.filter((u) => u.side === 'deathwatch').map((u) => u.catalogId),
    ...s.players.deathwatch.starter,
  ])
  const aliases = next.catalog
    .filter((c) => c.side === 'deathwatch' && owned.has(c.id))
    .map((old) => {
      const replacement = marines.find(
        (c) => sameDatasheet(c.datasheet, old.datasheet) && c.models === old.models,
      )
      if (!replacement)
        throw Error(`Нужен ручной выбор нового состава: ${old.datasheet}, ${old.models} моделей`)
      return { ...structuredClone(replacement), id: old.id }
    })
  next.catalog = [
    ...next.catalog.filter((c) => c.side !== 'deathwatch'),
    ...aliases,
    ...marines.filter((c) => !owned.has(c.id)),
  ]
  const detachments = STOCK_DETACHMENTS.filter((d) => d.side === 'deathwatch').map((d) => ({
    ...structuredClone(d),
    id: oldMarineDetachments.find((old) => sameDatasheet(old.name, d.name))?.id ?? d.id,
  }))
  next.detachments = [...next.detachments.filter((d) => d.side !== 'deathwatch'), ...detachments]
  next.enhancements = [
    ...otherEnhancements,
    ...STOCK_ENHANCEMENTS.flatMap((e) => {
      const stock = STOCK_DETACHMENTS.find((d) => d.id === e.detachment && d.side === 'deathwatch')
      if (!stock) return []
      const detachment = detachments.find((d) => sameDatasheet(d.name, stock.name))!.id
      const old = s.snapshot.enhancements.find(
        (v) => v.detachment === detachment && sameDatasheet(v.name, e.name),
      )
      return [{ ...structuredClone(e), detachment, id: old?.id ?? e.id }]
    }),
  ]
  next.date = MARINE_DATA_VERSION
  next.id = `space-marines-${MARINE_DATA_VERSION}`
  next.sources = [...next.sources, MARINE_SOURCE].slice(-30)
  return next
}
