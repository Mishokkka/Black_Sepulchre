import type { Side, State } from '../../shared/model'
import type { Send } from '../App'

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
