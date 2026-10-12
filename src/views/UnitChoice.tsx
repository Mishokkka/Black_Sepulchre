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
import { Check, Options } from './common'
import { EPIC_HERO_UNLOCK_BATTLES, epicHeroPurchaseReason } from '../../shared/epic-heroes'

/** One datasheet, then size, then only choices which change the price. */
export function UnitChoice({
  catalog,
  side,
  value,
  change,
  label,
  fixedDatasheet,
  search = false,
  purchaseBattles,
}: {
  catalog: CatalogUnit[]
  side: Side
  value: string
  change: (id: string) => void
  label: string
  fixedDatasheet?: string
  search?: boolean
  purchaseBattles?: number
}) {
  const [query, setQuery] = useState('')
  const [epicOnly, setEpicOnly] = useState(false)
  const choices = campaignChoices(catalog, side)
  const locked = (c: CatalogUnit) =>
    purchaseBattles !== undefined && !!epicHeroPurchaseReason(purchaseBattles, c)
  const heroCount = new Set(choices.filter((c) => c.epic).map((c) => datasheetName(c.datasheet)))
    .size
  const raw = catalog.find((c) => c.id === value && c.side === side)
  const current =
    raw && choices.find((c) => sizeKey(c) === sizeKey(raw) && priceKey(c) === priceKey(raw))
  const sheets = [...new Map(choices.map((c) => [datasheetName(c.datasheet), c])).values()].filter(
    (c) => c.datasheet.toLowerCase().includes(query.toLowerCase()) && (!epicOnly || c.epic),
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
      {purchaseBattles !== undefined && (
        <>
          <p className="muted" role="status" aria-label="Доступ Epic Heroes">
            {purchaseBattles < EPIC_HERO_UNLOCK_BATTLES
              ? `Epic Heroes открываются после четвёртого завершённого боя. Завершено: ${purchaseBattles}/${EPIC_HERO_UNLOCK_BATTLES}.`
              : `Epic Heroes открыты для покупки. Героев в вашем каталоге: ${heroCount}.`}
          </p>
          <Check
            label="Показать только Epic Heroes"
            value={epicOnly}
            change={(v) => {
              setEpicOnly(v)
              if (v && current && !current.epic) change('')
            }}
          />
        </>
      )}
      {!fixedDatasheet && (
        <Options
          label={label}
          value={sheet}
          change={(key) =>
            change(choices.find((c) => datasheetName(c.datasheet) === key)?.id ?? '')
          }
          items={sheets.map((c) => ({
            id: datasheetName(c.datasheet),
            name: `${c.datasheet}${purchaseBattles !== undefined && c.epic ? (locked(c) ? ' · Epic Hero · после 4 боёв' : ' · Epic Hero') : ''}`,
            disabled: locked(c),
          }))}
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
            disabled: locked(c),
          }))}
        />
      )}
      {variants.length > 1 && (
        <Options
          label={`Платная комплектация: ${label}`}
          value={current?.id ?? ''}
          change={change}
          items={variants.map((c) => ({
            id: c.id,
            name: paidVariantLabel(c, variants[0]),
            disabled: locked(c),
          }))}
        />
      )}
      {current && !fixedDatasheet && <small>Стоимость выбранного отряда: {current.rc} RC</small>}
    </div>
  )
}
