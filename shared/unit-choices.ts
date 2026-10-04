import type { CatalogUnit, Side } from './model.ts'
import { datasheetName, modelKeywords } from './datasheets.ts'
import { STOCK_CATALOG } from './stock.generated.ts'

export function modelLabel(n: number): string {
  const form =
    n % 100 >= 11 && n % 100 <= 14 ? 2 : n % 10 === 1 ? 0 : [2, 3, 4].includes(n % 10) ? 1 : 2
  return `${n} ${['модель', 'модели', 'моделей'][form]}`
}

// Free weapon permutations are source material, not separate campaign purchases.
// Keep price curves and transport-relevant model composition distinct.
function knownComposition(c: CatalogUnit): string {
  const armour = ['TACTICUS', 'PHOBOS', 'GRAVIS', 'TERMINATOR', 'CENTURION']
  const counts = new Map<string, number>()
  for (const g of c.card?.models ?? [{ count: c.models }]) {
    const keys = modelKeywords(c, 'stats' in g ? g : undefined)
    const key = armour.filter((k) => keys.includes(k)).join(',')
    counts.set(key, (counts.get(key) ?? 0) + g.count)
  }
  return JSON.stringify([...counts].sort(([a], [b]) => a.localeCompare(b)))
}

function composition(c: CatalogUnit): string {
  if (c.card) return knownComposition(c)
  // Old campaign entries have no model card/armour keywords. They are not a
  // special "unarmoured" version of the same datasheet. Infer only when all
  // reviewed source variants agree; retain uncertain mixed compositions.
  const known = new Set(
    STOCK_CATALOG.filter(
      (p) =>
        p.side === c.side &&
        p.models === c.models &&
        datasheetName(p.datasheet) === datasheetName(c.datasheet),
    ).map(knownComposition),
  )
  return known.size === 1 ? [...known][0] : knownComposition(c)
}

export function sizeKey(c: CatalogUnit): string {
  return JSON.stringify([datasheetName(c.datasheet), c.models, composition(c)])
}

export function priceKey(c: CatalogUnit): string {
  const copies = [...c.copyPrices]
  while (copies.at(-1) === c.rc) copies.pop()
  const options = (c.packageCosts ?? [])
    .filter((p) => p.cost > 0)
    .map((p) => ({
      name: p.name,
      cost: p.cost,
      optional: p.optional === true,
      detachments: [...p.detachments].sort(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return JSON.stringify([c.rc, copies, options])
}

/** Preserve order: saved campaign entries take precedence over library defaults. */
export function campaignChoices(catalog: CatalogUnit[], side: Side): CatalogUnit[] {
  const seen = new Set<string>()
  return catalog
    .filter((c) => {
      if (c.side !== side) return false
      const key = `${sizeKey(c)}:${priceKey(c)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort(
      (a, b) =>
        datasheetName(a.datasheet).localeCompare(datasheetName(b.datasheet)) ||
        a.models - b.models ||
        a.rc - b.rc,
    )
}

export function sizeLabel(c: CatalogUnit, peers: CatalogUnit[] = []): string {
  const mixed = peers.some((p) => p.models === c.models && sizeKey(p) !== sizeKey(c))
  if (!mixed) return modelLabel(c.models)
  const counts = JSON.parse(composition(c)) as [string, number][]
  return `${modelLabel(c.models)} · ${counts.map(([k, n]) => `${n} ${k || 'обычных'}`).join(' + ')}`
}

export function paidVariantLabel(c: CatalogUnit, base: CatalogUnit): string {
  if (priceKey(c) === priceKey(base)) return `Без доплаты · ${c.rc} RC`
  const gear = c.size.split('·').slice(1).join('·').trim() || c.size
  const delta = c.rc - base.rc
  return `${gear} · ${delta > 0 ? `+${delta} RC` : 'отдельная цена OBC копий'} · всего ${c.rc} RC`
}

export function optionalPackageCost(
  c: CatalogUnit,
  selected: string[],
  detachments: string[],
): number {
  const options = c.packageCosts ?? []
  if (
    !Array.isArray(selected) ||
    new Set(selected).size !== selected.length ||
    selected.some(
      (name) =>
        !options.some(
          (p) =>
            p.optional && p.name === name && p.detachments.some((id) => detachments.includes(id)),
        ),
    )
  )
    throw Error('Платная опция недоступна для этого отряда или detachment')
  return options
    .filter(
      (p) =>
        p.detachments.some((id) => detachments.includes(id)) &&
        (!p.optional || selected.includes(p.name)),
    )
    .reduce((n, p) => n + p.cost, 0)
}
