import type { Enhancement, Pick } from '../../shared/model'

export function enhancementEligibilityLabel(e: Enhancement) {
  const keywords = [
    ...e.eligible,
    ...(e.eligibleAny ?? []).map((clause) => clause.join(' + ')),
  ].join(' / ')
  const names = e.datasheets && e.datasheets.length <= 4 ? e.datasheets.join(' / ') : ''
  return [
    e.upgrade || e.unitEligible ? 'Отряд' : 'CHARACTER',
    names || keywords,
    e.excluded?.length ? `кроме ${e.excluded.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

export function EnhancementChoice({
  options,
  value,
  change,
  label,
  picks,
  unitId,
  limit,
}: {
  options: Enhancement[]
  value: string
  change: (id: string) => void
  label: string
  picks: Pick[]
  unitId: string
  limit: number
}) {
  const others = picks.filter((p) => p.id !== unitId && p.enhancement)
  const ids = new Set(others.map((p) => p.enhancement))
  const selected = options.find((e) => e.id === value)
  return (
    <div className="enhancement-choice">
      <label>
        {label}
        <select aria-label={label} value={value} onChange={(event) => change(event.target.value)}>
          <option value="">Без улучшения</option>
          {value && !selected && <option value={value}>Проверьте назначенное улучшение</option>}
          {options.map((e) => {
            const unavailable =
              (!ids.has(e.id) && ids.size >= limit) ||
              others.filter((p) => p.enhancement === e.id).length >= (e.upgrade ? 3 : 1)
            return (
              <option key={e.id} value={e.id} disabled={unavailable}>
                {e.name} · +{e.cost} очков{e.upgrade ? ' · Upgrade' : ''}
                {unavailable ? ' · лимит занят' : ''}
              </option>
            )
          })}
        </select>
      </label>
      {selected && (
        <small>
          {selected.upgrade
            ? 'Upgrade: до трёх подходящих отрядов, один слот. Стоимость оплачивается за каждого носителя.'
            : 'Стоимость улучшения входит в Effective, базовый RC отряда не меняется.'}
        </small>
      )}
    </div>
  )
}
