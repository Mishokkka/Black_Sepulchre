import { BattleHeader } from './BattleHeader'
import { MusterView } from './MusterView'
import { ResultView } from './ResultView'
import { ConfirmDialog } from './ConfirmDialog'
import { ReportView } from './ReportView'
export { ReportView } from './ReportView'
import { AftermathSummary } from './AftermathSummary'
import {
  SALVAGE_REWARDS,
  casualtyMeaning,
  CHOICE_LABELS,
  choiceNeedsUnit,
  choiceNeedsSector,
  choiceProblem,
} from '../../shared/aftermath-help'
import { battleCommandError } from '../../shared/battle-ui'
import { BattlePacket } from './BattlePacket'
import { TabletopMission } from './TabletopMission'
import { useState } from 'react'
import Markdown from 'react-markdown'
import { MissionBrief } from './MissionBrief'
import { EVENTS, MISSION_CARDS, CRISIS_CARDS } from '../../shared/rules.generated'
import { SIDES, other, type Side, type State } from '../../shared/model'
import { BREACH, DEFENSIVE, TACTICAL, unit, entry } from '../../shared/rules'
import { underdog } from '../../shared/muster'
import { labels } from './common'
import { Check, Options, type Props } from './common'
import { RuleHelp } from './RulesContext'
import { ASSET_LABELS, ASSET_LISTS, assetError, type AssetList } from '../content/assets'
import { AssetGuide, AssetRule } from './AssetGuide'
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
      {s.phase === 'interdict' && (
        <InterdictView key={`${b.id}:${side}`} s={s} side={side} send={send} />
      )}
      {s.phase === 'assets' && <AssetView key={`${b.id}:${side}`} s={s} side={side} send={send} />}
      {['battle', 'result', 'aftermath'].includes(s.phase) && (
        <BattlePacket s={s} side={side} send={send} />
      )}{' '}
      {s.phase === 'battle' && <TabletopMission s={s} />}
      {s.phase === 'battle' && (
        <details className="panel" id="report-entry">
          <summary>Внести результат боя</summary>
          <ReportView s={s} side={side} send={send} />
        </details>
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
  const b = s.battle!,
    saved = b.interdict[side] !== undefined,
    [asset, setAsset] = useState(b.interdict[side] ?? ''),
    error = saved ? '' : battleCommandError(s, side, 'interdict', { asset: asset || null })
  return (
    <section className="panel" id="interdict-panel">
      <h3>Interdict · запретить поддержку противника</h3>
      <p>
        Оба игрока одновременно выбирают по одному названию Tactical/Breach, которое противник не
        сможет взять на этот бой. Запрет стоит <strong>2 Intel</strong>, выбор своих Assets будет
        следующим шагом. Пропуск бесплатный. Ваш Intel: {s.players[side].intel}.
      </p>
      <p>
        Defensive и обязательные эффекты миссии запретить нельзя. Выбранный запрет после фиксации не
        меняется.
      </p>
      <AssetGuide />
      <Options
        label="Какой Tactical / Breach запретить противнику"
        emptyLabel="Без запрета · бесплатно"
        value={asset}
        change={setAsset}
        disabled={saved}
        items={[...new Set([...TACTICAL, ...BREACH])].map((id) => ({ id, name: ASSET_LABELS[id] }))}
      />
      {asset && (
        <article className="asset-card">
          <strong>Вы запретите: {ASSET_LABELS[asset]}</strong>
          <AssetRule list={TACTICAL.includes(asset) ? 'tactical' : 'breach'} id={asset} />
          <p>Эта поддержка будет недоступна противнику при выборе Tactical/Breach.</p>
        </article>
      )}
      <details className="asset-guide">
        <summary>Сравнить все варианты запрета</summary>
        <div className="asset-cards">
          {(['tactical', 'breach'] as const).flatMap((list) =>
            (list === 'tactical' ? TACTICAL : BREACH).map((id) => (
              <article className="asset-card" key={id}>
                <strong>{ASSET_LABELS[id]}</strong>
                <AssetRule list={list} id={id} />
              </article>
            )),
          )}
        </div>
      </details>
      {error && (
        <p className="validation" role="status">
          {error} Можно бесплатно пропустить запрет.
        </p>
      )}
      <button
        disabled={saved || !!error}
        onClick={() => send('interdict', { asset: asset || null })}
      >
        {asset ? 'Запретить · 2 Intel' : 'Пропустить Interdict'}
      </button>
      {saved && <p role="status">Ваше решение сохранено. Ожидается решение второго игрока.</p>}
    </section>
  )
}
function AssetView({ s, side, send }: Props) {
  const b = s.battle!,
    [a, setA] = useState(
      b.assets[side] ?? {
        tactical: [] as string[],
        defensive: [] as string[],
        breach: [] as string[],
      },
    ),
    saved = !!b.assets[side],
    budgets = {
      tactical: underdog(b, side),
      defensive: side === b.defender && b.defAsset ? 1 : 0,
      breach: side === b.attacker ? b.breaches : 0,
    },
    error = saved ? '' : assetError(battleCommandError(s, side, 'commit_assets', { assets: a }))
  return (
    <section className="panel" id="assets-panel">
      <h3 className="rule-label">
        Assets · бесплатная поддержка на этот бой <RuleHelp topic="preparation" />
      </h3>
      <p>
        Выберите до указанного числа в каждом списке. Supply и Intel за выбор не списываются. Можно
        ничего не брать. После фиксации выбор не меняется.
      </p>
      <p>
        Запрет противника:{' '}
        <strong>
          {b.interdict[other(side)] ? ASSET_LABELS[b.interdict[other(side)]!] : 'нет'}
        </strong>
        . Он касается только ваших Tactical/Breach.
      </p>
      <AssetGuide />
      <div className="asset-groups">
        {Object.entries({ tactical: TACTICAL, defensive: DEFENSIVE, breach: BREACH }).map(
          ([key, items]) => {
            const list = key as AssetList
            return (
              <details className="asset-group" key={list} open={budgets[list] > 0}>
                <summary>
                  {ASSET_LISTS[list].name} · выбрано {a[list].length} / {budgets[list]}
                </summary>
                <p className="muted">{ASSET_LISTS[list].source}</p>
                <div className="asset-cards">
                  {items.map((id) => {
                    const checked = a[list].includes(id),
                      candidate = { ...a, [list]: [...a[list], id] },
                      reason =
                        saved || checked
                          ? ''
                          : budgets[list] === 0
                            ? list === 'tactical'
                              ? 'В этом бою у вашей стороны нет бонуса Underdog.'
                              : list === 'defensive'
                                ? side !== b.defender
                                  ? 'Defensive выбирает только защитник.'
                                  : 'В этом бою нет работающего Fortified для Defensive.'
                                : side !== b.attacker
                                  ? 'Breach выбирает только атакующий.'
                                  : 'У этой цели нет Breach-выборов.'
                            : a[list].length >= budgets[list]
                              ? `Лимит ${budgets[list]} уже выбран. Снимите другой выбор в этом списке.`
                              : assetError(
                                  battleCommandError(s, side, 'commit_assets', {
                                    assets: candidate,
                                  }),
                                )
                    return (
                      <article className={`asset-card${checked ? ' chosen' : ''}`} key={id}>
                        <Check
                          label={ASSET_LABELS[id]}
                          value={checked}
                          disabled={saved || !!reason}
                          change={(v) =>
                            setA({
                              ...a,
                              [list]: v ? [...a[list], id] : a[list].filter((x) => x !== id),
                            })
                          }
                        />
                        <AssetRule list={list} id={id} />
                        {reason && <p className="asset-unavailable">Недоступно: {reason}</p>}
                      </article>
                    )
                  })}
                </div>
              </details>
            )
          },
        )}
      </div>
      {error && (
        <p className="validation" role="status">
          {error}
        </p>
      )}
      <button disabled={saved || !!error} onClick={() => send('commit_assets', { assets: a })}>
        {Object.values(a).some((ids) => ids.length)
          ? 'Зафиксировать Assets · бесплатно'
          : 'Продолжить без Assets'}
      </button>
      {saved && <p role="status">Ваши Assets сохранены. Ожидается второй игрок.</p>}
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
      s as State & {
        preview?: { players: State['players']; units: State['units']; phase: State['phase'] }
      }
    ).preview
  return (
    <section className="panel" id="aftermath-panel">
      <h2>После боя: потери, добыча и награды</h2>
      <p>
        Сайт уже сохранил броски. Обновление страницы не бросает их заново. Сначала посмотрите
        последствия, затем при желании потратьте Intel на переброс добычи или события, выберите
        награды и подтвердите итог вдвоём.
      </p>
      <h3>1 · Потери отрядов (Casualty)</h3>
      <p>
        Для каждого уничтоженного отряда: D6 + модификаторы. Это последствия для кампании, а не
        погибшие модели на столе. Обычного переброса Casualty здесь нет. Событие Recovery Crew может
        улучшить один результат на +1; поэтому Damage и шрамы ещё не применены.
      </p>
      {!b.casualties.length && <p>Отрядов, которым нужен бросок потерь, нет.</p>}
      <details>
        <summary>Как читать потери, Damage и Critical</summary>
        <p>
          Damage — постоянное повреждение отряда между боями (максимум 3). Шрам — отдельное
          постоянное последствие; его правило появится в итогах и карточке отряда. Сайт учитывает
          модификаторы за прежний Damage, эвакуацию, экипировку, события и отмеченные причины
          потерь. Чем выше итог броска, тем лучше.
        </p>
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <p key={n}>
            {n === 1 ? '1 и ниже' : n === 6 ? '6 и выше' : n}: {casualtyMeaning(n)}
          </p>
        ))}
        <p>
          Только CHARACTER при результате 0 или ниже дополнительно бросает Critical D6. Он добавляет
          последствия к обычным потерям. Сайт делает этот бросок после решений Recovery Crew и
          показывает результат при подготовке расчёта.
        </p>
        <p>
          Critical 1 — потеря навсегда или эвакуация с Damage 3, дополнительным шрамом и долгом;
          Epic Hero эвакуируется автоматически. 2 — Damage 3 и дополнительный шрам. 3 — Damage 3 и
          Systemic Damage. 4 — Damage 3 и Out of Action. 5 — ещё +1 XP. 6 — убрать 1 полученный
          Damage, не ниже значения до боя.
        </p>
        <p>Окончательные изменения, включая лечение и новые шрамы, проверьте в итоговом расчёте.</p>
      </details>
      {b.casualties.map((c) => (
        <p key={c.id}>
          {unit(s, c.id).name}: D6 {c.die} {c.modifier >= 0 ? '+' : ''}
          {c.modifier} · raw {c.die + c.modifier}
          {' → '}
          {casualtyMeaning(c.die + c.modifier, entry(s, unit(s, c.id), b.snapshot).character)}
          {c.critical ? ` · Critical D6: ${c.critical}` : ''}
        </p>
      ))}
      {!b.terminal && (
        <>
          <h3>2 · Добыча (Salvage)</h3>
          <p>
            Ваш D6:{' '}
            <strong>
              {b.salvage[side]} → {SALVAGE_REWARDS[b.salvage[side] - 1]}
            </strong>
            .
          </p>
          <p>
            Один добровольный переброс за 1 Intel: новый D6 заменит старый, даже если окажется хуже.
            Сохранить результат бесплатно — просто переходите к событию. Добыча добавляется к
            базовому доходу за бой.
          </p>
          <details>
            <summary>Все результаты добычи</summary>
            {SALVAGE_REWARDS.map((r, i) => (
              <p key={i}>
                D6 {i + 1}: {r}
              </p>
            ))}
          </details>
          <button
            className="quiet"
            disabled={
              b.salvageRerolled.includes(side) ||
              b.eventPass.length === 2 ||
              s.players[side].intel < 1
            }
            onClick={() => send('salvage_reroll')}
          >
            Перебросить · 1 Intel
          </button>
          <p className="muted">
            {b.salvageRerolled.includes(side)
              ? 'Ваш переброс уже использован.'
              : b.eventPass.length === 2
                ? 'Окно перебросов закрыто обоими игроками.'
                : s.players[side].intel < 1
                  ? 'Для переброса нужен 1 Intel.'
                  : 'Переброс доступен, пока оба игрока не приняли событие.'}
          </p>
          <h3>3 · Общее событие кампании (D66)</h3>
          <p>
            D66 — две шестигранные кости: первая даёт десятки, вторая единицы. Например, 3 и 3 →
            событие 33. Событие одно на двоих. Переброс за 2 Intel заменяет его для обоих; результат
            может стать хуже. Всего один такой переброс за бой. Принять событие бесплатно.
          </p>
          <p>
            {b.eventPass.length === 2
              ? 'Оба игрока приняли событие. Теперь распределите награды.'
              : `Сейчас решение принимает ${labels[b.eventOptions.length ? b.eventChooser : b.eventPass.length ? other(b.eventChooser) : b.eventChooser]}. Приняли: ${b.eventPass.map((who) => labels[who]).join(', ') || 'пока никто'}.`}
          </p>
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
                    s.players[side].intel < 2 ||
                    b.eventPass.length === 2 ||
                    b.eventRerolled ||
                    side !== (b.eventPass.length ? other(b.eventChooser) : b.eventChooser)
                  }
                  onClick={() => send('event_reroll')}
                >
                  Перебросить общее событие · 2 Intel
                </button>
                <button
                  disabled={
                    b.eventPass.includes(side) ||
                    side !== (b.eventPass.length ? other(b.eventChooser) : b.eventChooser)
                  }
                  onClick={() => send('event_pass')}
                >
                  Оставить событие · бесплатно
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
      <h3>4 · Итоговый расчёт</h3>
      {!preview && (
        <p>
          {!b.terminal && b.eventPass.length < 2
            ? 'Сначала оба командира должны принять событие.'
            : b.choices.some((c) => c.value === undefined)
              ? `Остались решения: ${b.choices
                  .filter((c) => c.value === undefined)
                  .map((c) => labels[c.side] + ' — ' + c.label)
                  .join('; ')}.`
              : 'Все решения сохранены. Подготовьте расчёт: сайт покажет изменения ресурсов, XP, Damage и шрамов до их применения.'}
        </p>
      )}
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
  const problem = choiceProblem(c, value, id, sector, s.players[side].supply)
  return (
    <div className="choice">
      <h4>{c.kind === 'deposit' ? '25 Local Supply · местное снабжение' : c.label}</h4>
      {c.kind === 'deposit' && (
        <p>
          Бесплатно разместите 25 Supply в одном из доступных снабжаемых секторов. Это местный запас
          сектора для гарнизона; он не списывается из обычного Supply. Сайт учтёт предельный запас.
        </p>
      )}
      {c.kind === '33' && (
        <p>
          Xenos Script даёт Necrons +1 XP одному выбранному своему отряду. Выберите получателя и
          сохраните. Deathwatch получает +1 Intel автоматически; дополнительный Supply зависит от
          контроля I/K.
        </p>
      )}
      {c.value !== undefined ? (
        <p>
          Сохранено: {CHOICE_LABELS[c.value] ?? c.value} {c.unit ? unit(s, c.unit).name : ''}{' '}
          {c.sector}
        </p>
      ) : (
        <>
          <Options
            label="Решение"
            value={value}
            change={setValue}
            items={c.options.map((id) => ({ id, name: CHOICE_LABELS[id] ?? id }))}
          />
          {choiceNeedsUnit(value) && c.unitIds.length > 0 && (
            <Options
              label="Отряд — получатель награды"
              value={id}
              change={setId}
              items={c.unitIds.map((id) => ({ id, name: unit(s, id).name }))}
            />
          )}{' '}
          {choiceNeedsSector(c, value) && c.sectorKeys.length > 0 && (
            <Options
              label="Сектор"
              value={sector}
              change={setSector}
              items={c.sectorKeys.map((id) => ({ id, name: id }))}
            />
          )}
          {['31', '56'].includes(c.kind) && (
            <p>Платный вариант стоит 10 Supply; отказ бесплатный.</p>
          )}
          {problem && (
            <p className="validation" role="status">
              {problem}
            </p>
          )}
          <button
            className="quiet"
            disabled={!!problem}
            onClick={() =>
              send('aftermath_choice', {
                key: c.key,
                value,
                unit: choiceNeedsUnit(value) ? id || undefined : undefined,
                sector: choiceNeedsSector(c, value) ? sector || undefined : undefined,
              })
            }
          >
            Сохранить выбор
          </button>
        </>
      )}
    </div>
  )
}
