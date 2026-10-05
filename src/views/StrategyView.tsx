import { useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, Flag, LockKeyhole, Route, Zap } from 'lucide-react'
import type { SectorKey } from '../../shared/model'
import { SECTORS, supplied } from '../../shared/rules'
import {
  strategyPreview,
  strategyRoutes,
  type StrategyPreview,
} from '../../shared/strategy-preview'
import { CampaignMap } from './CampaignMap'
import { RuleHelp } from './RulesContext'
import { Check, labels, Options, type Props } from './common'

const methods = [
  ['normal', 'По соседней связи'],
  ['deep', 'Deep Raid'],
  ['hidden', 'Hidden Route'],
  ['airlift', 'Orbital Airlift'],
  ['glass', 'Glass Ambush'],
  ['route', 'Door Route'],
]
const actions = [
  ['recon', 'Recon', 'Разведданные'],
  ['mobilise', 'Mobilise', 'Снабжение сектора'],
  ['fortify', 'Fortify', 'Укрепление сектора'],
  ['repair', 'Repair Network', 'Восстановление сети'],
  ['scavenge', 'Scavenge J', 'Поиск снабжения · D6'],
  ['forced_march', 'Forced March', 'Дополнительный MP'],
  ['sabotage', 'Sabotage', 'Диверсия в выбранной цели'],
  ['siege_recon', 'Siege Recon', 'Подготовка осады'],
  ['investigate', 'Investigate Choir', 'Исследование тайны'],
  ['reorganise', 'Reorganise', 'Назначение отряда'],
  ['doctrine', 'Doctrine Refit', 'Смена Stage Package'],
]

function Projection({
  preview,
  movement = false,
}: {
  preview: StrategyPreview
  movement?: boolean
}) {
  if (!preview.allowed)
    return (
      <div className="strategy-validation" role="status">
        <LockKeyhole size={16} aria-hidden="true" />
        <span>{preview.reason}</span>
      </div>
    )
  const keys = (['actions', 'mp', 'intel', 'supply', 'debt'] as const).filter((key) =>
    movement
      ? ['mp', 'actions', 'intel'].includes(key) || preview.before[key] !== preview.after[key]
      : key === 'actions' ||
        (preview.before[key] !== preview.after[key] &&
          (!preview.random || preview.after[key] < preview.before[key])),
  )
  const names = { actions: 'Actions', mp: 'MP', intel: 'Intel', supply: 'Supply', debt: 'Долг' }
  return (
    <div className="command-projection">
      <small>
        {movement
          ? 'После объявления'
          : preview.random
            ? 'При успешном действии'
            : 'После действия'}
      </small>
      <dl>
        {keys.map((key) => (
          <div key={key}>
            <dt>{names[key]}</dt>
            <dd>
              {preview.before[key]} <ArrowRight size={12} aria-hidden="true" />{' '}
              <strong>{preview.after[key]}</strong>
            </dd>
          </div>
        ))}
      </dl>
      {!movement && preview.random && (
        <small>Результат включает бросок; награда заранее неизвестна.</small>
      )}
    </div>
  )
}

