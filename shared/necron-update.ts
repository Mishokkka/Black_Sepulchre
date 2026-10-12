import type { Snapshot, State } from './model.ts'
import { sameDatasheet } from './datasheets.ts'
import { STOCK_CATALOG, STOCK_DETACHMENTS } from './stock.generated.ts'
import { STOCK_ENHANCEMENTS, STOCK_BINDINGS } from './enhancements.generated.ts'
import { NECRON_DATA_VERSION } from './necron-prices.generated.ts'
import { applyNecronPrices, NECRON_SOURCE } from './necron-prices.ts'

/** Keep saved variants and IDs; update only this faction's official facts. */
export function normalizeNecronSnapshot(next: Snapshot) {
  next.catalog = next.catalog.map(applyNecronPrices)
  for (const d of next.detachments.filter((d) => d.side === 'necrons')) {
    const stock = STOCK_DETACHMENTS.find(
      (s) => s.side === 'necrons' && sameDatasheet(s.name, d.name),
    )
    if (!stock) continue
    Object.assign(d, { dp: stock.dp, dispositions: structuredClone(stock.dispositions) })
    if (stock.uniqueGroup) d.uniqueGroup = stock.uniqueGroup
    else delete d.uniqueGroup
    for (const e of next.enhancements.filter((e) => e.detachment === d.id)) {
      const source = STOCK_ENHANCEMENTS.find(
        (s) => s.detachment === stock.id && sameDatasheet(s.name, e.name),
      )
      if (source) Object.assign(e, structuredClone(source), { id: e.id, detachment: d.id })
    }
  }
  for (const b of STOCK_BINDINGS) {
    const stock = STOCK_DETACHMENTS.find((d) => d.id === b.detachment)!
    const detachment = next.detachments.find(
      (d) => d.side === 'necrons' && sameDatasheet(d.name, stock.name),
    )?.id
    if (!detachment) continue
    for (const c of next.catalog.filter(
      (c) => c.side === 'necrons' && sameDatasheet(c.datasheet, b.datasheet),
    ))
      c.packageCosts = [
        ...(c.packageCosts ?? []).filter((p) => !sameDatasheet(p.name, b.name)),
        { name: b.name, cost: b.cost, detachments: [detachment] },
      ]
  }
  return next
}

export function updatedNecronSnapshot(s: State): Snapshot {
  if (s.phase !== 'setup' || s.battles || s.battle)
    throw Error('Обновление Necrons рассчитано на подготовку до первого боя')
  const next = structuredClone(s.snapshot)
  for (const c of STOCK_CATALOG.filter((c) => c.side === 'necrons'))
    if (!next.catalog.some((v) => v.id === c.id)) next.catalog.push(structuredClone(c))
  for (const d of STOCK_DETACHMENTS.filter((d) => d.side === 'necrons')) {
    let saved = next.detachments.find((v) => v.side === 'necrons' && sameDatasheet(v.name, d.name))
    if (!saved) {
      saved = structuredClone(d)
      next.detachments.push(saved)
    }
    for (const e of STOCK_ENHANCEMENTS.filter((e) => e.detachment === d.id))
      if (
        !next.enhancements.some((v) => v.detachment === saved!.id && sameDatasheet(v.name, e.name))
      )
        next.enhancements.push({ ...structuredClone(e), detachment: saved.id })
  }
  normalizeNecronSnapshot(next)
  next.dispositions ??= []
  for (const name of new Set(
    next.detachments.filter((d) => d.side === 'necrons').flatMap((d) => d.dispositions ?? []),
  ))
    if (!next.dispositions.some((d) => d.side === 'necrons' && sameDatasheet(d.name, name)))
      next.dispositions.push({
        id: `necrons:disposition:${name.toLowerCase().replaceAll(' ', '-')}`,
        name,
        side: 'necrons',
      })
  next.id = `necrons-${NECRON_DATA_VERSION}`
  next.date = NECRON_DATA_VERSION
  next.sources = [...next.sources.filter((v) => v !== NECRON_SOURCE), NECRON_SOURCE].slice(-30)
  return next
}
