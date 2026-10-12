import type { CatalogUnit } from './model.ts'
import { datasheetName, sameDatasheet } from './datasheets.ts'
import { MARINE_DATA_VERSION, MARINE_PRICES } from './marine-prices.generated.ts'

export const MARINE_SOURCE = `Space Marines / Deathwatch · MFM v1.5 · ${MARINE_DATA_VERSION} · https://mfm.warhammer-community.com/en/deathwatch`

/** Official prices count physical weapons, not their firing profiles or the copy surcharge. */
export function marinePrices(c: CatalogUnit) {
  if (c.side !== 'deathwatch') return null
  const sheet = MARINE_PRICES.find((s) => sameDatasheet(s.name, c.datasheet))
  if (!sheet) return null
  const tiers = sheet.tiers.filter((p) => p.models === c.models)
  if (!tiers.length) return null
  const equipment = c.card
    ? [...c.card.equipment, ...c.card.models.flatMap((g) => g.equipment)]
    : []
  const paidOptions = sheet.paidWargear.flatMap((option) => {
    const count = equipment.reduce(
      (n, e) => n + (datasheetName(e.name) === datasheetName(option.name) ? e.count : 0),
      0,
    )
    return count ? [{ name: `${option.name} ×${count}`, cost: count * option.points }] : []
  })
  const extra = paidOptions.reduce((n, p) => n + p.cost, 0)
  const copyPrices = Array.from({ length: 6 }, (_, i) => {
    const p = tiers.find((p) => p.copyFrom <= i + 1 && (p.copyTo === null || i + 1 <= p.copyTo))!
    return p.points + extra
  })
  return { rc: copyPrices[0], copyPrices, paidOptions }
}

export function applyMarinePrices(c: CatalogUnit): CatalogUnit {
  const prices = marinePrices(c)
  if (!prices) return c
  return {
    ...c,
    rc: prices.rc,
    copyPrices: prices.copyPrices,
    ...(c.card
      ? {
          card: {
            ...c.card,
            exportedPoints: prices.rc,
            copyOrdinal: 1,
            paidOptions: prices.paidOptions,
          },
        }
      : {}),
  }
}
