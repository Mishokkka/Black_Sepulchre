import { nextStep } from '../../shared/next-step'
import type { Side, State } from '../../shared/model'

export function NextStep({
  s,
  side,
  navigate,
}: {
  s: State
  side: Side
  navigate: (tab: string) => void
}) {
  const n = nextStep(s, side)
  return (
    <section className="panel next-step" aria-label="Следующий шаг">
      <div>
        <small>{n.waiting ? 'Сейчас ожидается' : 'Ваш следующий шаг'}</small>
        <p>{n.text}</p>
      </div>
      <button
        className="quiet"
        onClick={() => {
          navigate(n.tab)
          requestAnimationFrame(() =>
            document
              .getElementById(n.target)
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
          )
        }}
      >
        Открыть этап
      </button>
    </section>
  )
}
