import type { KeyboardEvent } from 'react'

/** Keep native dialogs cyclic even when the browser would tab into its chrome. */
export function trapDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== 'Tab') return
  const dialog = event.currentTarget
  const controls = Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button, a[href], input, select, textarea, summary, [tabindex]',
    ),
  ).filter(
    (element) =>
      element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length,
  )
  const first = controls[0],
    last = controls.at(-1)
  const active = document.activeElement
  if (!first) {
    event.preventDefault()
    dialog.focus()
    return
  }
  if (event.shiftKey && (active === first || active === dialog)) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && (active === last || active === dialog)) {
    event.preventDefault()
    first.focus()
  }
}
