import { BattleHeader } from './BattleHeader'
import { MusterView } from './MusterView'
import { ResultView } from './ResultView'
import { ConfirmDialog } from './ConfirmDialog'
import { ReportView } from './ReportView'
export { ReportView } from './ReportView'
import { AftermathSummary } from './AftermathSummary'
import { battleCommandError, TABLE_STEPS } from '../../shared/battle-ui'
import { nextStep } from '../../shared/next-step'
import { StatusBadge } from './StatusBadge'
import { BattlePacket } from './BattlePacket'
import { TableExtras, MissionFacts } from './TableExtras'
import { FirstPlayer, TableAdvance } from './TableAdvance'
import { BattleJournal } from './BattleJournal'
import { completionReady } from '../../shared/table-checks'
import { useState } from 'react'
import Markdown from 'react-markdown'
import { MissionBrief } from './MissionBrief'
import { EVENTS, MISSION_CARDS, CRISIS_CARDS } from '../../shared/rules.generated'
import { SIDES, other, type Side, type State } from '../../shared/model'
import { BREACH, DEFENSIVE, TACTICAL, unit, STAGES } from '../../shared/rules'
import { actionsFor } from '../../shared/table'
import { underdog } from '../../shared/muster'
import { labels, phases } from './common'
import { Check, Options, type Props } from './common'
import { RuleHelp } from './RulesContext'
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
  const b = s.battle
  if (s.phase === 'finale_mode')
    return <FinaleMode key={`${s.id}:${side}`} s={s} side={side} send={send} />
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
      <BattleHeader s={s} side={side} />
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
        <section className="panel" id="mission-panel">
          <h3>Миссия и единое окно переброса</h3>
          {b.options.length > 0 ? (
            <>
              {b.options.map((code, i) => (
                <div className="mission-option" key={`${code}:${i}`}>
                  <button
                    disabled={b.missionChooser !== side}
                    onClick={() => send('choose_mission', { code })}
                  >
                    {MISSION_CARDS[code]?.title ?? code}
                  </button>
                  <details>
                    <summary>Суть и задачи {code}</summary>
                    <MissionBrief
                      code={code}
                      exact={MISSION_CARDS[code]?.body ?? CRISIS_CARDS[code] ?? crisisText(s)}
                    />
                  </details>
                </div>
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
        <section className="panel" id="recon-panel">
          <h3 className="rule-label">
            Recon Lock <RuleHelp topic="preparation" />
          </h3>
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
      {s.phase === 'battle' && !b.reconciliation && <TableView s={s} side={side} send={send} />}
      {['battle', 'result', 'aftermath'].includes(s.phase) && (
        <BattleJournal s={s} side={side} send={send} />
      )}
      {s.phase === 'battle' && b.table.step === 'finished' && !b.reconciliation && (
        <ReportView s={s} side={side} send={send} />
      )}
      {s.phase === 'result' && !b.reconciliation && <ResultView s={s} side={side} send={send} />}
      {s.phase === 'ending' && <Endings s={s} side={side} send={send} />}
      {s.phase === 'aftermath' && <AftermathView s={s} side={side} send={send} />}
      {b.mission && s.phase !== 'battle' && (
        <details className="panel mission-card">
          <summary>Карточка миссии и напоминания</summary>
          <MissionBrief
            code={b.mission ?? b.type}
            exact={card?.body ?? CRISIS_CARDS[b.type] ?? crisisText(s)}
          />
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

function FinaleMode({ s, side, send }: Props) {
  const [choice, setChoice] = useState<'PACT' | 'WAR' | null>(null)
  const saved = s.finalModes[side]
  return (
    <section className="panel finale-mode" id="battle-panel">
      <p className="eyebrow">ПОСЛЕДНИЙ ТАКТ · БОЙ 18</p>
      <h2>Выберите режим финала</h2>
      <p>
        Выбор каждого командира закрыт до решения второго игрока. После сохранения его нельзя
        изменить.
      </p>
      <div className="finale-choices">
        <article>
          <h3>PACT</h3>
          <p>
            Вместе остановить машину. Кооперативный финал откроется, если оба командира выберут
            PACT.
          </p>
          <button className="primary" disabled={!!saved} onClick={() => setChoice('PACT')}>
            PACT · вместе остановить машину
          </button>
        </article>
        <article>
          <h3>WAR</h3>
          <p>Присвоить машину. Любой выбор WAR открывает бой командиров друг с другом.</p>
          <button className="danger" disabled={!!saved} onClick={() => setChoice('WAR')}>
            WAR · присвоить машину
          </button>
        </article>
      </div>
      <p className="notice" role="status">
        {saved
          ? `Ваш выбор: ${saved}. Ожидается решение второго командира.`
          : s.finalModes[other(side)]
            ? 'Второй командир уже сделал закрытый выбор. Теперь ваше решение.'
            : 'Оба командира ещё выбирают режим финала.'}
      </p>
      <ConfirmDialog
        open={!!choice && !saved}
        onClose={() => setChoice(null)}
        title={`Сохранить закрытый выбор ${choice ?? ''}?`}
        confirm={`Сохранить ${choice ?? ''}`}
        disabled={!!saved}
        onConfirm={() => send('finale_mode', { mode: choice })}
      >
        <p>
          {choice === 'PACT'
            ? 'PACT откроет кооперативный финал только при таком же выборе второго командира. Если другой командир выберет WAR, начнётся бой друг с другом.'
            : 'Ваш выбор WAR откроет бой командиров друг с другом независимо от решения второго игрока.'}
        </p>
        <p>
          Решение нельзя изменить после сохранения. До второго выбора соперник видит только факт
          готовности.
        </p>
      </ConfirmDialog>
    </section>
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
function InterdictView({ s, side, send }: Props) {
  const [asset, setAsset] = useState(''),
    b = s.battle!
  return (
    <section className="panel" id="interdict-panel">
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
    <section className="panel" id="assets-panel">
      <h3 className="rule-label">
        Assets после reveal <RuleHelp topic="preparation" />
      </h3>
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
    [actionHonour, setActionHonour] = useState(''),
    [die, setDie] = useState(3),
    [ack, setAck] = useState(false),
    [ruinsBonus, setRuinsBonus] = useState(false),
    [completionAck, setCompletionAck] = useState<Record<string, boolean>>({}),
    [actionUpgrades, setActionUpgrades] = useState<
      Record<string, { fieldEngineers?: boolean; ossuaryKey?: boolean }>
    >({})
  const o = t.objects.find((o) => o.id === object),
    options = o ? actionsFor(s, o) : []
  const n = nextStep(s, side)
  const startPayload = {
    actor,
    object,
    kind,
    eligible: true,
    inRange: true,
    deliveryEligible: true,
    advanced: actionHonour === 'secure_and_extract',
    actionShoot: ['operational_mastery', 'black_spear_veteran'].includes(actionHonour),
    actionHonour: actionHonour || undefined,
  }
  const startError =
    actor && object && kind && t.step === 'movement'
      ? battleCommandError(s, side, 'table_action', startPayload)
      : ''
  const selectObject = (id: string) => {
    const target = t.objects.find((o) => o.id === id)
    if (!target || target.disabled) return
    setObject(id)
    const actions = actionsFor(s, target)
    setKind(actions.length === 1 ? actions[0] : '')
  }
  return (
    <>
      <section className="panel battle-table-panel" id="table-panel">
        <div className="section-head">
          <h2>За столом</h2>
          <StatusBadge tone={n.waiting ? 'info' : 'ready'}>{TABLE_STEPS[t.step]}</StatusBadge>
        </div>
        <div className="battle-live-grid">
          <aside className="battle-mission-panel" aria-label="Оперативная карточка миссии">
            <p className="eyebrow">МИССИЯ · {b.mission ?? b.type}</p>
            <MissionBrief
              code={b.mission ?? b.type}
              exact={MISSION_CARDS[b.mission ?? '']?.body ?? CRISIS_CARDS[b.type] ?? crisisText(s)}
            />
            {b.effects.map((e, i) => (
              <p key={i}>
                <strong>{e.code}</strong> — {EVENTS[e.code]?.effect ?? e.code}
              </p>
            ))}
          </aside>
          <div className="battle-board">
            {t.round === 1 && t.step === 'start' && <FirstPlayer s={s} side={side} send={send} />}
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
                {t.objects.map((o) => (
                  <g
                    key={o.id}
                    role="button"
                    tabIndex={o.disabled ? -1 : 0}
                    aria-label={`Объект ${o.id} · ${o.kind}${o.disabled ? ' · отключён' : ''}`}
                    aria-disabled={o.disabled}
                    aria-pressed={object === o.id}
                    onClick={() => selectObject(o.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        selectObject(o.id)
                      }
                    }}
                  >
                    <title>
                      {o.id} · {o.kind} · {o.control ? labels[o.control] : 'без контроля'}
                    </title>
                    {object === o.id && (
                      <circle className="marker-selected" cx={o.x} cy={o.y} r={3.2} />
                    )}
                    {o.kind === 'objective' ? (
                      <circle cx={o.x} cy={o.y} r={2} className={o.control ?? 'neutral'} />
                    ) : o.kind === 'interaction' ? (
                      <rect
                        className={'mission-marker ' + (o.control ?? 'neutral')}
                        x={o.x - 1.5}
                        y={o.y - 1.5}
                        width={3}
                        height={3}
                        rx={0.2}
                      />
                    ) : (
                      <path
                        className={'mission-marker ' + (o.control ?? 'neutral')}
                        d={`M ${o.x} ${o.y - 1.8} l 1.8 1.8 l -1.8 1.8 l -1.8 -1.8 Z`}
                      />
                    )}
                    {o.disabled && (
                      <path
                        className="marker-disabled"
                        d={`M ${o.x - 1.7} ${o.y - 1.7} l 3.4 3.4 M ${o.x - 1.7} ${o.y + 1.7} l 3.4 -3.4`}
                      />
                    )}
                    <text x={o.x} y={o.y + 4}>
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
          </div>
          <aside className="battle-current-action">
            <p className="eyebrow">ТЕКУЩИЙ ШАГ</p>
            <h3>{TABLE_STEPS[t.step]}</h3>
            <p>{n.text}</p>
            <StatusBadge tone={n.waiting ? 'info' : 'ready'}>Ход {labels[t.turn]}</StatusBadge>
            {t.step !== 'finished' && (
              <TableAdvance key={s.version} s={s} side={side} send={send} />
            )}
            {object && (
              <p className="board-selection">
                Выбран объект <strong>{object}</strong>
              </p>
            )}
            <small>
              Круг — objective · квадрат — interaction · ромб — item. Контроль объектов сверяется с
              физическим столом.
            </small>
          </aside>
        </div>
        <details className="battle-object-controls">
          <summary>
            Контроль объектов · {t.objects.filter((o) => !o.disabled).length} активных
          </summary>
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
                  disabled={o.disabled || t.step === 'finished'}
                  value={o.control ?? ''}
                  change={(who) =>
                    send('table_controls', { controls: [{ id: o.id, side: who || null }] })
                  }
                  items={SIDES.map((id) => ({ id, name: labels[id] }))}
                />
                {o.disabled && <small>Отключённый объект не может менять контроль.</small>}
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
                      disabled={t.step === 'finished'}
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
        </details>
        {t.notes.length > 0 && (
          <div className="notice">
            {t.notes.map((n, i) => (
              <p key={i}>{n}</p>
            ))}
          </div>
        )}
      </section>
      {t.step === 'movement' && t.turn === side && (
        <section className="panel">
          <h3>Старт Named Action</h3>
          <div className="form-grid">
            <Options
              label="Actor persistent ID"
              value={actor}
              change={(id) => {
                setActor(id)
                setActionHonour('')
              }}
              items={b.muster[side]!.picks.filter(
                (p) => !(p.reserve || p.role === 'pool') || t.records[`entered:${p.id}`],
              ).map((p) => ({ id: p.id, name: unit(s, p.id).name }))}
            />
            <Options
              label="Объект"
              value={object}
              change={(v) => {
                selectObject(v)
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
          {actor && (
            <Options
              label="Кампанийное разрешение для Action"
              emptyLabel="Обычный Action"
              value={actionHonour}
              change={setActionHonour}
              items={[
                ...(['secure_and_extract', 'operational_mastery', 'black_spear_veteran'] as const)
                  .filter(
                    (id) =>
                      b.muster[side]!.picks.find((p) => p.id === actor)?.honours.includes(id) &&
                      !t.records[`use:${side}:${actor}:${id}`] &&
                      !['CLAIM', 'OVERRIDE ENGINE', 'PRIME ENGINE'].includes(kind),
                  )
                  .map((id) => ({
                    id,
                    name:
                      id === 'secure_and_extract'
                        ? 'Secure and Extract · после Advance, без Shoot/Charge'
                        : id === 'operational_mastery'
                          ? 'Operational Mastery · Action + Shoot с −1 Hit, без Charge'
                          : 'Black Spear Veteran · Action + Shoot, без Charge',
                  })),
              ]}
            />
          )}
          <Check
            label="За столом проверены eligibility, range, запреты Shoot/Charge и требуемый контроль"
            value={ack}
            change={setAck}
          />
          <button
            disabled={!ack || !actor || !object || !kind || !!startError}
            onClick={() => send('table_action', startPayload)}
          >
            Начать Action
          </button>
          {startError && <p className="validation">{startError}</p>}
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
            {!completionReady(t, a) ? (
              <p className="muted">
                Завершение доступно в {a.kind === 'COMMUNE' ? 'конце раунда' : 'конце своего хода'},
                после Charge и Fight.
              </p>
            ) : (
              <Check
                label="Условия успешного завершения проверены за столом"
                value={!!completionAck[a.id]}
                change={(v) => setCompletionAck({ ...completionAck, [a.id]: v })}
              />
            )}
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
            {b.muster[side]!.picks.find((p) => p.id === a.actor)?.honours.includes(
              'field_engineers',
            ) &&
              !t.records[`use:${side}:${a.actor}:field_engineers`] && (
                <Check
                  label="Применить Field Engineers · Jam, один раз за бой"
                  value={!!actionUpgrades[a.id]?.fieldEngineers}
                  change={(v) =>
                    setActionUpgrades({
                      ...actionUpgrades,
                      [a.id]: { ...actionUpgrades[a.id], fieldEngineers: v },
                    })
                  }
                />
              )}
            {unit(s, a.actor).relic === 'key' &&
              b.muster[side]!.picks.find((p) => p.id === a.actor)?.relic &&
              b.type !== 'PACT' &&
              !['CLAIM', 'OVERRIDE ENGINE', 'PRIME ENGINE'].includes(a.kind) &&
              !t.records[`use:${side}:${a.actor}:key`] && (
                <Check
                  label="Применить Ossuary Key · +1 VP, один раз за бой"
                  value={!!actionUpgrades[a.id]?.ossuaryKey}
                  change={(v) =>
                    setActionUpgrades({
                      ...actionUpgrades,
                      [a.id]: { ...actionUpgrades[a.id], ossuaryKey: v },
                    })
                  }
                />
              )}
            <div className="buttons">
              <button
                disabled={!completionReady(t, a) || !completionAck[a.id]}
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
                    fieldEngineers: !!actionUpgrades[a.id]?.fieldEngineers,
                    ossuaryKey: !!actionUpgrades[a.id]?.ossuaryKey,
                  })
                }
              >
                Подтвердить успешный completion
              </button>
              <button
                className="quiet"
                disabled={!completionReady(t, a)}
                onClick={() => send('table_complete', { id: a.id, success: false })}
              >
                Action сорван
              </button>
            </div>
          </section>
        ))}
      {t.step !== 'finished' && (
        <>
          <TableExtras s={s} side={side} send={send} />
          <MissionFacts s={s} side={side} send={send} />
        </>
      )}
    </>
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
      s as State & {
        preview?: { players: State['players']; units: State['units']; phase: State['phase'] }
      }
    ).preview
  return (
    <section className="panel" id="aftermath-panel">
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
          <AftermathSummary s={s} preview={preview} />
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
