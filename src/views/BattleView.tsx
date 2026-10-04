import { BattlePacket } from './BattlePacket'
import { TableExtras, MissionFacts } from './TableExtras'
import { useState } from 'react'
import Markdown from 'react-markdown'
import { EVENTS, MISSION_CARDS, CRISIS_CARDS } from '../../shared/rules.generated'
import {
  SIDES,
  other,
  type Muster,
  type Pick,
  type Report,
  type Side,
  type State,
  type UnitResult,
} from '../../shared/model'
import {
  ARMOURY,
  available,
  BREACH,
  DEFENSIVE,
  entry,
  RELICS,
  TACTICAL,
  unit,
  STAGES,
} from '../../shared/rules'
import { actionsFor } from '../../shared/table'
import { underdog, validateMuster } from '../../shared/muster'
import { labels, phases, type Send } from '../App'
import { Check, Options, type Props } from './CampaignViews'
const ASSET_LABELS: Record<string, string> = {
  barricades: 'Barricades',
  smoke: 'Smoke Screen',
  coordinates: 'Emergency Coordinates',
  reserves: 'Field Reserves',
  booby: 'Booby-trapped Objective',
  evacuation: 'Hard Evacuation',
  mines: 'Mine Corridor',
  beacon: 'Reserve Beacon',
  stores: 'Hardened Stores',
  suppression: 'Suppression',
  charge: 'Breach Charge',
  infiltration: 'Infiltration Route',
  extraction: 'Extraction Beacon',
}
export function BattleView({ s, side, send }: Props) {
  const [editingResult, setEditingResult] = useState(false)
  const b = s.battle
  if (s.phase === 'finale_mode')
    return (
      <section className="hero">
        <div>
          <p className="eyebrow">ПОСЛЕДНИЙ ТАКТ</p>
          <h2>Две подписи или один шаблон</h2>
          <p>
            Два PACT открывают кооператив. Любой WAR — бой друг с другом. Выбор закрыт до решения
            второго игрока.
          </p>
          <div className="buttons">
            <button
              disabled={!!s.finalModes[side]}
              onClick={() => send('finale_mode', { mode: 'PACT' })}
            >
              PACT · вместе остановить машину
            </button>
            <button
              className="danger"
              disabled={!!s.finalModes[side]}
              onClick={() => send('finale_mode', { mode: 'WAR' })}
            >
              WAR · присвоить машину
            </button>
          </div>
          <p>{s.finalModes[side] ? 'Ваш выбор сохранён.' : 'Выберите режим.'}</p>
        </div>
      </section>
    )
  if (s.phase === 'terminal')
    return (
      <section className="panel">
        <h2>
          {s.winner === 'both_win'
            ? 'CONCORDAT'
            : s.winner === 'both_lose'
              ? 'Планета стала записью войны'
              : `Победа ${labels[s.winner as Side]}`}
        </h2>
        <p>Доход и дальнейшие ходы закрыты. История армии сохранена.</p>
        <Markdown>{s.history.at(-1)?.report?.narrative ?? ''}</Markdown>
      </section>
    )
  if (s.phase === 'ending' && !b) return <Endings s={s} side={side} send={send} />
  if (!b)
    return (
      <section className="panel">
        <h2>Пока нет текущего боя</h2>
        <p>
          Объявите legal contact в стратегическом ходе. Occupation не создаёт настольную партию.
        </p>
      </section>
    )
  const card = MISSION_CARDS[b.mission ?? '']
  return (
    <>
      <section className="panel">
        <p className="eyebrow">
          БОЙ {b.number} ·{' '}
          {b.sector === 'X' ? 'КРИЗИС / ОБЯЗАТЕЛЬНЫЙ КОНТАКТ' : `СЕКТОР ${b.sector}`} ·{' '}
          {phases[s.phase]}
        </p>
        <h2>{card?.title ?? b.mission ?? 'Выбор миссии'}</h2>
        <p>
          {labels[b.attacker]} → {labels[b.defender]} · {b.type} · AL {b.al}
          {b.type === 'PACT' ? ' / 2 на сторону' : ''}
        </p>
        <div className="steps">
          {[
            'mission',
            'lock',
            'muster',
            'interdict',
            'assets',
            'battle',
            'result',
            'aftermath',
            'logistics',
          ].map((step) => (
            <span key={step} className={s.phase === step ? 'current' : ''}>
              {phases[step]}
            </span>
          ))}
        </div>
      </section>
      {s.phase === 'mission' && b.defenderForces?.length === 2 && side === b.defender && (
        <section className="panel">
          <h3>Defending Field Force</h3>
          <Options
            label="Одна Force на этот бой"
            value={b.forces?.[side] ?? 'mf'}
            change={(force) => send('defender_force', { force })}
            items={[
              { id: 'mf', name: 'Main Force' },
              { id: 'stf', name: 'Strike Task Force · 50% AL' },
            ]}
          />
          <p>При потере сектора обе Force отступают вместе.</p>
        </section>
      )}
      {s.phase === 'mission' && (
        <section className="panel">
          <h3>Миссия и единое окно переброса</h3>
          {b.options.length > 0 ? (
            <>
              {b.options.map((code, i) => (
                <button
                  key={`${code}:${i}`}
                  disabled={b.missionChooser !== side}
                  onClick={() => send('choose_mission', { code })}
                >
                  {MISSION_CARDS[code]?.title ?? code}
                </button>
              ))}
              <p>Выбирает {labels[b.missionChooser]}.</p>
            </>
          ) : (
            <>
              <p>{b.mission}</p>
              <div className="buttons">
                <button
                  className="quiet"
                  disabled={b.rerolled || side !== (b.missionPass.length ? b.defender : b.attacker)}
                  onClick={() => send('mission_reroll')}
                >
                  Reroll · 1 Intel
                </button>
                <button
                  disabled={
                    b.missionPass.includes(side) ||
                    side !== (b.missionPass.length ? b.defender : b.attacker)
                  }
                  onClick={() => send('mission_pass')}
                >
                  Оставить миссию / закрыть своё решение
                </button>
              </div>
            </>
          )}
        </section>
      )}
      {s.phase === 'lock' && (
        <section className="panel">
          <h3>Recon Lock</h3>
          <p>
            Без Lock или оба Lock — одновременное раскрытие. Единственный Lock раскрывается вторым.
          </p>
          {b.lock[side] === undefined ? (
            <div className="buttons">
              <button onClick={() => send('recon_lock', { use: true })}>
                Использовать Recon Lock
              </button>
              <button className="quiet" onClick={() => send('recon_lock', { use: false })}>
                Без Lock
              </button>
            </div>
          ) : (
            <p>Ваш выбор зафиксирован. Ожидается другой игрок.</p>
          )}
          <button className="quiet" onClick={() => send('emergency_muster')}>
            Emergency Muster для обязательного боя
          </button>
        </section>
      )}
      {s.phase === 'muster' && <MusterView key={`${b.id}:${side}`} s={s} side={side} send={send} />}
      {s.phase === 'interdict' && <InterdictView s={s} side={side} send={send} />}
      {s.phase === 'assets' && <AssetView s={s} side={side} send={send} />}
      {['battle', 'result', 'aftermath'].includes(s.phase) && (
        <BattlePacket s={s} side={side} send={send} />
      )}{' '}
      {s.phase === 'battle' && <TableView s={s} side={side} send={send} />}
      {s.phase === 'result' && (
        <section className="panel">
          <h3>Оба подтверждают результат</h3>
          <p>
            {labels.deathwatch}: {b.report?.vp.deathwatch} · {labels.necrons}:{' '}
            {b.report?.vp.necrons} · исход {b.outcome}
          </p>
          <p>{b.report?.narrative}</p>
          {b.report?.units.map((r) => (
            <p key={r.id}>
              {unit(s, r.id).name}: {r.entered ? 'участвовал' : 'не вошёл'}
              {r.destroyed ? ' · погиб' : ''}
              {r.withdrawn ? ' · эвакуирован' : ''}
              {r.usedMedicae ? ' · Medicae' : ''}
              {r.casualtySources.length ? ` · причина потерь: ${r.casualtySources.join(', ')}` : ''}
              {r.deed ? ` · ${r.deed}` : ''}
              {r.distinguished ? ' · Distinguished' : ''}
            </p>
          ))}
          <button disabled={b.confirm.includes(side)} onClick={() => send('confirm_result')}>
            Подтвердить результат и потери
          </button>
          <button className="quiet" onClick={() => setEditingResult(!editingResult)}>
            {editingResult ? 'Закрыть исправление' : 'Исправить отчёт'}
          </button>
          <p className="muted">Новая отправка снимает прежнее подтверждение второго игрока.</p>
          <details>
            <summary>Условия победы, спасение и направления отхода</summary>
            {SIDES.map((who) => (
              <p key={who}>
                {labels[who]}: отход в {b.report?.retreat[who] ?? '—'}
                {b.type === 'PACT' &&
                  ` · Channeler после Final Pulse: ${b.report?.facts[`prime_valid:${who}`] ? 'условия выполнены' : 'условия не выполнены'}`}
                {b.type === 'WAR' &&
                  ` · живая модель с OC у Engine: ${b.report?.facts[`engine_alive_oc:${who}`] ? 'да' : 'нет'}`}
                {b.report?.facts[`first_destroyed:${who}`]
                  ? ` · первый уничтоженный: ${s.units.find((u) => u.id === b.report?.facts[`first_destroyed:${who}`])?.name ?? '—'}`
                  : ''}
              </p>
            ))}
            <p>Отход гарнизона: {b.report?.garrisonRetreat ?? '—'}</p>
            {/[AK]3/.test(b.mission ?? '') && (
              <p>
                Throne после hazards:{' '}
                {labels[b.report?.facts.throne_control as Side] ?? 'без контроля'}
              </p>
            )}
            {!!b.report?.facts.anchor_control && (
              <p>Anchor: {labels[b.report!.facts.anchor_control as Side]}</p>
            )}
            {!!b.report?.facts.stores_id && (
              <p>
                Hardened Stores: {s.units.find((u) => u.id === b.report?.facts.stores_id)?.name}
              </p>
            )}
          </details>
          {editingResult && (
            <ReportView
              key={`${b.id}:${side}:${b.confirm.join(',')}`}
              s={s}
              side={side}
              send={send}
            />
          )}
        </section>
      )}
      {s.phase === 'ending' && <Endings s={s} side={side} send={send} />}
      {s.phase === 'aftermath' && <AftermathView s={s} side={side} send={send} />}
      {b.mission && (
        <details className="panel mission-card" open={s.phase === 'battle'}>
          <summary>Карточка миссии и напоминания</summary>
          <Markdown>{card?.body ?? CRISIS_CARDS[b.type] ?? crisisText(s)}</Markdown>
          {b.effects.length > 0 && (
            <>
              <h3>Эффекты этого боя</h3>
              {b.effects.map((e, i) => (
                <p key={i}>
                  <strong>{e.code}</strong> — {EVENTS[e.code]?.effect ?? e.code}
                </p>
              ))}
            </>
          )}
        </details>
      )}
      {Object.keys(b.muster).length > 0 && (
        <details className="panel">
          <summary>Проверенные составы</summary>
          {SIDES.map((who) => (
            <div key={who}>
              <h3>{labels[who]}</h3>
              {b.muster[who] ? (
                b.muster[who]!.picks.map((p) => (
                  <p key={p.id}>
                    {unit(s, p.id).name} · {p.role} · {b.costs[p.id]} Effective
                    {p.transport ? ' · embarked' : ''}
                  </p>
                ))
              ) : (
                <p>Состав закрыт.</p>
              )}
            </div>
          ))}
        </details>
      )}
    </>
  )
}
function crisisText(s: State) {
  const b = s.battle!
  return b.type === 'encounter'
    ? 'CROSS objectives. В конце раунда центр 4 VP, внешние по 2. Cap 50. Позиции и владение на карте сохраняются.'
    : b.type === 'WAR'
      ? 'SEAL CONDUIT при физическом контроле. OVERRIDE ENGINE с R4, два своих current tags. R2–5 по 3 VP за tagged + controlled Conduit; R4/5 +6 за controlled Engine с Override. После Final Pulse кандидат: Override, два Seal records и живая модель OC >0 в 3 Engine. Один кандидат выигрывает; при двух — больше VP; равенство или ни одного — общее поражение.'
      : 'ENCODE: один старт на сторону за ход. Echo может быть живой при старте, должна погибнуть к completion. Два ключа стабилизируют Seal, Instability −2. PRIME ENGINE с R4 после трёх stable Seals. Любое движение / Battle-shock гасит Prime. Instability +2 в начале раунда; 12 — немедленное поражение. После Echo phase и Final Pulse R5: три stable Seals и два действующих Channeler дают CONCORDAT.'
}
function MusterView({ s, side, send }: Props) {
  const b = s.battle!,
    p = s.players[side],
    candidates = s.units.filter(
      (u) =>
        u.side === side &&
        available(s, u) &&
        (u.location === (b.forces?.[side] === 'stf' ? 'stf' : 'field') ||
          (u.location === 'garrison' && u.sector === b.sector)),
    ),
    [picks, setPicks] = useState<Pick[]>([]),
    [rest, setRest] = useState<string[]>([]),
    [detachments, setDetachments] = useState(p.package.slice(0, 1)),
    [commander, setCommander] = useState(''),
    [dispositions, setDispositions] = useState<string[]>([])
  const edit = (id: string, value: Partial<Pick>) =>
    setPicks(picks.map((p) => (p.id === id ? { ...p, ...value } : p)))
  const m: Muster = { picks, rest, detachments, commander, dispositions }
  let error = '',
    costs: Record<string, number> = {}
  try {
    costs = validateMuster(s, side, m)
  } catch (e) {
    error = (e as Error).message
  }
  if (b.muster[side])
    return (
      <section className="panel">
        <h3>Ваш legal commitment сохранён</h3>
        <p>Состав неизменяем. Ожидается второй командир.</p>
      </section>
    )
  return (
    <section className="panel">
      <h3>Закрытый состав</h3>
      <p>
        Initial {b.initial} · Pool {b.pool} · первое прибытие R{b.firstSlot}. В Field defence
        гарнизон Initial заполняет свободный AL.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Роль</th>
              <th>Формация / транспорт</th>
              <th>Улучшения</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((u) => {
              const pick = picks.find((p) => p.id === u.id),
                cat = entry(s, u, b.snapshot)
              return (
                <tr key={u.id}>
                  <td>
                    <Check
                      label={`${u.name} · ${u.rc} RC`}
                      value={!!pick}
                      change={(v) => {
                        if (v) {
                          setPicks([
                            ...picks,
                            {
                              id: u.id,
                              role: u.location === 'garrison' ? 'initial' : 'field',
                              formation: u.id,
                              transport: null,
                              reserve: false,
                              enhancement: null,
                              paidOptions: [],
                              honours: [...u.honours],
                              armoury: !!u.armoury,
                              relic: !!u.relic,
                              redemption: null,
                              redemptionDeed: null,
                              protocol: u.scars.some((c) => side === 'necrons' && c.id === 12)
                                ? 'HOLD'
                                : null,
                            },
                          ])
                          setRest(rest.filter((id) => id !== u.id))
                        } else setPicks(picks.filter((p) => p.id !== u.id))
                      }}
                    />
                    <small>
                      Damage {u.damage} · XP {u.xp}
                      {costs[u.id] !== undefined && ` · ${costs[u.id]} Effective`}
                    </small>
                    {!pick && (
                      <Check
                        label="RESTING"
                        value={rest.includes(u.id)}
                        change={(v) =>
                          setRest(v ? [...rest, u.id] : rest.filter((id) => id !== u.id))
                        }
                      />
                    )}
                  </td>
                  <td>
                    {pick && (
                      <>
                        <select
                          aria-label={`Роль ${u.name}`}
                          value={pick.role}
                          onChange={(e) => edit(u.id, { role: e.target.value as Pick['role'] })}
                        >
                          {(u.location !== 'garrison' ? ['field'] : ['initial', 'pool']).map(
                            (v) => (
                              <option key={v}>{v}</option>
                            ),
                          )}
                        </select>
                        <Check
                          label="Initial Reserves"
                          value={pick.reserve}
                          change={(v) => edit(u.id, { reserve: v })}
                        />
                      </>
                    )}
                  </td>
                  <td>
                    {pick && (
                      <>
                        <Options
                          label="Attached формация"
                          value={pick.formation}
                          change={(v) => edit(u.id, { formation: v })}
                          items={picks.map((v) => ({ id: v.id, name: unit(s, v.id).name }))}
                        />
                        <Options
                          label="Embarked в"
                          value={pick.transport ?? ''}
                          change={(v) => edit(u.id, { transport: v || null })}
                          items={picks
                            .filter((p) => entry(s, unit(s, p.id)).transport > 0)
                            .map((p) => ({ id: p.id, name: unit(s, p.id).name }))}
                        />
                      </>
                    )}
                  </td>
                  <td>
                    {pick && (
                      <>
                        {u.honours.map((id) => (
                          <Check
                            key={id}
                            label={id}
                            value={pick.honours.includes(id)}
                            change={(v) =>
                              edit(u.id, {
                                honours: v
                                  ? [...pick.honours, id]
                                  : pick.honours.filter((h) => h !== id),
                              })
                            }
                          />
                        ))}
                        {u.armoury && (
                          <Check
                            label={ARMOURY[u.armoury].name}
                            value={pick.armoury}
                            change={(v) => edit(u.id, { armoury: v })}
                          />
                        )}{' '}
                        {u.relic && (
                          <Check
                            label={RELICS[u.relic].name}
                            value={pick.relic}
                            change={(v) => edit(u.id, { relic: v })}
                          />
                        )}{' '}
                        {cat.character && (
                          <Options
                            label="Enhancement"
                            value={pick.enhancement ?? ''}
                            change={(v) => edit(u.id, { enhancement: v || null })}
                            items={b.snapshot.enhancements.map((e) => ({
                              id: e.id,
                              name: `${e.name} +${e.cost}`,
                            }))}
                          />
                        )}{' '}
                        {(cat.packageCosts ?? [])
                          .filter(
                            (o) =>
                              o.cost > 0 && o.detachments.some((id) => detachments.includes(id)),
                          )
                          .map((o) =>
                            o.optional ? (
                              <Check
                                key={o.name}
                                label={`${o.name} · +${o.cost} очков на бой`}
                                value={(pick.paidOptions ?? []).includes(o.name)}
                                change={(v) =>
                                  edit(u.id, {
                                    paidOptions: v
                                      ? [...(pick.paidOptions ?? []), o.name]
                                      : (pick.paidOptions ?? []).filter((n) => n !== o.name),
                                  })
                                }
                              />
                            ) : (
                              <small key={o.name}>
                                {o.name} · обязательные +{o.cost} очков в этом detachment
                              </small>
                            ),
                          )}
                        {u.scars.length > 0 && (
                          <Options
                            label="Redemption Scar"
                            value={pick.redemption === null ? '' : String(pick.redemption)}
                            change={(v) => edit(u.id, { redemption: v ? Number(v) : null })}
                            items={u.scars.map((sc) => ({
                              id: String(sc.id),
                              name: `Scar ${sc.id}`,
                            }))}
                          />
                        )}
                        {pick.redemption !== null && (
                          <Options
                            label="Redemption Deed до commitment"
                            value={pick.redemptionDeed ?? ''}
                            change={(redemptionDeed) => edit(u.id, { redemptionDeed })}
                            items={['HOLD', 'BREAK', 'HUNT', 'ENDURE', 'OPERATE', 'EXTRACT'].map(
                              (id) => ({ id, name: id }),
                            )}
                          />
                        )}{' '}
                        {u.side === 'necrons' && u.scars.some((c) => c.id === 12) && (
                          <Options
                            label="Protocol Obsession"
                            value={pick.protocol ?? 'HOLD'}
                            change={(protocol) => edit(u.id, { protocol })}
                            items={['HOLD', 'HUNT'].map((id) => ({ id, name: id }))}
                          />
                        )}
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="form-grid">
        <div>
          <h4>Detachments на бой</h4>
          {p.package.map((id) => (
            <Check
              key={id}
              label={s.snapshot.detachments.find((d) => d.id === id)!.name}
              value={detachments.includes(id)}
              change={(v) => {
                const next = v ? [...detachments, id] : detachments.filter((d) => d !== id)
                setDetachments(next)
                setPicks(
                  picks.map((pick) => ({
                    ...pick,
                    paidOptions: (pick.paidOptions ?? []).filter((name) =>
                      entry(s, unit(s, pick.id), b.snapshot).packageCosts?.some(
                        (o) =>
                          o.optional &&
                          o.name === name &&
                          o.detachments.some((d) => next.includes(d)),
                      ),
                    ),
                  })),
                )
              }}
            />
          ))}
        </div>
        <div>
          {(b.snapshot.dispositions ?? [])
            .filter((d) => d.side === side)
            .map((d) => (
              <Check
                key={d.id}
                label={d.name}
                value={dispositions.includes(d.id)}
                change={(v) =>
                  setDispositions(
                    v ? [...dispositions, d.id] : dispositions.filter((id) => id !== d.id),
                  )
                }
              />
            ))}
        </div>
        <Options
          label="Warlord / Garrison Commander"
          value={commander}
          change={setCommander}
          items={picks.map((p) => ({ id: p.id, name: unit(s, p.id).name }))}
        />
      </div>
      <p className={error ? 'validation' : 'success'}>
        {error || 'Состав прошёл проверки кампании.'}
      </p>
      <div className="buttons">
        <button disabled={!!error} onClick={() => send('commit_muster', { muster: m })}>
          Запечатать legal состав
        </button>
        {['encounter', 'WAR', 'PACT'].includes(b.type) && (
          <button className="quiet" onClick={() => send('emergency_muster')}>
            Нет legal армии → Emergency Muster
          </button>
        )}
      </div>
    </section>
  )
}
function InterdictView({ s, side, send }: Props) {
  const [asset, setAsset] = useState(''),
    b = s.battle!
  return (
    <section className="panel">
      <h3>Одновременный Interdict</h3>
      <Options
        label="Запретить enemy Tactical / Breach"
        value={asset}
        change={setAsset}
        items={[...new Set([...TACTICAL, ...BREACH])].map((id) => ({ id, name: ASSET_LABELS[id] }))}
      />
      <button
        disabled={b.interdict[side] !== undefined}
        onClick={() => send('interdict', { asset: asset || null })}
      >
        {asset ? 'Запретить · 2 Intel' : 'Пропустить Interdict'}
      </button>
    </section>
  )
}
function AssetView({ s, side, send }: Props) {
  const b = s.battle!,
    [a, setA] = useState({
      tactical: [] as string[],
      defensive: [] as string[],
      breach: [] as string[],
    })
  return (
    <section className="panel">
      <h3>Assets после reveal</h3>
      <p>
        Underdog {underdog(b, side)} · Defensive {side === b.defender && b.defAsset ? 1 : 0} ·
        Breach {side === b.attacker ? b.breaches : 0}. Enemy Interdict:{' '}
        {b.interdict[other(side)] ? ASSET_LABELS[b.interdict[other(side)]!] : 'нет'}.
      </p>
      <div className="columns">
        {Object.entries({ tactical: TACTICAL, defensive: DEFENSIVE, breach: BREACH }).map(
          ([list, items]) => (
            <div key={list}>
              <h4>{list}</h4>
              {items.map((id) => (
                <Check
                  key={id}
                  label={ASSET_LABELS[id]}
                  value={a[list as keyof typeof a].includes(id)}
                  change={(v) =>
                    setA({
                      ...a,
                      [list]: v
                        ? [...a[list as keyof typeof a], id]
                        : a[list as keyof typeof a].filter((x) => x !== id),
                    })
                  }
                />
              ))}
            </div>
          ),
        )}
      </div>
      <button disabled={!!b.assets[side]} onClick={() => send('commit_assets', { assets: a })}>
        Зафиксировать Assets
      </button>
    </section>
  )
}
function TableView({ s, side, send }: Props) {
  const dimensions = ['WAR', 'PACT'].includes(s.battle!.type)
    ? { l: 60, w: 44, d: 12 }
    : STAGES[s.battle!.stage]
  const b = s.battle!,
    t = b.table,
    [actor, setActor] = useState(''),
    [object, setObject] = useState(''),
    [kind, setKind] = useState(''),
    [die, setDie] = useState(3),
    [ack, setAck] = useState(false),
    [ruinsBonus, setRuinsBonus] = useState(false)
  const o = t.objects.find((o) => o.id === object),
    options = o ? actionsFor(s, o) : []
  return (
    <>
      <section className="panel">
        <div className="section-head">
          <h2>
            R{t.round} · {t.step} · {labels[t.turn]}
          </h2>
          <div className="score">
            {t.vp.deathwatch} : {t.vp.necrons}
          </div>
        </div>
        {t.round === 1 && t.step === 'start' && (
          <Options
            label="Первый игрок по tabletop roll-off"
            value={t.first}
            change={(side) => send('table_first', { side })}
            items={SIDES.map((id) => ({ id, name: labels[id] }))}
          />
        )}
        <div className="table-map">
          <svg
            viewBox={`-2 -2 ${dimensions.l + 4} ${dimensions.w + 4}`}
            role="img"
            aria-label="Объекты текущей миссии"
          >
            <rect
              x="0"
              y="0"
              width={dimensions.l}
              height={dimensions.d}
              fill="#786044"
              opacity=".2"
            />
            <rect
              x="0"
              y={dimensions.w - dimensions.d}
              width={dimensions.l}
              height={dimensions.d}
              fill="#4f7761"
              opacity=".2"
            />
            {t.objects
              .filter((o) => !o.disabled)
              .map((o) => (
                <g key={o.id} onClick={() => setObject(o.id)}>
                  <circle
                    cx={o.x}
                    cy={o.y}
                    r={o.kind === 'objective' ? 2 : 1.4}
                    className={o.control ?? 'neutral'}
                  />
                  <text x={o.x} y={o.y + 0.6}>
                    {o.id}
                  </text>
                </g>
              ))}
          </svg>
        </div>
        {b.type === 'PACT' && (
          <p>
            Instability <strong>{t.instability}/12</strong> · Keys{' '}
            {t.objects.reduce((n, o) => n + o.keys.length, 0)}/6 · Primes{' '}
            {Object.keys(t.primes).length}/2
          </p>
        )}
        <div className="object-grid">
          {t.objects.map((o) => (
            <div className="object" key={o.id}>
              <strong>
                {o.id} · {o.kind}
              </strong>
              <small>
                ({o.x.toFixed(1)}, {o.y.toFixed(1)}) {o.disabled ? '· отключён' : ''}
              </small>
              <Options
                label="Физический контроль"
                value={o.control ?? ''}
                change={(who) =>
                  send('table_controls', { controls: [{ id: o.id, side: who || null }] })
                }
                items={SIDES.map((id) => ({ id, name: labels[id] }))}
              />
              <small>
                Tag: {o.tag ? labels[o.tag] : '—'}
                {o.keys.length ? ` · Keys ${o.keys.join(' + ')}` : ''}
                {o.carrier ? ` · Bearer ${unit(s, o.carrier).name}` : ''}
              </small>
              {b.type === 'PACT' && ['1', '2', '3'].includes(o.id) && (
                <label>
                  Echo wounds
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={t.echoes[Number(o.id) - 1].wounds}
                    onChange={(e) =>
                      send('echo_wounds', {
                        index: Number(o.id) - 1,
                        wounds: Number(e.target.value),
                      })
                    }
                  />
                </label>
              )}
            </div>
          ))}
        </div>
        {t.notes.length > 0 && (
          <div className="notice">
            {t.notes.map((n, i) => (
              <p key={i}>{n}</p>
            ))}
          </div>
        )}
        {t.step !== 'finished' && (
          <button onClick={() => send('table_advance')}>Завершить {t.step} → следующий этап</button>
        )}
      </section>
      {t.step === 'movement' && (
        <section className="panel">
          <h3>Старт Named Action</h3>
          <div className="form-grid">
            <Options
              label="Actor persistent ID"
              value={actor}
              change={setActor}
              items={b.muster[side]!.picks.map((p) => ({ id: p.id, name: unit(s, p.id).name }))}
            />
            <Options
              label="Объект"
              value={object}
              change={(v) => {
                setObject(v)
                setKind('')
              }}
              items={t.objects
                .filter((o) => !o.disabled)
                .map((o) => ({ id: o.id, name: `${o.id} · ${o.kind}` }))}
            />
            <Options
              label="Action"
              value={kind}
              change={setKind}
              items={options.map((id) => ({ id, name: id }))}
            />
          </div>
          <Check
            label="За столом проверены eligibility, range, запреты Shoot/Charge и требуемый контроль"
            value={ack}
            change={setAck}
          />
          <button
            disabled={!ack || !actor || !object || !kind}
            onClick={() =>
              send('table_action', {
                actor,
                object,
                kind,
                eligible: true,
                inRange: true,
                deliveryEligible: true,
              })
            }
          >
            Начать Action
          </button>
        </section>
      )}
      {t.actions
        .filter((a) => a.pending && a.side === side)
        .map((a) => (
          <section className="panel" key={a.id}>
            <h3>
              {a.kind} · {unit(s, a.actor).name} → {a.object}
            </h3>
            <p>
              Успех требует живого, не Battle-shocked, стационарного actor в range. Если нужен
              контроль, он сохранён. ENCODE проверяет мёртвую Echo сейчас.
            </p>
            {s.sectors.B.owner === side && !t.records[`ruinsBonus:${side}`] && (
              <Check
                label="B: actor в Ruins, применить одноразовый +1 к последствиям D6"
                value={ruinsBonus}
                change={setRuinsBonus}
              />
            )}
            <label>
              Боевой D6, если его требует карточка
              <input
                type="number"
                min="1"
                max="6"
                value={die}
                onChange={(e) => setDie(Number(e.target.value))}
              />
            </label>
            <div className="buttons">
              <button
                onClick={() =>
                  send('table_complete', {
                    id: a.id,
                    success: true,
                    alive: true,
                    inRange: true,
                    notShocked: true,
                    stationary: true,
                    die,
                    ruinsBonus,
                    inRuins: ruinsBonus,
                  })
                }
              >
                Подтвердить успешный completion
              </button>
              <button
                className="quiet"
                onClick={() => send('table_complete', { id: a.id, success: false })}
              >
                Action сорван
              </button>
            </div>
          </section>
        ))}
      <TableExtras s={s} side={side} send={send} />
      <MissionFacts s={s} side={side} send={send} />
      {t.step === 'finished' && <ReportView s={s} side={side} send={send} />}
    </>
  )
}
export function ReportView({
  s,
  side,
  send,
  correction = false,
}: Props & { correction?: boolean }) {
  const b = correction ? (s.battle?.aftermathApplied ? s.battle : s.history.at(-1))! : s.battle!,
    [rows, setRows] = useState<UnitResult[]>(
      b.report?.units ??
        SIDES.flatMap((who) =>
          b.muster[who]!.picks.map((p) => ({
            id: p.id,
            entered: (p.role !== 'pool' && !p.reserve) || !!b.table.records[`entered:${p.id}`],
            destroyed: p.reserve && p.role !== 'pool' && !b.table.records[`entered:${p.id}`],
            deed: null,
            distinguished: false,
            casualtySources: [],
            withdrawn: false,
            usedMedicae: false,
          })),
        ),
    ),
    [facts, setFacts] = useState<Record<string, unknown>>(b.report?.facts ?? {}),
    [narrative, setNarrative] = useState(b.report?.narrative ?? ''),
    [vp, setVP] = useState(b.report?.vp ?? b.table.vp),
    [retreat, setRetreat] = useState<Report['retreat']>(b.report?.retreat ?? {}),
    [garrisonRetreat, setGarrisonRetreat] = useState<Report['garrisonRetreat']>(
      b.report?.garrisonRetreat ?? null,
    )
  const edit = (id: string, value: Partial<UnitResult>) =>
    setRows(rows.map((r) => (r.id === id ? { ...r, ...value } : r)))
  return (
    <section className="panel">
      <h3>{correction ? 'Новая ревизия результата' : 'Итог и потери по ID'}</h3>
      {correction && (
        <>
          <p>
            Оба согласуют откат всех зависимых решений к исходному результату. Сохранённые dice
            повторно не бросаются; доход пересчитывается один раз.
          </p>
          {SIDES.map((who) => (
            <label key={who}>
              VP {labels[who]}
              <input
                type="number"
                min="0"
                max="50"
                value={vp[who]}
                onChange={(e) => setVP({ ...vp, [who]: Number(e.target.value) })}
              />
            </label>
          ))}
        </>
      )}
      <p>
        VP {b.table.vp.deathwatch} : {b.table.vp.necrons}. Проверяйте участие Pool и груза, общий
        Deed исходной формации и Distinguished.
      </p>
      {rows.map((r) => (
        <div className="report-row" key={r.id}>
          <strong>{s.units.find((u) => u.id === r.id)?.name ?? r.id}</strong>
          <div className="buttons">
            <Check
              label="Участвовал"
              value={r.entered}
              change={(v) => edit(r.id, { entered: v })}
            />
            {b.table.records.withdrawalSide && (
              <Check
                label="Эвакуирован со стола"
                value={r.withdrawn}
                change={(v) => edit(r.id, { withdrawn: v })}
              />
            )}
            <Check
              label="Уничтожен"
              value={r.destroyed}
              change={(v) => edit(r.id, { destroyed: v })}
            />
            <Check
              label="Distinguished"
              value={r.distinguished}
              change={(v) => edit(r.id, { distinguished: v })}
            />
            <Check
              label="Medicae при новом Damage"
              value={r.usedMedicae ?? false}
              change={(v) => edit(r.id, { usedMedicae: v })}
            />
          </div>
          <Options
            label="Deed, максимум один на исходную формацию"
            value={r.deed ?? ''}
            change={(v) => edit(r.id, { deed: (v || null) as UnitResult['deed'] })}
            items={['HOLD', 'BREAK', 'HUNT', 'ENDURE', 'OPERATE', 'EXTRACT'].map((id) => ({
              id,
              name: id,
            }))}
          />
          <Check
            label="Memory of Eternity использовано, bearer выжил"
            value={r.signatureXP ?? false}
            change={(v) => edit(r.id, { signatureXP: v })}
          />
          <Check
            label="Scar Driven to Hunt: objective XENOS target"
            value={r.scarBonus ?? false}
            change={(v) => edit(r.id, { scarBonus: v })}
          />
          {['C1', 'D1', 'J3'].includes(b.mission!) && (
            <Check
              label="Погиб именно от mission hazard: Casualty −1"
              value={r.casualtySources.length > 0}
              change={(v) =>
                edit(r.id, {
                  casualtySources: v
                    ? [
                        b.mission === 'C1'
                          ? 'c1_debris'
                          : b.mission === 'D1'
                            ? 'd1_toxic'
                            : 'j3_reactor',
                      ]
                    : [],
                })
              }
            />
          )}
        </div>
      ))}
      {b.type === 'PACT' &&
        SIDES.map((who) => (
          <Check
            key={who}
            label={`${labels[who]}: Channeler жив, OC >0, не BS, без move, в 3 Engine после Final Pulse`}
            value={facts[`prime_valid:${who}`] === true}
            change={(v) => setFacts({ ...facts, [`prime_valid:${who}`]: v })}
          />
        ))}
      {b.type === 'WAR' &&
        SIDES.map((who) => (
          <Check
            key={who}
            label={`${labels[who]}: живая модель с OC >0 в 3 Engine после Final Pulse`}
            value={facts[`engine_alive_oc:${who}`] === true}
            change={(v) => setFacts({ ...facts, [`engine_alive_oc:${who}`]: v })}
          />
        ))}
      {/[AK]3/.test(b.mission!) && (
        <Check
          label="Attacker контролирует Throne в конце R5 после hazards"
          value={facts.throne_control === b.attacker}
          change={(v) => setFacts({ ...facts, throne_control: v ? b.attacker : b.defender })}
        />
      )}
      {SIDES.map((who) => (
        <Options
          key={who}
          label={`Первый уничтоженный ID ${labels[who]} · Hard Evacuation / Extraction`}
          value={String(facts[`first_destroyed:${who}`] ?? '')}
          change={(v) => setFacts({ ...facts, [`first_destroyed:${who}`]: v })}
          items={rows
            .filter((r) => r.destroyed && s.units.find((u) => u.id === r.id)?.side === who)
            .map((r) => ({ id: r.id, name: s.units.find((u) => u.id === r.id)!.name }))}
        />
      ))}
      {b.assets[b.defender]?.defensive.includes('stores') && (
        <Options
          label="Hardened Stores: один уничтоженный ID"
          value={String(facts.stores_id ?? '')}
          change={(v) => setFacts({ ...facts, stores_id: v })}
          items={rows
            .filter(
              (r) =>
                r.destroyed &&
                r.entered &&
                b.muster[b.defender]?.picks.some((p) => p.id === r.id && p.role !== 'field'),
            )
            .map((r) => ({ id: r.id, name: s.units.find((u) => u.id === r.id)!.name }))}
        />
      )}
      <Options
        label="Контроль Anchor в конце R5 (если есть overlay)"
        value={String(facts.anchor_control ?? '')}
        change={(v) => setFacts({ ...facts, anchor_control: v || null })}
        items={SIDES.map((id) => ({ id, name: labels[id] }))}
      />
      {SIDES.map((who) => (
        <Options
          key={who}
          label={`Отход ${labels[who]} при необходимости`}
          value={retreat[who] ?? ''}
          change={(v) => setRetreat({ ...retreat, [who]: v || undefined })}
          items={Object.values(s.sectors)
            .filter((a) => a.owner === who)
            .map((a) => ({ id: a.key, name: a.key }))}
        />
      ))}
      <Options
        label="Единый отход захваченного гарнизона"
        value={garrisonRetreat ?? ''}
        change={(v) => setGarrisonRetreat((v as Report['garrisonRetreat']) || null)}
        items={Object.values(s.sectors)
          .filter((a) => a.owner === b.defender)
          .map((a) => ({ id: a.key, name: a.key }))}
      />
      <label>
        История боя
        <textarea rows={3} value={narrative} onChange={(e) => setNarrative(e.target.value)} />
      </label>
      <button
        onClick={() =>
          send(correction ? 'request_correction' : 'submit_result', {
            report: {
              vp: correction ? vp : b.table.vp,
              units: rows,
              withdrawal: b.table.records.mutualWithdrawal
                ? [...SIDES]
                : b.table.records.withdrawalSide
                  ? [b.table.records.withdrawalSide as Side]
                  : [],
              facts: { ...facts, withdrawal_timing_valid: !!b.table.records.withdrawalSide },
              retreat,
              garrisonRetreat,
              narrative,
            } satisfies Report,
          })
        }
      >
        Отправить результат на подтверждение обоими
      </button>
    </section>
  )
}
function Endings({ s, side, send }: Props) {
  return (
    <section className="panel">
      <h3>
        Ending выбирает{' '}
        {s.winner && SIDES.includes(s.winner as Side) ? labels[s.winner as Side] : 'победитель'}
      </h3>
      <p>
        Выбор до Casualty. PURGE: все участники +1. SEIZE: сюжетная отметка Legendary. SEAL: по ID
        каждой стороны исчезает. FEED: обычные потери.
      </p>
      <div className="buttons">
        {['PURGE', 'SEIZE', 'SEAL', 'FEED'].map((ending) => (
          <button
            key={ending}
            disabled={
              s.winner !== side ||
              (ending === 'SEAL' && s.players[side].fragments < 3) ||
              (ending === 'FEED' && s.choir < 8)
            }
            onClick={() => send('choose_ending', { ending })}
          >
            {ending}
          </button>
        ))}
      </div>
    </section>
  )
}
function AftermathView({ s, side, send }: Props) {
  const b = s.battle!,
    preview = (
      s as State & { preview?: { players: State['players']; units: State['units']; phase: string } }
    ).preview
  return (
    <section className="panel">
      <h3>Последствия: один сохранённый расчёт</h3>
      <p>Casualty пока предварительные. Recovery Crew меняет raw total до Critical.</p>
      {b.casualties.map((c) => (
        <p key={c.id}>
          {unit(s, c.id).name}: D6 {c.die} {c.modifier >= 0 ? '+' : ''}
          {c.modifier} · raw {c.die + c.modifier}
          {c.critical ? ` · Critical ${c.critical}` : ''}
        </p>
      ))}
      {!b.terminal && (
        <>
          <h4>Salvage</h4>
          <p>Ваш D6: {b.salvage[side]}</p>
          <button
            className="quiet"
            disabled={b.salvageRerolled.includes(side) || b.eventPass.length === 2}
            onClick={() => send('salvage_reroll')}
          >
            Перебросить · 1 Intel
          </button>
          <h4>D66</h4>
          {b.eventOptions.length ? (
            b.eventOptions.map((code, i) => (
              <button
                key={`${code}:${i}`}
                disabled={b.eventChooser !== side}
                onClick={() => send('choose_event', { code })}
              >
                {code} · {EVENTS[code].name}
              </button>
            ))
          ) : (
            <>
              <p>
                <strong>
                  {b.event} · {EVENTS[b.event ?? '']?.name}
                </strong>
              </p>
              <p>{EVENTS[b.event ?? '']?.effect}</p>
              <div className="buttons">
                <button
                  className="quiet"
                  disabled={
                    b.eventPass.length === 2 ||
                    b.eventRerolled ||
                    side !== (b.eventPass.length ? other(b.eventChooser) : b.eventChooser)
                  }
                  onClick={() => send('event_reroll')}
                >
                  D66 reroll · 2 Intel
                </button>
                <button
                  disabled={
                    b.eventPass.includes(side) ||
                    side !== (b.eventPass.length ? other(b.eventChooser) : b.eventChooser)
                  }
                  onClick={() => send('event_pass')}
                >
                  Принять / закрыть свою очередь
                </button>
              </div>
            </>
          )}
        </>
      )}
      {b.choices
        .filter((c) => c.side === side)
        .map((c) => (
          <ChoiceView key={c.key} s={s} side={side} send={send} choiceKey={c.key} />
        ))}
      {b.choices.some((c) => c.side !== side && c.value === undefined) && (
        <p>Другой игрок ещё выбирает награды.</p>
      )}
      <hr />
      {preview ? (
        <>
          <h4>Итог до фиксации</h4>
          {SIDES.map((who) => (
            <p key={who}>
              {labels[who]}: Supply {s.players[who].supply} → {preview.players[who].supply}; Intel{' '}
              {s.players[who].intel} → {preview.players[who].intel}; Recovery{' '}
              {s.players[who].recovery} → {preview.players[who].recovery}; MF{' '}
              {preview.players[who].mf}
            </p>
          ))}
          {preview.units
            .filter((u) => {
              const old = s.units.find((v) => v.id === u.id)
              return (
                !old ||
                old.damage !== u.damage ||
                old.xp !== u.xp ||
                old.status !== u.status ||
                old.scars.length !== u.scars.length
              )
            })
            .map((u) => (
              <p key={u.id}>
                {u.name}: XP {u.xp} · Damage {u.damage} · {u.status} · Scars{' '}
                {u.scars.map((c) => c.id).join(', ') || '—'}
              </p>
            ))}
          <p>Далее: {phases[preview.phase]}</p>
          <button disabled={b.confirm.includes(side)} onClick={() => send('confirm_aftermath')}>
            Подтвердить этот расчёт
          </button>
        </>
      ) : (
        <button
          disabled={
            (!b.terminal && b.eventPass.length < 2) || b.choices.some((c) => c.value === undefined)
          }
          onClick={() => send('preview_aftermath')}
        >
          Подготовить итоговый расчёт
        </button>
      )}
    </section>
  )
}
function ChoiceView({ s, side, send, choiceKey }: Props & { choiceKey: string }) {
  const c = s.battle!.choices.find((c) => c.key === choiceKey)!,
    [value, setValue] = useState(c.options[0]),
    [id, setId] = useState(c.unitIds[0] ?? ''),
    [sector, setSector] = useState<string>(c.sectorKeys[0] ?? '')
  return (
    <div className="choice">
      <h4>{c.label}</h4>
      {c.value !== undefined ? (
        <p>
          Зафиксировано: {c.value} {c.unit ? unit(s, c.unit).name : ''} {c.sector}
        </p>
      ) : (
        <>
          <Options
            label="Решение"
            value={value}
            change={setValue}
            items={c.options.map((id) => ({ id, name: id }))}
          />
          {c.unitIds.length > 0 && (
            <Options
              label="Eligible ID"
              value={id}
              change={setId}
              items={c.unitIds.map((id) => ({ id, name: unit(s, id).name }))}
            />
          )}{' '}
          {c.sectorKeys.length > 0 && (
            <Options
              label="Сектор"
              value={sector}
              change={setSector}
              items={c.sectorKeys.map((id) => ({ id, name: id }))}
            />
          )}
          <button
            className="quiet"
            onClick={() =>
              send('aftermath_choice', {
                key: c.key,
                value,
                unit: id || undefined,
                sector: sector || undefined,
              })
            }
          >
            Зафиксировать
          </button>
        </>
      )}
    </div>
  )
}
