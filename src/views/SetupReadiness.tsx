import { SIDES, type Side, type State } from '../../shared/model'
import { startingArmy } from '../../shared/setup'
import { labels } from './common'
import { CheckCircle2, Clock3, Shield, Skull } from 'lucide-react'

export function setupStatus(s: State, side: Side) {
  try {
    startingArmy(s, side)
    return ''
  } catch (error) {
    return error instanceof Error ? error.message : 'Проверьте состав'
  }
}
export function SetupReadiness({ s, members }: { s: State; members?: Side[] | null }) {
  return (
    <section className="panel setup-readiness" aria-label="Готовность кампании">
      <h2>Что осталось до первого хода</h2>
      <div className="cards">
        {SIDES.map((side) => {
          const problem = setupStatus(s, side),
            joined = members?.includes(side)
          return (
            <div key={side} className="readiness-player">
              <h3>
                {side === 'deathwatch' ? <Shield size={20} /> : <Skull size={20} />}
                {labels[side]}
              </h3>
              <p>
                {joined ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}
                {members == null
                  ? 'Участие ещё не проверено'
                  : joined
                    ? '✓ Игрок присоединился'
                    : 'Ждём подключения по коду приглашения'}
              </p>
              <p className={problem ? 'notice' : 'success'}>
                {problem || '✓ Стартовый состав подходит'}
              </p>
              <p>
                {s.setupApproved.includes(side) ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}
                {s.setupApproved.includes(side)
                  ? '✓ Игрок отметил готовность'
                  : 'Игрок ещё готовит армию'}
              </p>
            </div>
          )
        })}
      </div>
      <p>Правила {s.rules}. Когда обе армии готовы, приложение само открывает первый ход.</p>
    </section>
  )
}
