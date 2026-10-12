import type { Side, Snapshot } from './model.ts'
import { sameDatasheet } from './datasheets.ts'

/** Legacy snapshots without disposition metadata keep their accepted choices. */
export function dispositionChoices(snapshot: Snapshot, side: Side, detachments: string[]) {
  const selected = snapshot.detachments.filter((d) => detachments.includes(d.id))
  const constrained = selected.length > 0 && selected.every((d) => d.dispositions !== undefined)
  return (snapshot.dispositions ?? []).filter(
    (d) =>
      d.side === side &&
      (!constrained ||
        selected.some((s) => s.dispositions!.some((name) => sameDatasheet(name, d.name)))),
  )
}
