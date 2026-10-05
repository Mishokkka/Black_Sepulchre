import type { CatalogUnit, Side, State } from './model.ts'
import { datasheetName, sameDatasheet, suggestedTransport } from './datasheets.ts'
import { STOCK_CATALOG, STOCK_DETACHMENTS } from './stock.generated.ts'
import { STOCK_ENHANCEMENTS, STOCK_BINDINGS } from './enhancements.generated.ts'

/** Add choices, never replace an owner's saved variant, price, roster or package. */
export function expandStartingCatalogue(s: State) {
  const previous = [...s.snapshot.catalog]
  for (const stock of STOCK_CATALOG) {
    if (s.snapshot.catalog.some((c) => c.id === stock.id)) continue
    const c = structuredClone(stock)
    const existing = previous.find(
      (old) =>
        old.side === c.side && old.models === c.models && sameDatasheet(old.datasheet, c.datasheet),
    )
    if (existing) {
      c.rc = existing.rc
      // The current site price wins over an imported reference's first-copy price.
      c.copyPrices = [...existing.copyPrices]
    }
    const transport = suggestedTransport(c.datasheet)
    if (transport) {
      c.transportRule = transport
      c.transport = transport.groups.reduce((n, g) => n + g.capacity, 0)
    }
    s.snapshot.catalog.push(c)
  }
  for (const d of STOCK_DETACHMENTS)
    if (
      !s.snapshot.detachments.some((old) => old.side === d.side && sameDatasheet(old.name, d.name))
    )
      s.snapshot.detachments.push(structuredClone(d))
  s.flags.startingCatalogue = 1
  expandStartingEnhancements(s)
}

/** Match saved detachment IDs, preserve owner prices and make existing campaigns opt in. */
export function expandStartingEnhancements(s: State) {
  const detachmentId = (id: string) => {
    const stock = STOCK_DETACHMENTS.find((d) => d.id === id)!
    return s.snapshot.detachments.find(
      (d) => d.side === stock.side && sameDatasheet(d.name, stock.name),
    )?.id
  }
  for (const stock of STOCK_ENHANCEMENTS) {
    const detachment = detachmentId(stock.detachment)
    if (
      !detachment ||
      s.snapshot.enhancements.some(
        (e) =>
          e.id === stock.id || (e.detachment === detachment && sameDatasheet(e.name, stock.name)),
      )
    )
      continue
    s.snapshot.enhancements.push({ ...structuredClone(stock), detachment })
  }
  for (const binding of STOCK_BINDINGS) {
    const detachment = detachmentId(binding.detachment)
    if (!detachment) continue
    for (const c of s.snapshot.catalog.filter(
      (c) => c.side === 'necrons' && sameDatasheet(c.datasheet, binding.datasheet),
    )) {
      c.packageCosts ??= []
      if (
        !c.packageCosts.some(
          (o) => sameDatasheet(o.name, binding.name) && o.detachments.includes(detachment),
        )
      )
        c.packageCosts.push({ name: binding.name, cost: binding.cost, detachments: [detachment] })
    }
  }
  s.flags.startingEnhancements = 1
}

/** Campaign small-format rules: individual RC <=40% AL, no Epic/Titanic, one copy. */
export function starterUnavailable(s: State, side: Side, c: CatalogUnit): string | null {
  if (c.side !== side) return 'Другая фракция'
  if (c.epic) return 'Epic Hero доступен с 1000 очков'
  if (c.keywords.includes('TITANIC')) return 'TITANIC доступен с 1000 очков'
  if (c.rc > 200) return 'Один отряд на старте может стоить не более 200 RC'
  const existing = s.units
    .filter(
      (u) =>
        u.side === side &&
        u.status === 'active' &&
        u.location === 'field' &&
        sameDatasheet(
          s.snapshot.catalog.find((v) => v.id === u.catalogId)?.datasheet ?? '',
          c.datasheet,
        ),
    )
    .map((u) => s.snapshot.catalog.find((v) => v.id === u.catalogId)!)
  const limit = Math.min(
    ...[c, ...existing].map((v) => (v.battleline && !v.unique && !v.epic ? 2 : 1)),
  )
  if (existing.length >= limit)
    return `Уже выбран максимум отдельных отрядов ${c.datasheet}; можно заменить размер`
  return null
}

export function starterChoices(s: State, side: Side): CatalogUnit[] {
  return s.snapshot.catalog
    .filter((c) => !starterUnavailable(s, side, c))
    .sort(
      (a, b) =>
        datasheetName(a.datasheet).localeCompare(datasheetName(b.datasheet)) ||
        a.models - b.models ||
        a.size.localeCompare(b.size),
    )
}
