import type { Side, State } from '../../shared/model'
export type Send = (type: string, payload?: Record<string, unknown>) => Promise<void | boolean>
export const labels: Record<Side, string> = { deathwatch: 'Deathwatch', necrons: 'Necrons' }
export const phases: Record<string, string> = {
  setup: 'Подготовка кампании',
  strategy: 'Стратегический ход',
  reaction: 'Ответ на саботаж',
  mission: 'Выбор миссии',
  lock: 'Разведка',
  muster: 'Сбор армии',
  interdict: 'Interdict',
  assets: 'Боевые Assets',
  battle: 'Бой за столом',
  result: 'Подтверждение результата',
  aftermath: 'Последствия боя',
  logistics: 'Снабжение',
  finale_mode: 'Решение о финале',
  ending: 'Судьба планеты',
  terminal: 'Кампания завершена',
}
export interface Props {
  s: State
  side: Side
  send: Send
}
export function Check({
  label,
  value,
  change,
}: {
  label: string
  value: boolean
  change: (b: boolean) => void
}) {
  return (
    <label className="check">
      <input type="checkbox" checked={value} onChange={(e) => change(e.target.checked)} />
      {label}
    </label>
  )
}
export function Options({
  value,
  change,
  items,
  label,
}: {
  value: string
  change: (v: string) => void
  items: { id: string; name: string }[]
  label: string
}) {
  return (
    <label>
      {label}
      <select aria-label={label} value={value} onChange={(e) => change(e.target.value)}>
        <option value="">Выберите…</option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </select>
    </label>
  )
}
