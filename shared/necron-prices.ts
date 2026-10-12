import type { CatalogUnit } from './model.ts'
import { sameDatasheet } from './datasheets.ts'
import { NECRON_DATA_VERSION, NECRON_PRICES } from './necron-prices.generated.ts'

export const NECRON_SOURCE = `Necrons · MFM v1.5 · ${NECRON_DATA_VERSION} · https://mfm.warhammer-community.com/en/necrons`

/** Base/copy prices exclude enhancements and mandatory Pantheon bindings. */
export function necronPrices(c: CatalogUnit) {
  if (c.side !== 'necrons') return null
  const sheet = NECRON_PRICES.find((s) => sameDatasheet(s.name, c.datasheet))
  if (!sheet) return null
  const tiers = sheet.tiers.filter((t) => t.models === c.models)
  if (!tiers.length) return null
  const copyPrices = Array.from(
    { length: 6 },
    (_, i) =>
      tiers.find((t) => t.copyFrom <= i + 1 && (t.copyTo === null || i + 1 <= t.copyTo))!.points,
  )
  return { rc: copyPrices[0], copyPrices, paidOptions: [] }
}

export function applyNecronPrices(c: CatalogUnit): CatalogUnit {
  const prices = necronPrices(c)
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
