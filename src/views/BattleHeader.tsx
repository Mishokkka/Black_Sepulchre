import { Check, Circle, Minus, Swords, Clock3 } from 'lucide-react'
import { battleProgress, TABLE_STEPS } from '../../shared/battle-ui'
import { nextStep } from '../../shared/next-step'
import { MISSION_CARDS } from '../../shared/rules.generated'
import { SIDES } from '../../shared/model'
import { StatusBadge } from './StatusBadge'
import { labels, phases, type Props } from './common'
import { RuleHelp } from './RulesContext'

export function BattleHeader({ s, side }: Pick<Props, 's' | 'side'>) {
  const b = s.battle!,
    n = nextStep(s, side)
  const live = ['battle', 'result', 'aftermath', 'ending'].includes(s.phase)
  const vp = b.report?.vp ?? b.table.vp
  return (
    <>
      {live && (
        <div className="battle-scoreboard" aria-label="Счёт и текущий шаг боя">
          <div className="battle-clock">
            <Swords size={18} aria-hidden="true" />
            <div>
              <strong>
                Бой {b.number} · R{b.table.round}
              </strong>
              <small>
                {s.phase === 'battle'
                  ? `${TABLE_STEPS[b.table.step]} · ${labels[b.table.turn]}`
                  : phases[s.phase]}
              </small>
            </div>
            <div className="round-dots" aria-label={`Раунд ${b.table.round} из 5`}>
              {[1, 2, 3, 4, 5].map((r) => (
                <i
                  key={r}
                  className={r === b.table.round ? 'current' : r < b.table.round ? 'past' : ''}
                />
              ))}
            </div>
          </div>
          <div
            className="battle-vp"
            aria-label={`${labels.deathwatch} ${vp.deathwatch} VP, ${labels.necrons} ${vp.necrons} VP`}
          >
            {SIDES.map((who) => (
              <div key={who} data-side={who}>
                <span>{labels[who]}</span>
                <strong>{vp[who]}</strong>
                <small>VP</small>
              </div>
            ))}
          </div>
          <div className="battle-turn">
            <StatusBadge tone={n.waiting ? 'info' : 'ready'}>
              {s.phase === 'battle' && b.table.step !== 'finished'
                ? `Ход ${labels[b.table.turn]}`
                : n.waiting
                  ? 'Ожидание'
                  : 'Ваше решение'}
            </StatusBadge>
            {b.type === 'PACT' && (
              <small>
                Instability <strong>{b.table.instability}/12</strong> · Keys{' '}
                {b.table.objects.reduce((n, o) => n + o.keys.length, 0)}/6
              </small>
            )}
          </div>
        </div>
      )}
      <section className="panel battle-heading" id="battle-step">
        <div className="section-head">
          <div>
            <p className="eyebrow">
              БОЙ {b.number} ·{' '}
              {b.sector === 'X' ? 'КРИЗИС / ОБЯЗАТЕЛЬНЫЙ КОНТАКТ' : `СЕКТОР ${b.sector}`}
            </p>
            <h2 className="rule-label">
              {MISSION_CARDS[b.mission ?? '']?.title ?? b.mission ?? 'Выбор миссии'}
              {(b.mission || b.type === 'encounter' || b.type === 'WAR' || b.type === 'PACT') && (
                <RuleHelp topic={`mission:${b.mission ?? b.type}`} />
              )}
            </h2>
          </div>
          <StatusBadge tone={n.waiting ? 'info' : 'warning'}>{phases[s.phase]}</StatusBadge>
        </div>
        <p>
          {labels[b.attacker]} → {labels[b.defender]} · {b.type} · AL {b.al}
          {b.type === 'PACT' ? ' / 2 на сторону' : ''}
        </p>
        <ol className="battle-progress" aria-label="Этапы боя">
          {battleProgress(s).map(({ phase, state }) => (
            <li
              key={phase}
              className={state}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              {state === 'past' ? (
                <Check size={13} aria-hidden="true" />
              ) : state === 'skipped' ? (
                <Minus size={13} aria-hidden="true" />
              ) : (
                <Circle size={11} aria-hidden="true" />
              )}
              <span>{phases[phase]}</span>
              {state === 'skipped' && <span className="sr-only"> — пропускается в PACT</span>}
            </li>
          ))}
        </ol>
        <p className="battle-next">
          {n.waiting ? (
            <Clock3 size={15} aria-hidden="true" />
          ) : (
            <Swords size={15} aria-hidden="true" />
          )}
          {n.text}
        </p>
      </section>
    </>
  )
}
