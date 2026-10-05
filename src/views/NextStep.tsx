import { nextStep } from '../../shared/next-step'
import type { Side, State } from '../../shared/model'
import { ArrowRight, Clock3, Crosshair } from 'lucide-react'
import { useState } from 'react'
import { usePanelFocus } from '../lib/usePanelFocus'

export function NextStep({
  s,
  side,
  navigate,
  reading = false,
}: {
  s: State
  side: Side
  navigate: (tab: string) => void
  reading?: boolean
}) {
  const n = nextStep(s, side)
  const [requested, setRequested] = useState<{ target: string } | null>(null)
  usePanelFocus(requested)
  return (
    <section
      className={`next-step action-dock${n.waiting ? ' waiting' : ''}${reading || n.waiting ? ' reading' : ''}`}
      aria-label="Следующий шаг"
    >
      <div className="action-dock-icon" aria-hidden="true">
        {n.waiting ? <Clock3 size={22} /> : <Crosshair size={22} />}
      </div>
      <div className="action-dock-copy">
        <small>{n.waiting ? 'Ожидание командира' : 'Ваш следующий шаг'}</small>
        <p>{n.text}</p>
      </div>
      <button
        className={n.waiting ? 'quiet' : 'primary'}
        onClick={() => {
          navigate(n.tab)
          setRequested({ target: n.target })
        }}
      >
        Открыть этап <ArrowRight size={16} aria-hidden="true" />
      </button>
    </section>
  )
}
