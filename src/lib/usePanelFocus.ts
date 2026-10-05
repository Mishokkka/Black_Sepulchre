import { useEffect } from 'react'

export function usePanelFocus(request: { target: string } | null) {
  useEffect(() => {
    if (!request) return
    // A lazy screen may arrive after the navigation click has already rendered.
    const focus = () => {
      const panel = document.getElementById(request.target)
      if (!panel) return
      panel.tabIndex = -1
      panel.focus({ preventScroll: true })
      panel.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      })
      observer.disconnect()
    }
    const observer = new MutationObserver(focus)
    observer.observe(document.getElementById('root')!, { childList: true, subtree: true })
    const frame = requestAnimationFrame(focus)
    const timeout = window.setTimeout(() => observer.disconnect(), 5000)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
      observer.disconnect()
    }
  }, [request])
}
