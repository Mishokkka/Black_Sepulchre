import { CatalogManager, STFManager } from './CampaignExtras'
import { DatasheetView } from './DatasheetView'
import { sameDatasheet } from '../../shared/datasheets'
import { lazy, useState } from 'react'
import { HONOURS, SCARS } from '../../shared/rules.generated'
import {
  ADJACENCY,
  ARMOURY,
  available,
  bonus,
  entry,
  home,
  present,
  RELICS,
  SECTORS,
  STAGES,
  supplied,
} from '../../shared/rules'
import { command, startingArmy } from '../../shared/engine'
import { starterChoices } from '../../shared/starting-catalogue'
import type { SectorKey, Side, State, Unit } from '../../shared/model'
import { labels, phases, type Send } from '../App'
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
const nodes: Record<SectorKey, [number, number]> = {
  A: [50, 8],
  B: [27, 25],
  C: [73, 25],
  D: [17, 43],
  E: [83, 43],
  F: [28, 65],
  G: [50, 50],
  H: [72, 65],
  I: [27, 83],
  J: [73, 83],
  K: [50, 98],
}
export function CampaignMap({ s, side }: { s: State; side: Side }) {
  const [selected, setSelected] = useState<SectorKey>('G'),
    a = s.sectors[selected]
  return (
    <section className="panel map-layout">
      <div>
        <p className="eyebrow">СТРАТЕГИЧЕСКАЯ КАРТА</p>
        <svg
          className="map-svg"
          viewBox="0 0 100 110"
          role="img"
          aria-label="Карта Kharon Secundus"
        >
          {Object.entries(ADJACENCY).flatMap(([a, bs]) =>
            bs
              .filter((b) => a < b)
              .map((b) => (
                <line
                  key={a + b}
                  x1={nodes[a as SectorKey][0]}
                  y1={nodes[a as SectorKey][1]}
                  x2={nodes[b][0]}
                  y2={nodes[b][1]}
                />
              )),
          )}
          {Object.entries(nodes).map(([k, [x, y]]) => (
            <g
              key={k}
              className={`node ${s.sectors[k as SectorKey].owner ?? 'neutral'}`}
              onClick={() => setSelected(k as SectorKey)}
              role="button"
              tabIndex={0}
              aria-label={`Сектор ${k}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setSelected(k as SectorKey)
              }}
            >
              <circle cx={x} cy={y} r={selected === k ? 6 : 5} />
              <text x={x} y={y + 1.6}>
                {k}
              </text>
              {Object.entries(s.players)
                .filter(([, p]) => p.mf === k)
                .map(([side], i) => (
                  <circle
                    key={side}
                    className={'force-dot ' + side}
                    cx={x + 5 + i * 3}
                    cy={y - 5}
                    r="1.8"
                  />
                ))}
            </g>
          ))}
        </svg>
      </div>
      <div className="sector-detail">
        <p className="eyebrow">
          {selected} ·{' '}
          {SECTORS[selected].home ? 'Home' : SECTORS[selected].node ? 'Узел' : 'Обычный сектор'}
        </p>
        <h2>{SECTORS[selected].name}</h2>
        <dl>
          <dt>Владелец</dt>
          <dd>{a.owner ? labels[a.owner] : 'Нейтральный'}</dd>
          <dt>Снабжение</dt>
          <dd>{a.owner && supplied(s, a.owner, selected) ? 'Supplied' : 'Unsupplied'}</dd>
          <dt>Local Supply</dt>
          <dd>
            {a.local} / {Math.ceil((STAGES[s.stage].al * 0.25) / 5) * 5}
          </dd>
          <dt>Состояния</dt>
          <dd>
            {[
              a.fortified && 'Fortified',
              a.ruined && 'Ruined',
              a.exhausted && `Exhausted ${a.exhausted}`,
              a.sabotaged && 'Sabotaged',
              a.disrupted && 'Disrupted',
              a.contested && 'Contested',
              a.relayUntil && 'Relay Disruption',
            ]
              .filter(Boolean)
              .join(', ') || 'Нормальное'}
          </dd>
          <dt>Связи</dt>
          <dd>{ADJACENCY[selected].join(' · ')}</dd>
        </dl>
        <p className="muted">
          Ваш Main Force: {s.players[side].mf}. Снабжение проходит только по своим секторам до{' '}
          {home(side)}.
        </p>
        {s.units
          .filter(
            (u) => u.sector === selected && u.location === 'garrison' && u.status === 'active',
          )
          .map((u) => (
            <p key={u.id}>
              {u.name} · {u.rc} RC · Damage {u.damage}
            </p>
          ))}
      </div>
    </section>
  )
}
export function SetupView({ s, side, send }: Props) {
  const [catalog, setCatalog] = useState(''),
    [search, setSearch] = useState('')
  const rows = s.units.filter(
    (u) => u.side === side && u.location === 'field' && u.status === 'active',
  )
  const choices = starterChoices(s, side)
  const visible = choices.filter((c) =>
    `${c.datasheet} ${c.size} ${c.card?.models.flatMap((g) => g.equipment.map((e) => e.name)).join(' ') ?? ''}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )
  const selected = choices.find((c) => c.id === catalog)
  let armyProblem = '',
    effective = rows.reduce((n, u) => n + u.rc, 0)
  try {
    effective = startingArmy(s, side).effective
  } catch (error) {
    armyProblem = error instanceof Error ? error.message : 'Проверьте состав'
  }
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">ПОДГОТОВКА КАМПАНИИ</p>
          <h2>Подготовьте стартовую армию</h2>
          <p>
            Играем по правилам 2.2.1 и текущим ценам сайта. Они уже приняты для вашей дружеской
            кампании. Выберите стартовый состав и detachment, затем отметьте готовность.
          </p>
        </div>
        <div className="hero-stats">
          {Object.keys(labels).map((who) => (
            <span key={who}>
              {labels[who as Side]}:{' '}
              {s.setupApproved.includes(who as Side) ? 'армия готова' : 'готовит армию'}
            </span>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Ваш бесплатный старт</h2>
        <p>
          470–500 Effective. Нужен CHARACTER во главе армии. Один отряд — не дороже 200 RC; максимум
          две копии Battleline и одна остальных datasheet.
        </p>
        <Options
          label="Стартовый detachment"
          value={s.players[side].package[0] ?? ''}
          change={(id) => {
            if (id) void send('setup_package', { package: [id] })
          }}
          items={s.snapshot.detachments
            .filter((d) => !d.side || d.side === side)
            .map((d) => ({ id: d.id, name: `${d.name} · ${d.dp} DP` }))}
        />
        <small>
          На старте выбирается один detachment любой стоимости DP. Его правила применяются в битвах
          за столом.
        </small>
        {rows.map((u) => (
          <div className="unit-row" key={u.id}>
            <div>
              <strong>{u.name}</strong>
              <small>
                {entry(s, u).datasheet} · {entry(s, u).size} · {u.rc} RC
              </small>
              <Options
                label={`Заменить вариант: ${u.name}`}
                value={u.catalogId}
                change={(id) => {
                  if (id) void send('setup_unit', { id: u.id, catalogId: id })
                }}
                items={s.snapshot.catalog
                  .filter(
                    (c) =>
                      c.side === side &&
                      sameDatasheet(c.datasheet, entry(s, u).datasheet) &&
                      !c.epic &&
                      !c.keywords.includes('TITANIC') &&
                      c.rc <= 200,
                  )
                  .map((c) => ({ id: c.id, name: `${c.size} · ${c.rc} RC` }))}
              />
            </div>
            <button
              className="quiet"
              onClick={() => send('setup_unit', { id: u.id, remove: true })}
            >
              Убрать из старта
            </button>
          </div>
        ))}
        <p>
          Всего: <strong>{effective} Effective / 500</strong>
        </p>
        {armyProblem ? (
          <p className="notice">{armyProblem}</p>
        ) : (
          <p className="success">Стартовая армия подходит по правилам кампании.</p>
        )}
        <h3>Добавить другой отряд</h3>
        <label>
          Поиск юнита или оружия
          <input
            aria-label="Поиск юнита или оружия"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Например: Lychguard, Captain, plasma…"
          />
        </label>
        <small>
          {visible.length} вариантов для добавления. Большие отряды и Epic Heroes доступны позже во
          вкладке «Каталог».
        </small>
        <Options
          label="Добавить вариант из каталога"
          value={visible.some((c) => c.id === catalog) ? catalog : ''}
          change={setCatalog}
          items={visible.map((c) => ({
            id: c.id,
            name: `${c.datasheet} · ${c.size} · ${c.rc} RC`,
          }))}
        />
        <button
          className="quiet"
          disabled={!selected || !visible.some((c) => c.id === catalog)}
          onClick={() =>
            send('setup_add', {
              catalogId: catalog,
              name: selected!.datasheet,
            })
          }
        >
          Добавить в старт
        </button>
        {selected && (
          <details className="choice">
            <summary>Состав и вооружение выбранного варианта</summary>
            <DatasheetView card={selected.card} />
          </details>
        )}
        <button disabled={s.setupApproved.includes(side)} onClick={() => send('ready_army')}>
          {s.setupApproved.includes(side) ? 'Армия готова · ждём второго игрока' : 'Армия готова'}
        </button>
      </section>
    </>
  )
}
export function StrategyView({ s, side, send }: Props) {
  const [packageDraft, setPackageDraft] = useState(s.players[side].package),
    [target, setTarget] = useState<SectorKey>('G'),
    [method, setMethod] = useState('normal'),
    [raid, setRaid] = useState(false),
    [action, setAction] = useState('recon'),
    [id, setId] = useState(''),
    [location, setLocation] = useState('garrison')
  const ours = s.phase === 'strategy' && s.active === side,
    simulate = (type: string, payload: Record<string, unknown>) => {
      try {
        command(s, { type, payload }, { actor: side, dice: () => 1, id: () => 'preview' })
        return ''
      } catch (e) {
        return (e as Error).message
      }
    }
  const moveError = simulate(s.sectors[target].owner === side ? 'move' : 'attack', {
      target,
      method,
      raid,
    }),
    actionPayload = {
      action,
      target,
      id,
      location,
      condition: s.sectors[s.players[side].mf].sabotaged ? 'sabotaged' : 'exhausted',
      automatic: false,
      package: packageDraft,
    },
    actionError = simulate('action', actionPayload)
  if (s.phase === 'reaction')
    return (
      <section className="panel">
        <h2>Sabotage: ответ</h2>
        <p>Цель {s.pendingReaction?.target}. Ответ до броска.</p>
        {s.pendingReaction?.side !== side ? (
          <div className="buttons">
            <button
              disabled={s.players[side].intel < 1}
              onClick={() => send('counter_sabotage', { counter: true })}
            >
              Counter · 1 Intel
            </button>
            <button className="quiet" onClick={() => send('counter_sabotage', { counter: false })}>
              Пропустить
            </button>
          </div>
        ) : (
          <p>Ожидается противник.</p>
        )}
      </section>
    )
  return (
    <>
      <CampaignMap s={s} side={side} />
      <section className="panel">
        <h2>{ours ? 'Ваш ход' : `Ожидание ${labels[s.active]}`}</h2>
        {s.players[side].stf && (
          <Options
            label="Force этой Activation"
            value={s.activation?.force ?? 'mf'}
            change={(force) => send('select_force', { force })}
            items={[
              { id: 'mf', name: 'Main Force' },
              { id: 'stf', name: 'Strike Task Force' },
            ]}
          />
        )}
        <p>
          {s.activation?.actions ?? 0} Actions · {s.activation?.mp ?? 0} MP · {s.quiet} Quiet Pairs
          / 3
        </p>
        <div className="columns">
          <div>
            <h3>Движение / контакт</h3>
            <Options
              label="Цель"
              value={target}
              change={(v) => setTarget(v as SectorKey)}
              items={Object.entries(SECTORS).map(([id, m]) => ({ id, name: `${id} · ${m.name}` }))}
            />
            <Options
              label="Маршрут"
              value={method}
              change={setMethod}
              items={[
                ['normal', 'По соседней связи'],
                ['deep', 'Deep Raid · 2 Intel'],
                ['hidden', 'Hidden Route · 1 Intel'],
                ['airlift', 'Orbital Airlift'],
                ['glass', 'Glass Ambush'],
                ['route', 'Door Route'],
              ].map(([id, name]) => ({ id, name }))}
            />
            <Check label="Рейд: Sabotaged, возврат в Origin" value={raid} change={setRaid} />
            <p className="muted">
              {moveError || 'Цель legal. После объявления сменить её нельзя.'}
            </p>
            <button
              disabled={!ours || !!moveError}
              onClick={() =>
                send(s.sectors[target].owner === side ? 'move' : 'attack', { target, method, raid })
              }
            >
              {s.sectors[target].owner === side ? 'Переместиться' : 'Объявить контакт'}
            </button>
          </div>
          <div>
            <h3>Strategic Action</h3>
            <Options
              label="Действие"
              value={action}
              change={setAction}
              items={[
                ['recon', 'Recon'],
                ['mobilise', 'Mobilise'],
                ['fortify', 'Fortify'],
                ['repair', 'Repair Network'],
                ['scavenge', 'Scavenge J'],
                ['forced_march', 'Forced March'],
                ['sabotage', 'Sabotage цели'],
                ['siege_recon', 'Siege Recon'],
                ['investigate', 'Investigate Choir'],
                ['reorganise', 'Reorganise'],
                ['doctrine', 'Doctrine Refit'],
              ].map(([id, name]) => ({ id, name }))}
            />
            {action === 'doctrine' &&
              s.snapshot.detachments
                .filter((d) => !d.side || d.side === side)
                .map((d) => (
                  <Check
                    key={d.id}
                    label={`${d.name} · ${d.dp} DP`}
                    value={packageDraft.includes(d.id)}
                    change={(v) =>
                      setPackageDraft(
                        v ? [...packageDraft, d.id] : packageDraft.filter((id) => id !== d.id),
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
            <p className="muted">{actionError || 'Действие доступно.'}</p>
            <button disabled={!ours || !!actionError} onClick={() => send('action', actionPayload)}>
              Выполнить
            </button>
            {action === 'sabotage' && (
              <button
                className="quiet"
                disabled={!ours}
                onClick={() => send('action', { ...actionPayload, automatic: true })}
              >
                Автоматически · 2 Intel + Static
              </button>
            )}
          </div>
        </div>
        <hr />
        <button className="quiet" disabled={!ours} onClick={() => send('end_strategy')}>
          Закончить стратегический ход → Logistics
        </button>
      </section>
    </>
  )
}
export function RosterView({ s, side, send }: Props) {
  const [opponent, setOpponent] = useState(false),
    who = opponent ? (side === 'deathwatch' ? 'necrons' : 'deathwatch') : side,
    units = s.units.filter(
      (u) => u.side === who && !['lost', 'archived', 'sealed'].includes(u.status),
    )
  return (
    <section className="panel">
      <div className="section-head">
        <h2>{labels[who]} · постоянные ID</h2>
        <button className="quiet" onClick={() => setOpponent(!opponent)}>
          {opponent ? 'Своя армия' : 'Армия противника'}
        </button>
      </div>
      <p>
        Field cap {units.filter((u) => u.location === 'field').reduce((n, u) => n + u.rc, 0)} /{' '}
        {STAGES[s.stage].cap} RC. CR рассчитывается для активного состава и Attached формаций.
      </p>
      {units.map((u) => (
        <details className="unit-card" key={u.id}>
          <summary>
            <span>
              <strong>{u.name}</strong>
              <small>
                {entry(s, u).datasheet} ·{' '}
                {u.location === 'garrison' ? `Garrison ${u.sector}` : u.location.toUpperCase()}{' '}
                {u.flags.commission ? '· Commission' : ''}
              </small>
            </span>
            <span>
              {u.rc} RC · {u.xp} XP · <b className={`damage d${u.damage}`}>Damage {u.damage}</b>
            </span>
          </summary>
          <p>
            ID: <code>{u.id}</code>
          </p>
          <p>
            {available(s, u)
              ? 'Available'
              : `Unavailable · ${u.status}${u.evacDebt ? ` · Evac ${u.evacDebt}` : ''}${u.flags.outOfAction ? ' · Out of Action' : ''}${u.trauma ? ' · Trauma Lock' : ''}`}
          </p>
          <DatasheetView card={entry(s, u).card} />
          {u.honours.map((id) => {
            const h = HONOURS.find((h) => h.id === id)!
            return (
              <p key={id}>
                <strong>
                  {h.name} · {h.tier} {h.formation ? '· формация' : ''}
                </strong>{' '}
                — {h.effect}
              </p>
            )
          })}
          {u.scars.map((sc) => {
            const def = SCARS[u.side].find((s) => s.id === sc.id)!
            return (
              <p key={sc.id}>
                <strong>Scar {def.name}</strong> — {def.effect}{' '}
                {sc.progress ? '· Rehab Progress' : ''}
              </p>
            )
          })}
          <p>
            Armoury: {u.armoury ? ARMOURY[u.armoury].name : '—'} · Relic:{' '}
            {u.relic ? RELICS[u.relic].name : '—'}
          </p>
          {!opponent && s.phase === 'logistics' && (
            <UnitService s={s} side={side} send={send} u={u} />
          )}
        </details>
      ))}
    </section>
  )
}
function UnitService({ s, side, send, u }: Props & { u: Unit }) {
  const [honour, setHonour] = useState(''),
    [item, setItem] = useState(''),
    [relic, setRelic] = useState(''),
    [scar, setScar] = useState(String(u.scars[0]?.id ?? '')),
    [recipient, setRecipient] = useState(''),
    [refitKind, setRefitKind] = useState('size'),
    [deed, setDeed] = useState('HOLD')
  const p = s.players[side],
    serviceAt = u.location === 'stf' ? p.stf : p.mf,
    here = !!serviceAt && present(s, u) === serviceAt && s.sectors[serviceAt].owner === side,
    legal =
      s.phase === 'logistics' &&
      (s.activation?.logistics.includes(side) || s.battle?.logistics.includes(side))
  return (
    <fieldset disabled={!here || !legal}>
      <p className="muted">
        {here
          ? u.location === 'stf'
            ? 'Обслуживание при STF. Armoury и Relics доступны при Main Force.'
            : 'Обслуживание при Main Force'
          : 'Для обслуживания своя Force должна быть в секторе ID.'}
      </p>
      <div className="buttons">
        <button
          disabled={!u.damage || !!u.flags.paidWindow}
          onClick={() => send('recover', { id: u.id })}
        >
          Recovery
        </button>
        <button
          disabled={!u.damage || !u.flags.paidWindow || !!u.flags.overhaulWindow}
          onClick={() => send('recover', { id: u.id, overhaul: true })}
        >
          Overhaul
        </button>
        <button
          className="quiet"
          disabled={!u.damage || (!p.inventory.includes('cache') && u.armoury !== 'cache')}
          onClick={() => send('recover', { id: u.id, cache: true })}
        >
          Recovery с Cache
        </button>
        {u.flags.commission && (
          <button onClick={() => send('commission_buyout', { id: u.id })}>Выкупить · {u.rc}</button>
        )}
        {u.evacDebt > 0 && (
          <button onClick={() => send('pay_evac', { id: u.id })}>Evacuation · {u.evacDebt}</button>
        )}
        {u.flags.ammunitionDue && (
          <>
            <button onClick={() => send('ammunition_choice', { id: u.id, pay: true })}>
              Ammunition · 5 Supply
            </button>
            <button
              className="quiet"
              onClick={() => send('ammunition_choice', { id: u.id, pay: false })}
            >
              Принять штраф
            </button>
          </>
        )}
      </div>
      <div className="form-grid">
        <div>
          <Options
            label="Honour в свободный слот"
            value={honour}
            change={setHonour}
            items={HONOURS.filter(
              (h) => (!h.side || h.side === side) && !u.honours.includes(h.id),
            ).map((h) => ({ id: h.id, name: `${h.name} · ${h.tier}${h.formation ? ' Ф' : ''}` }))}
          />
          <button
            className="quiet"
            disabled={!honour}
            onClick={() => send('claim_honour', { id: u.id, honour })}
          >
            Выбрать Honour
          </button>
        </div>
        <div>
          <Options
            label="Armoury"
            value={item}
            change={setItem}
            items={Object.entries(ARMOURY).map(([id, a]) => ({
              id,
              name: `${a.name} · ${a.cost}`,
            }))}
          />
          <button
            className="quiet"
            disabled={!item || !!u.armoury}
            onClick={() => send('buy_armoury', { id: u.id, item })}
          >
            Купить
          </button>
          {p.inventory.includes(item) && (
            <button className="quiet" onClick={() => send('assign_armoury', { id: u.id, item })}>
              Из inventory
            </button>
          )}
          {u.armoury && (
            <button className="quiet" onClick={() => send('discard_armoury', { id: u.id })}>
              Отказаться от предмета
            </button>
          )}
        </div>
        {u.scars.length > 0 && (
          <div>
            <Options
              label="Scar для Rehabilitation"
              value={scar}
              change={setScar}
              items={u.scars.map((sc) => ({
                id: String(sc.id),
                name: SCARS[side].find((c) => c.id === sc.id)!.name,
              }))}
            />
            <div className="buttons">
              <button
                className="quiet"
                disabled={!!u.flags.rehabWindow}
                onClick={() => send('rehabilitate', { id: u.id, scar: Number(scar) })}
              >
                Rehab · D6 3+
              </button>
              <button
                className="quiet"
                disabled={!!u.flags.rehabWindow}
                onClick={() => send('rehabilitate', { id: u.id, scar: Number(scar), deep: true })}
              >
                Deep
              </button>
            </div>
          </div>
        )}
        {p.relics.length > 0 && (
          <div>
            <Options
              label="Relic со склада"
              value={relic}
              change={setRelic}
              items={p.relics.map((id, i) => ({ id, name: `${RELICS[id].name} (${i + 1})` }))}
            />
            <button
              className="quiet"
              disabled={!relic}
              onClick={() => send('assign_relic', { id: u.id, item: relic })}
            >
              Назначить
            </button>
          </div>
        )}
      </div>
      {u.retiredCatalog && (
        <div className="notice">
          <p>Datasheet убран из каталога. ID и XP сохранены.</p>
          <Options
            label="Successor той же роли"
            value=""
            change={(catalogId) => send('resolve_retired', { id: u.id, catalogId })}
            items={s.snapshot.catalog
              .filter(
                (c) =>
                  c.side === side &&
                  c.character === u.retiredCatalog!.character &&
                  c.garrison === u.retiredCatalog!.garrison,
              )
              .map((c) => ({ id: c.id, name: `${c.datasheet} · ${c.rc} RC` }))}
          />
          <button
            className="quiet"
            onClick={() => send('resolve_retired', { id: u.id, archive: true })}
          >
            Архивировать · {u.flags.commission ? 0 : u.rc} Supply
          </button>
        </div>
      )}
      <details>
        <summary>Размер, Refit и архивирование</summary>
        <Options
          label="Изменение состава"
          value={refitKind}
          change={setRefitKind}
          items={[
            { id: 'size', name: 'Изменить размер' },
            { id: 'loadout', name: 'Refit loadout' },
          ]}
        />
        <Options
          label="Вариант того же datasheet"
          value=""
          change={(catalogId) => send('refit', { id: u.id, catalogId, kind: refitKind })}
          items={s.snapshot.catalog
            .filter(
              (c) =>
                c.side === side &&
                sameDatasheet(c.datasheet, entry(s, u).datasheet) &&
                c.id !== u.catalogId &&
                (refitKind === 'size'
                  ? c.models !== entry(s, u).models
                  : c.models === entry(s, u).models),
            )
            .map((c) => ({ id: c.id, name: `${c.size} · ${c.rc} RC` }))}
        />
        <Options
          label="Deed of the Stage до первого боя"
          value={deed}
          change={setDeed}
          items={['HOLD', 'EXTRACT', 'OPERATE'].map((id) => ({ id, name: id }))}
        />
        <button className="quiet" onClick={() => send('stage_deed', { id: u.id, deed })}>
          Закрепить Deed Stage
        </button>
        {u.relic && (
          <>
            <Options
              label="Передать Relic местному ID"
              value={recipient}
              change={setRecipient}
              items={s.units
                .filter(
                  (v) => v.side === side && v.status === 'active' && v.id !== u.id && !v.relic,
                )
                .map((v) => ({ id: v.id, name: v.name }))}
            />
            <button
              className="quiet"
              disabled={!recipient}
              onClick={() => send('transfer_relic', { from: u.id, to: recipient })}
            >
              Передать · 10 Supply
            </button>
          </>
        )}
        {Object.entries(p.enhancements)
          .filter(([, id]) => id === u.id)
          .map(([id]) => (
            <Options
              key={id}
              label={`Передать Enhancement ${s.snapshot.enhancements.find((e) => e.id === id)?.name}`}
              value=""
              change={(to) => send('transfer_enhancement', { enhancement: id, to })}
              items={s.units
                .filter(
                  (v) =>
                    v.side === side &&
                    v.id !== u.id &&
                    v.status === 'active' &&
                    entry(s, v).character,
                )
                .map((v) => ({ id: v.id, name: v.name }))}
            />
          ))}
        <button className="danger" onClick={() => send('disband', { id: u.id })}>
          Disband ID с положенным возвратом
        </button>
      </details>
    </fieldset>
  )
}
export function LogisticsView({ s, side, send }: Props) {
  const [catalog, setCatalog] = useState(''),
    [name, setName] = useState(''),
    [sector, setSector] = useState(s.players[side].mf),
    [location, setLocation] = useState('field'),
    [local, setLocal] = useState(0),
    [drill, setDrill] = useState<string[]>([])
  const ours =
      s.phase === 'logistics' &&
      (s.activation?.logistics.includes(side) || s.battle?.logistics.includes(side)),
    p = s.players[side],
    cat = s.snapshot.catalog.find((c) => c.id === catalog)
  return (
    <>
      <section className="panel">
        <h2>Logistics · {labels[side]}</h2>
        <p>
          {ours
            ? 'Покупки и восстановление доступны до завершения этой Logistics.'
            : `Текущий этап: ${phases[s.phase]}.`}
        </p>
        <fieldset disabled={!ours}>
          <div className="columns">
            <div>
              <h3>Новая запись</h3>
              <Options
                label="Каталог юнитов"
                value={catalog}
                change={setCatalog}
                items={s.snapshot.catalog
                  .filter((c) => c.side === side)
                  .map((c) => ({ id: c.id, name: `${c.datasheet} · ${c.size} · ${c.rc} RC` }))}
              />
              <label>
                Имя ID
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={cat?.datasheet}
                />
              </label>
              <Options
                label="Назначение"
                value={location}
                change={setLocation}
                items={['field', 'garrison', ...(p.stf ? ['stf'] : [])].map((id) => ({
                  id,
                  name: id,
                }))}
              />
              <Options
                label="Сектор"
                value={sector}
                change={(v) => setSector(v as SectorKey)}
                items={Object.values(s.sectors)
                  .filter((a) => a.owner === side)
                  .map((a) => ({ id: a.key, name: `${a.key} · Local ${a.local}` }))}
              />
              <label>
                Из Local Supply
                <input
                  type="number"
                  min="0"
                  max={s.sectors[sector].local}
                  step="5"
                  value={local}
                  onChange={(e) => setLocal(Number(e.target.value))}
                />
              </label>
              <p className="muted">
                Любая доля Local создаёт Commission. Удалённо — один Core в Window, полностью за
                Local.
              </p>
              <button
                disabled={!catalog}
                onClick={() =>
                  send('buy_unit', {
                    catalogId: catalog,
                    name: name || cat!.datasheet,
                    location,
                    sector,
                    local,
                  })
                }
              >
                Купить ID
              </button>
            </div>
            <div>
              <h3>Stage Package</h3>
              {s.snapshot.detachments
                .filter((d) => !d.side || d.side === side)
                .map((d) => (
                  <Check
                    key={d.id}
                    label={`${d.name} · ${d.dp} DP`}
                    value={p.package.includes(d.id)}
                    change={(v) =>
                      send('package', {
                        package: v ? [...p.package, d.id] : p.package.filter((id) => id !== d.id),
                      })
                    }
                  />
                ))}
              <h3>Veteran Drill · 30 Supply</h3>
              {s.units
                .filter((u) => u.side === side && u.status === 'active' && present(s, u) === p.mf)
                .map((u) => (
                  <Check
                    key={u.id}
                    label={u.name}
                    value={drill.includes(u.id)}
                    change={(v) =>
                      setDrill(v ? [...drill, u.id] : drill.filter((id) => id !== u.id))
                    }
                  />
                ))}
              <button
                className="quiet"
                disabled={!drill.length || drill.length > 2}
                onClick={() => send('drill', { ids: drill })}
              >
                +1 XP до двух ID
              </button>
              <h3>Consumable inventory</h3>
              <p>{p.inventory.map((i) => ARMOURY[i]?.name ?? i).join(', ') || 'Пусто'}</p>
              <div className="buttons">
                {['medicae', 'cache'].map((item) => (
                  <button
                    className="quiet"
                    key={item}
                    onClick={() => send('buy_armoury', { item })}
                  >
                    {ARMOURY[item].name} · {ARMOURY[item].cost}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <hr />
          <button onClick={() => send('end_logistics')}>Завершить свою Logistics</button>
        </fieldset>
      </section>
      <STFManager s={s} side={side} send={send} />
      <CatalogManager s={s} side={side} send={send} />
      <RosterView s={s} side={side} send={send} />
    </>
  )
}
export const ReferenceView = lazy(() => import('./ReferenceView'))
