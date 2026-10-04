import { useState } from 'react'
import type { CatalogUnit, Side } from '../../shared/model'
import { datasheetName } from '../../shared/datasheets'
import {
  campaignChoices,
  priceKey,
  sizeKey,
  sizeLabel,
  paidVariantLabel,
} from '../../shared/unit-choices'
import { Options } from './CampaignViews'

/** One datasheet, then size, then only choices which change the price. */
export function UnitChoice({
  catalog,
  side,
  value,
  change,
  label,
  fixedDatasheet,
  search = false,
}: {
  catalog: CatalogUnit[]
  side: Side
  value: string
  change: (id: string) => void
  label: string
  fixedDatasheet?: string
  search?: boolean
}) {
  const [query, setQuery] = useState('')
  const choices = campaignChoices(catalog, side)
  const raw = catalog.find((c) => c.id === value && c.side === side)
  const current =
    raw && choices.find((c) => sizeKey(c) === sizeKey(raw) && priceKey(c) === priceKey(raw))
  const sheets = [...new Map(choices.map((c) => [datasheetName(c.datasheet), c])).values()].filter(
    (c) => c.datasheet.toLowerCase().includes(query.toLowerCase()),
  )
  const sheet = fixedDatasheet
    ? datasheetName(fixedDatasheet)
    : current
      ? datasheetName(current.datasheet)
      : ''
  const peers = choices.filter((c) => datasheetName(c.datasheet) === sheet)
  const sizes = peers.filter((c, i) => peers.findIndex((p) => sizeKey(p) === sizeKey(c)) === i)
  const variants = current
    ? peers.filter((c) => sizeKey(c) === sizeKey(current)).sort((a, b) => a.rc - b.rc)
    : []
  return (
    <div className="unit-choice">
      {search && (
        <label>
          Поиск юнита
          <input
            aria-label={`Поиск юнита: ${label}`}
            value={query}
            placeholder="Например: Lychguard, Captain…"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      )}
      {!fixedDatasheet && (
        <Options
          label={label}
          value={sheet}
          change={(key) =>
            change(choices.find((c) => datasheetName(c.datasheet) === key)?.id ?? '')
          }
          items={sheets.map((c) => ({ id: datasheetName(c.datasheet), name: c.datasheet }))}
        />
      )}
      {!!sheet && (
        <Options
          label={`Размер: ${label}`}
          value={current ? sizeKey(current) : ''}
          change={(key) => change(peers.find((c) => sizeKey(c) === key)?.id ?? '')}
          items={sizes.map((c) => ({
            id: sizeKey(c),
            name: `${sizeLabel(c, peers)} · ${peers.some((p) => sizeKey(p) === sizeKey(c) && p.rc !== c.rc) ? 'от ' : ''}${c.rc} RC`,
          }))}
        />
      )}
      {variants.length > 1 && (
        <Options
          label={`Платная комплектация: ${label}`}
          value={current?.id ?? ''}
          change={change}
          items={variants.map((c) => ({ id: c.id, name: paidVariantLabel(c, variants[0]) }))}
        />
      )}
      {current && !fixedDatasheet && <small>Стоимость выбранного отряда: {current.rc} RC</small>}
    </div>
  )
}