export function StrategyView({ s, side, send }: Props) {
  const p = s.players[side]
  const [packageDraft, setPackageDraft] = useState(p.package),
    [target, setTarget] = useState<SectorKey>('G'),
    [method, setMethod] = useState('normal'),
    [raid, setRaid] = useState(false),
    [action, setAction] = useState('recon'),
    [id, setId] = useState(''),
    [location, setLocation] = useState('garrison')
  const origin = s.activation?.side === side && s.activation.force === 'stf' && p.stf ? p.stf : p.mf
  const ours = s.phase === 'strategy' && s.active === side
  const routes = useMemo(() => strategyRoutes(s, side, method, raid), [s, side, method, raid])
  const move = routes[target]
  const forcePayload = useMemo(
    () => ({
      id,
      location,
      condition: s.sectors[origin].sabotaged ? 'sabotaged' : 'exhausted',
      automatic: false,
      package: packageDraft,
    }),
    [id, location, s, origin, packageDraft],
  )
  const actionPayload = useMemo(() => ({ ...forcePayload, target }), [forcePayload, target])
  const forcePreviews = useMemo(
    () =>
      Object.fromEntries(
        actions
          .filter(([key]) => key !== 'sabotage')
          .map(([key]) => [
            key,
            strategyPreview(s, side, 'action', { ...forcePayload, action: key }),
          ]),
      ),
    [s, side, forcePayload],
  )
  const sabotage = useMemo(
    () => strategyPreview(s, side, 'action', { ...actionPayload, action: 'sabotage' }),
    [s, side, actionPayload],
  )
  const actionPreviews: Record<string, StrategyPreview> = { ...forcePreviews, sabotage }
  const selectedAction = actionPreviews[action] ?? {
    allowed: false as const,
    reason: 'Выберите действие',
  }
  const autoSabotage = useMemo(
    () =>
      strategyPreview(s, side, 'action', { ...actionPayload, action: 'sabotage', automatic: true }),
    [s, side, actionPayload],
  )
  const end = useMemo(() => strategyPreview(s, side, 'end_strategy', {}), [s, side])
  if (s.phase === 'reaction')
    return (
      <section className="panel reaction-card">
        <p className="eyebrow">ОКНО РЕАКЦИИ</p>
        <h2>Sabotage · сектор {s.pendingReaction?.target}</h2>
        <p>Решение принимается до броска.</p>
        {s.pendingReaction?.side !== side ? (
          <>
            <div className="buttons">
              <button
                disabled={p.intel < 1}
                onClick={() => send('counter_sabotage', { counter: true })}
              >
                Counter · 1 Intel
              </button>
              <button
                className="quiet"
                onClick={() => send('counter_sabotage', { counter: false })}
              >
                Пропустить
              </button>
            </div>
            {p.intel < 1 && <small>Для Counter нужен 1 Intel; сейчас {p.intel}.</small>}
          </>
        ) : (
          <p>Другой командир решает, использовать ли Counter-Sabotage.</p>
        )}
      </section>
    )
  return (
    <div className="strategy-workspace">
      <div className="strategy-split">
        <CampaignMap
          s={s}
          side={side}
          selected={target}
          onSelect={setTarget}
          strategy={{ origin, method, routes }}
        />
        <section className="panel strategy-orders" aria-label="Движение и контакт">
          <p className="eyebrow">{ours ? 'ВАША АКТИВАЦИЯ' : 'ОЖИДАНИЕ КОМАНДИРА'}</p>
          <h2>{ours ? 'План операции' : `Ход ${labels[s.active]}`}</h2>
          <div className="force-summary">
            <Flag size={20} aria-hidden="true" />
            <div>
              <strong>
                {s.activation?.side === side && s.activation.force === 'stf'
                  ? 'Strike Task Force'
                  : 'Main Force'}{' '}
                · {origin}
              </strong>
              <small>
                {supplied(s, side, origin) ? 'Supplied' : 'Unsupplied'} · {SECTORS[origin].name}
                <RuleHelp topic="supply" />
              </small>
            </div>
          </div>
          {p.stf && (
            <div className="force-selector" aria-label="Force этой Activation">
              {(['mf', 'stf'] as const).map((force) => {
                const preview = strategyPreview(s, side, 'select_force', { force }),
                  Icon = force === 'mf' ? Flag : Zap
                return (
                  <button
                    key={force}
                    className="quiet"
                    aria-pressed={s.activation?.force === force}
                    disabled={!preview.allowed}
                    title={preview.reason}
                    onClick={() => {
                      if (s.activation?.force !== force) send('select_force', { force })
                    }}
                  >
                    <Icon size={14} aria-hidden="true" />
                    {force === 'mf' ? 'Main Force' : 'STF'}
                  </button>
                )
              })}
              <small>Force выбирается до первого действия.</small>
            </div>
          )}
          <div className="activation-budget">
            <span>
              <strong>{s.activation?.side === side ? s.activation.actions : 0}</strong> Actions
            </span>
            <span>
              <strong>{s.activation?.side === side ? s.activation.mp : 0}</strong> MP
            </span>
            <span>
              <strong>{s.quiet}</strong> / 3 Quiet Pairs
            </span>
          </div>
          <h3>Движение / контакт</h3>
          <Options
            label="Цель"
            value={target}
            change={(value) => {
              if (value in SECTORS) setTarget(value as SectorKey)
            }}
            items={Object.entries(SECTORS).map(([id, meta]) => ({
              id,
              name: `${id} · ${meta.name}`,
            }))}
          />
          <Options
            label="Маршрут"
            value={method}
            change={setMethod}
            items={methods.map(([id, name]) => ({ id, name }))}
          />
          <Check label="Рейд: Sabotaged, возврат в Origin" value={raid} change={setRaid} />
          <div className="route-summary">
            <Route size={18} aria-hidden="true" />
            <div>
              <strong>
                {origin} <ArrowRight size={14} aria-hidden="true" /> {target}
              </strong>
              <small>
                {methods.find(([key]) => key === method)?.[1] ?? 'Выберите маршрут'} ·{' '}
                {s.sectors[target].owner === side
                  ? 'Свой сектор'
                  : s.sectors[target].owner
                    ? 'Вражеский сектор'
                    : 'Нейтральный сектор'}
              </small>
            </div>
          </div>
          <Projection preview={move} movement />
          {move.allowed && (
            <p className="movement-consequence">
              {move.outcome === 'move'
                ? 'Force переходит в выбранный сектор. Стратегический ход продолжается.'
                : move.outcome === 'occupation'
                  ? 'Occupation: сектор займёт ваша Force, затем откроется Logistics.'
                  : move.outcome === 'home'
                    ? 'Осада Home: свободные действия завершатся. Исход зависит от обороны крепости.'
                    : 'Объявляется бой: свободные действия завершатся, цель и маршрут будут зафиксированы.'}
            </p>
          )}
          {move.allowed && method === 'airlift' && s.sectors[target].owner !== side && (
            <small>При входе возможен Exhausted в C: проверка D6 после объявления.</small>
          )}
          <button
            className="movement-submit"
            disabled={!move.allowed}
            onClick={() =>
              send(s.sectors[target].owner === side ? 'move' : 'attack', { target, method, raid })
            }
          >
            {s.sectors[target].owner === side
              ? 'Переместиться'
              : move.allowed && move.outcome === 'occupation'
                ? 'Занять сектор'
                : 'Объявить контакт'}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </section>
      </div>
      <section className="panel strategy-actions" aria-label="Стратегические действия">
        <div className="section-head">
          <div>
            <p className="eyebrow">ДЕЙСТВИЯ FORCE</p>
            <h2 className="rule-label">
              Strategic Action <RuleHelp topic="actions" />
            </h2>
          </div>
          <span className="muted">
            {origin} · {SECTORS[origin].name}
          </span>
        </div>
        <div className="strategic-action-grid">
          {actions.map(([key, name, description]) => {
            const preview = actionPreviews[key],
              Icon = preview.allowed ? CheckCircle2 : LockKeyhole
            return (
              <button
                key={key}
                className={`quiet strategic-action-card${action === key ? ' active-action' : ''}`}
                aria-pressed={action === key}
                onClick={() => setAction(key)}
              >
                <div>
                  <strong>{name}</strong>
                  <Icon size={14} aria-hidden="true" />
                </div>
                <span>{description}</span>
                <small className={preview.allowed ? 'success' : ''}>
                  {preview.allowed ? 'Доступно' : preview.reason}
                </small>
              </button>
            )
          })}
        </div>
        <div className="selected-action-editor">
          <Options
            label="Действие"
            value={action}
            change={setAction}
            items={actions.map(([id, name]) => ({ id, name }))}
          />
          {action === 'sabotage' && (
            <p>
              Цель диверсии:{' '}
              <strong>
                {target} · {SECTORS[target].name}
              </strong>
              . Измените её на карте или в поле «Цель».
            </p>
          )}
          {action === 'doctrine' &&
            s.snapshot.detachments
              .filter((d) => !d.side || d.side === side)
              .map((d) => (
                <Check
                  key={d.id}
                  label={`${d.name} · ${d.dp} DP`}
                  value={packageDraft.includes(d.id)}
                  change={(value) =>
                    setPackageDraft(
                      value ? [...packageDraft, d.id] : packageDraft.filter((key) => key !== d.id),
                    )
                  }
                />
              ))}
          {action === 'reorganise' && (
            <>
              <Options
                label="ID"
                value={id}
                change={setId}
                items={s.units
                  .filter((u) => u.side === side && u.status === 'active')
                  .map((u) => ({ id: u.id, name: u.name }))}
              />
              <Options
                label="Куда"
                value={location}
                change={setLocation}
                items={['field', 'garrison', 'stf'].map((id) => ({ id, name: id }))}
              />
            </>
          )}
          <Projection preview={selectedAction} />
          {action === 'sabotage' && selectedAction.allowed && (
            <p className="movement-consequence">
              После отправки откроется окно Counter-Sabotage. Соперник примет решение до броска.
            </p>
          )}
          <div className="buttons">
            <button
              disabled={!selectedAction.allowed}
              onClick={() => send('action', { ...actionPayload, action })}
            >
              Выполнить
            </button>
            {action === 'sabotage' && (
              <button
                className="quiet"
                disabled={!autoSabotage.allowed}
                title={autoSabotage.reason}
                onClick={() => send('action', { ...actionPayload, action, automatic: true })}
              >
                Автоматический Sabotage
              </button>
            )}
          </div>
          {action === 'sabotage' && (
            <div className="automatic-sabotage">
              <small>Автоматический Sabotage</small>
              <Projection preview={autoSabotage} />
            </div>
          )}
        </div>
      </section>
      <section className="panel strategy-close">
        <div>
          <h3>Завершить стратегический ход</h3>
          <p>Неиспользованные Actions и MP пропадут. Следующий этап — Logistics.</p>
          {!end.allowed && <small>{end.reason}</small>}
        </div>
        <button className="quiet" disabled={!end.allowed} onClick={() => send('end_strategy')}>
          Закончить стратегический ход → Logistics
        </button>
      </section>
    </div>
  )
}
