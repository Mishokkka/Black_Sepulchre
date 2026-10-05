import { ArrowRight, Flag, Radio, Shield, Users } from 'lucide-react'
import type { Side, State } from '../../shared/model'
import { campaignOverview } from '../../shared/chronicle'
import { historySummary } from '../../shared/history'
import { nextStep } from '../../shared/next-step'
import { SECTORS, STAGES } from '../../shared/rules'
import { CampaignMap } from './CampaignMap'
import { ChronicleCard } from './ChronicleCard'
import { StatusBadge } from './StatusBadge'
import { labels, phases } from './common'
import { RuleHelp } from './RulesContext'

export function OverviewView({
  s,
  side,
  navigate,
  openHistory,
}: {
  s: State
  side: Side
  navigate: (tab: string) => void
  openHistory: (battle?: string) => void
}) {
  const p = s.players[side],
    view = campaignOverview(s, side),
    step = nextStep(s, side),
    budget = view.budgets.field
  return (
    <div className="campaign-dashboard">
      <section className="dashboard-heading">
        <div>
          <p className="eyebrow">ШТАБ КАМПАНИИ · ЭТАП {s.stage + 1}</p>
          <h2>{phases[s.phase]}</h2>
          <p>
            {s.phase === 'terminal'
              ? s.winner === 'both_win'
                ? 'CONCORDAT · общая победа'
                : s.winner === 'both_lose'
                  ? 'Общее поражение'
                  : s.winner
                    ? `Победа ${labels[s.winner]}`
                    : 'Итог не определён'
              : s.phase === 'strategy'
                ? `Действует ${labels[s.active]} · ${s.activation?.actions ?? 0} Actions · ${s.activation?.mp ?? 0} MP`
                : step.text}
          </p>
        </div>
        <div className="dashboard-progress">
          <strong>
            {s.battles}
            <small> / 18</small>
          </strong>
          <span>Боёв завершено</span>
          <progress value={s.battles} max={18} aria-label="Завершённые бои кампании" />
        </div>
      </section>
      <div className="dashboard-front">
        <section className="panel dashboard-warfront" aria-labelledby="warfront-title">
          <div className="section-head">
            <div>
              <p className="eyebrow">ФРОНТ</p>
              <h3 id="warfront-title">Kharon Secundus</h3>
            </div>
            <Flag size={21} aria-hidden="true" />
          </div>
          <div className="territory-counts" aria-label="Контроль секторов">
            {view.territory.map((t) => (
              <div className={t.side} key={t.side}>
                <strong>{t.count}</strong>
                <span>{labels[t.side]}</span>
              </div>
            ))}
            <div>
              <strong>{view.neutral}</strong>
              <span>Нейтральные</span>
            </div>
          </div>
          <CampaignMap s={s} side={side} compact initialSelected={p.mf} />
          <button className="quiet" onClick={() => navigate('strategy')}>
            Открыть стратегию <ArrowRight size={15} aria-hidden="true" />
          </button>
        </section>
        <div className="dashboard-side">
          <section className="panel dashboard-force" aria-labelledby="force-title">
            <div className="section-head">
              <div>
                <p className="eyebrow">ВАШИ СИЛЫ</p>
                <h3 id="force-title">Main Force · {p.mf}</h3>
              </div>
              <Users size={21} aria-hidden="true" />
            </div>
            <p className="muted">{SECTORS[p.mf].name}</p>
            <StatusBadge tone={view.supplied ? 'ready' : 'warning'}>
              {view.supplied ? 'Supplied · линия до Home' : 'Unsupplied · линия прервана'}
            </StatusBadge>
            <div className={`dashboard-cap${budget.used > budget.cap ? ' over-budget' : ''}`}>
              <span>Field RC · постоянный roster</span>
              <strong>
                {budget.used}
                <small> / {budget.cap}</small>
              </strong>
              <progress
                value={Math.min(budget.used, budget.cap)}
                max={budget.cap}
                aria-label="Постоянный roster Field"
              />
              <small>
                {budget.used > budget.cap
                  ? `Превышение ${budget.used - budget.cap} RC`
                  : `Свободно ${budget.cap - budget.used} RC`}{' '}
                · AL боя {STAGES[s.stage].al}
              </small>
            </div>
            <dl className="dashboard-facts">
              <dt>Доступны в Field</dt>
              <dd>
                {view.availableField} / {view.field}
              </dd>
              <dt>Недоступны в Field</dt>
              <dd>{view.unavailableField}</dd>
              <dt>Требуют внимания</dt>
              <dd>{view.attention}</dd>
              <dt>Гарнизоны</dt>
              <dd>
                {view.budgets.garrison.units} ID · {view.budgets.garrison.rc} RC
              </dd>
              {p.stf && (
                <>
                  <dt>STF · {p.stf}</dt>
                  <dd>
                    {view.budgets.stf.used} / {view.budgets.stf.cap} RC
                  </dd>
                </>
              )}
            </dl>
            <small className="muted">
              Доступность ID учитывает Damage, долги, Commission и ограничения состояния.
              Легальность состава проверяется в Muster.
            </small>
            <div className="buttons">
              <button className="quiet" onClick={() => navigate('roster')}>
                Открыть армию
              </button>
              {view.attention > 0 && (
                <button className="quiet" onClick={() => navigate('logistics')}>
                  Проверить снабжение
                </button>
              )}
            </div>
          </section>
          <section className="panel dashboard-pressure" aria-labelledby="pressure-title">
            <div className="section-head">
              <div>
                <p className="eyebrow">ДАВЛЕНИЕ КАМПАНИИ</p>
                <h3 id="pressure-title">Под чёрным хором</h3>
              </div>
              <Radio size={21} aria-hidden="true" />
            </div>
            <div className="pressure-tracks">
              {[
                {
                  name: 'Black Choir',
                  value: s.choir,
                  max: 8,
                  note:
                    s.choir >= 8
                      ? 'Трек раскрыт полностью'
                      : `Следующий порог: ${[2, 4, 8].find((n) => n > s.choir)}`,
                },
                {
                  name: 'Home Integrity',
                  value: p.integrity,
                  max: 2,
                  note: `Home · ${side === 'deathwatch' ? 'A' : 'K'}`,
                },
                {
                  name: 'Fragments',
                  value: p.fragments,
                  max: 3,
                  note: p.prepared ? 'Prepared Anchor' : 'Anchor не подготовлен',
                },
                {
                  name: 'Contact Clock',
                  value: s.quiet,
                  max: 3,
                  note: 'Quiet Pairs · пары активаций без боя',
                },
              ].map((t) => (
                <div key={t.name}>
                  <div>
                    <span className="rule-label">
                      {t.name}
                      {t.name !== 'Contact Clock' && (
                        <RuleHelp
                          topic={t.name === 'Home Integrity' ? 'siege' : 'choir'}
                          label={t.name}
                        />
                      )}
                    </span>
                    <strong>
                      {t.value}
                      <small> / {t.max}</small>
                    </strong>
                  </div>
                  <progress value={Math.min(t.value, t.max)} max={t.max} aria-label={t.name} />
                  <small>{t.note}</small>
                </div>
              ))}
            </div>
            {p.debt > 0 && <p className="dashboard-warning">Долг кампании · {p.debt} Supply</p>}
            <button className="quiet" onClick={() => navigate('rules')}>
              Открыть свод правил
            </button>
          </section>
        </div>
      </div>
      <div className="dashboard-recent">
        <section className="panel dashboard-consequences" aria-labelledby="consequences-title">
          <p className="eyebrow">ПОСЛЕДНИЕ ПОСЛЕДСТВИЯ</p>
          <h3 id="consequences-title">После боя</h3>
          {view.lastBattle ? (
            <ChronicleCard
              group={view.lastBattle}
              compact
              onOpen={() => openHistory(view.lastBattle!.id)}
            />
          ) : (
            <div className="archive-empty">
              <Shield size={28} aria-hidden="true" />
              <p>Первый завершённый бой начнёт летопись.</p>
              <small>Здесь появятся итог, D66, потери и записанные изменения ресурсов.</small>
              {s.battle && (
                <button className="quiet" onClick={() => navigate('battle')}>
                  Открыть текущий бой
                </button>
              )}
            </div>
          )}
        </section>
        <section className="panel dashboard-activity" aria-labelledby="activity-title">
          <div className="section-head">
            <div>
              <p className="eyebrow">ПОСЛЕДНИЕ РЕШЕНИЯ</p>
              <h3 id="activity-title">Журнал командования</h3>
            </div>
            <span className="muted">{s.log.length} записей</span>
          </div>
          {view.activity.length ? (
            <ol>
              {view.activity.map((l) => (
                <li key={l.version}>
                  <span className="activity-version">#{l.version}</span>
                  <div>
                    <strong>{historySummary(l)}</strong>
                    <small>
                      {labels[l.actor]}
                      {l.battle ? ` · Бой ${l.battle.number}` : ' · Между боями'}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="archive-empty">
              <p>Решения ещё не записаны.</p>
              <small>Лента пополнится после первой команды.</small>
            </div>
          )}
          <button className="quiet" onClick={() => openHistory()}>
            Вся история <ArrowRight size={15} aria-hidden="true" />
          </button>
        </section>
      </div>
    </div>
  )
}
