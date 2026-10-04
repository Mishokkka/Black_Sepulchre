import { useState } from 'react'
import { SIDES } from '../../shared/model'
import { entry, unit } from '../../shared/rules'
import { Check, Options, type Props } from './common'
import { labels } from './common'

export function TableExtras({ s, side, send }: Props) {
  const b = s.battle!,
    t = b.table,
    [actor, setActor] = useState(''),
    [placed, setPlaced] = useState(true),
    [ack, setAck] = useState(false),
    [mode, setMode] = useState('instability'),
    [echo, setEcho] = useState('0'),
    [die, setDie] = useState(3)
  const picks = b.muster[side]!.picks,
    arrivals = picks.filter(
      (p) => (p.role === 'pool' || p.reserve) && !p.transport && !t.records[`entered:${p.id}`],
    )
  const declaration = t.records[`suppressActor:${side}:${t.round}`]
  return (
    <>
      {b.mission === 'H1' && t.step === 'start' && t.round === 1 && (
        <section className="panel">
          <h3>Закрытая Decoy-формация</h3>
          {b.decoys[side] ? (
            <p>Ваш Decoy зафиксирован.</p>
          ) : (
            <>
              <Options
                label="INFANTRY после deployment"
                value={actor}
                change={setActor}
                items={picks
                  .filter((p) => entry(s, unit(s, p.id)).keywords.includes('INFANTRY'))
                  .map((p) => ({ id: p.id, name: unit(s, p.id).name }))}
              />
              <button disabled={!actor} onClick={() => send('table_decoy', { actor })}>
                Запечатать Decoy
              </button>
            </>
          )}
        </section>
      )}
      {b.mission === 'H1' && b.decoys[side] && !t.records[`decoyShown:${side}`] && (
        <section className="panel">
          <h3>Раскрытие Decoy</h3>
          <p>
            После всех ranged attacks одной enemy unit дальше 12: формация делает legal Normal Move
            до 3 вне Engagement.
          </p>
          <button
            className="quiet"
            onClick={() => send('table_decoy_reveal', { attacksFinished: true })}
          >
            Атаки завершены → раскрыть
          </button>
        </section>
      )}
      {t.step === 'movement' &&
        t.turn === side &&
        !t.records.withdrawalSide &&
        arrivals.length > 0 && (
          <section className="panel">
            <h3>Прибытие подкреплений</h3>
            <p>
              Pool: один пакет в раунд с R
              {b.firstSlot + (b.effects.some((e) => e.code === '46') ? 1 : 0)}, wholly в 6 своей
              deployment edge и дальше 9 от enemy либо собственный Deep Strike. Initial Reserves
              используют официальный ingress и срок R3.
            </p>
            <Options
              label="Транспорт / Attached Unit / отдельный ID"
              value={actor}
              change={setActor}
              items={arrivals.map((p) => ({
                id: p.id,
                name: `${unit(s, p.id).name} · ${p.role === 'pool' ? 'Pool' : 'Initial Reserves'}`,
              }))}
            />
            <Check
              label="Пакет размещён целиком по legal ingress"
              value={placed}
              change={setPlaced}
            />
            <button
              disabled={!actor}
              onClick={() =>
                send(
                  picks.find((p) => p.id === actor)?.role === 'pool'
                    ? 'table_pool_arrival'
                    : 'table_reserve_arrival',
                  { actor, placed, legalIngress: placed },
                )
              }
            >
              {placed ? 'Зафиксировать прибытие' : 'Пропустить слот Pool этого раунда'}
            </button>
          </section>
        )}
      {side === b.attacker &&
        b.assets[side]?.breach.includes('suppression') &&
        t.step === 'movement' &&
        t.turn === b.defender &&
        !t.records.suppressionUsed && (
          <section className="panel">
            <h3>Suppression · Breach Asset</h3>
            <p>Пропустить один существующий слот Pool Defender. Пакет остаётся в Pool.</p>
            <button onClick={() => send('table_suppression')}>
              Потратить Suppression на этот слот
            </button>
          </section>
        )}
      {!['WAR', 'PACT'].includes(b.type) &&
        t.round >= 3 &&
        ((t.step === 'command' && t.turn === side) ||
          (t.step === 'movement' &&
            t.records.withdrawalSide &&
            t.records.withdrawalSide !== side &&
            !t.records.mutualWithdrawal)) && (
          <section className="panel">
            <h3>Добровольный отход</h3>
            <p>
              Эвакуация заканчивается в эту Movement. Wholly в 3 своей edge можно выйти; транспорт
              увозит груз. Оставшиеся ID уничтожены. Противник может сразу объявить взаимный отход.
            </p>
            <button className="danger" onClick={() => send('table_withdrawal')}>
              {t.records.withdrawalSide ? 'Ответить взаимным отходом' : 'Объявить Withdrawal'}
            </button>
          </section>
        )}
      {b.type === 'PACT' &&
        t.step === 'shooting' &&
        t.turn === side &&
        !t.records[`suppress:${side}:${t.round}`] && (
          <section className="panel">
            <h3>Suppress Echo · вместо всей стрельбы формации</h3>
            {declaration ? (
              <>
                <p>
                  Объявлено: {unit(s, String(declaration)).name} →{' '}
                  {t.records[`suppressMode:${side}:${t.round}`] === 'mute'
                    ? `Echo ${Number(t.records[`suppressTarget:${side}:${t.round}`]) + 1}`
                    : 'Instability −1'}
                  .
                </p>
                <label>
                  Теперь бросьте боевой D6
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={die}
                    onChange={(e) => setDie(Number(e.target.value))}
                  />
                </label>
                <button
                  onClick={() =>
                    send('table_suppress', {
                      actor: declaration,
                      die,
                      eligible: true,
                      inRange: true,
                      visible: true,
                    })
                  }
                >
                  Зафиксировать D6 · успех на 3+
                </button>
              </>
            ) : (
              <>
                <Options
                  label="Eligible to shoot, без Action; Engine в 18 и LoS"
                  value={actor}
                  change={setActor}
                  items={picks.map((p) => ({ id: p.id, name: unit(s, p.id).name }))}
                />
                <Options
                  label="Эффект до броска"
                  value={mode}
                  change={setMode}
                  items={[
                    { id: 'instability', name: 'Instability −1' },
                    { id: 'mute', name: 'Mute live Echo до конца раунда' },
                  ]}
                />
                {mode === 'mute' && (
                  <Options
                    label="Live Echo в 18 и LoS"
                    value={echo}
                    change={setEcho}
                    items={t.echoes.flatMap((e, i) =>
                      e.wounds > 0 ? [{ id: String(i), name: `Echo ${i + 1}` }] : [],
                    )}
                  />
                )}
                <Check label="Условия проверены за столом" value={ack} change={setAck} />
                <button
                  disabled={!actor || !ack}
                  onClick={() =>
                    send('table_suppress_prepare', {
                      actor,
                      mode,
                      index: Number(echo),
                      eligible: true,
                      inRange: true,
                      visible: true,
                      echoVisible: true,
                    })
                  }
                >
                  Объявить, затем бросить D6
                </button>
              </>
            )}
          </section>
        )}
    </>
  )
}

export function MissionFacts({ s, side, send }: Props) {
  const b = s.battle!,
    t = b.table
  const bool = (name: string, label: string) => (
    <Check
      key={name}
      label={label}
      value={t.records[`fact:${name}`] === true}
      change={(value) => send('table_fact', { name, value })}
    />
  )
  const count = (name: string, label: string, max = 10) => (
    <label key={name}>
      {label}
      <input
        type="number"
        min="0"
        max={max}
        value={Number(t.records[`fact:${name}`] ?? 0)}
        onChange={(e) => send('table_fact', { name, value: Number(e.target.value) })}
      />
    </label>
  )
  return (
    <details className="panel">
      <summary>Боевые факты текущей миссии</summary>
      {b.mission === 'B2' &&
        bool('choirB2', 'Bone Choir: hazard-тест провален на натуральной сумме 2')}
      {b.mission === 'F2' && bool('choirF2', 'Истинный Signal: actor провалил Battle-shock')}
      {b.mission === 'C3' &&
        SIDES.map((who) =>
          count(
            `stripKills:${who}:${t.round}`,
            `${labels[who]}: enemy persistent ID уничтожены на полосах в R${t.round}`,
            2,
          ),
        )}
      {b.mission === 'H3' && (
        <>
          {SIDES.map((who) =>
            count(
              `outsideKills:${who}:${t.round}`,
              `${labels[who]}: enemy ID уничтожены wholly вне safe radius в R${t.round}, включая hazard`,
              2,
            ),
          )}
          {SIDES.map((who) =>
            bool(
              `warlordSafe:${who}`,
              `${labels[who]}: Warlord закончил R5 внутри безопасной зоны`,
            ),
          )}
        </>
      )}
      {b.mission === 'I2' &&
        SIDES.flatMap((who) =>
          t.objects
            .filter((o) => !['overlay', 'index'].includes(o.id))
            .map((o) =>
              bool(
                `lanePresence:${who}:${o.id}:${t.round}`,
                `${labels[who]}: wholly на полосе ${o.id} в конце R${t.round}`,
              ),
            ),
        )}
      {['B1', 'D2'].includes(b.mission!) &&
        t.objects
          .filter((o) => o.carrier)
          .map((o) =>
            bool(
              `carrierAlive:${o.carrier}`,
              `${unit(s, o.carrier!).name}: живой носитель предмета в конце R5`,
            ),
          )}
      {b.type === 'PACT' && (
        <>
          {t.primes[side] && (
            <button
              className="danger"
              onClick={() => send('table_fact', { name: `prime_invalid:${side}`, value: true })}
            >
              Channeler двигался / Battle-shocked / погиб → отменить Prime
            </button>
          )}
          <p>Echo без legal placement остаётся погибшей при этом возврате.</p>
          {t.echoes.map((e, i) => (
            <Check
              key={i}
              label={`Echo ${i + 1}: placement заблокирован в текущем начале раунда`}
              value={e.blocked}
              change={(blocked) => send('echo_wounds', { index: i, wounds: e.wounds, blocked })}
            />
          ))}
        </>
      )}
      <p className="muted">
        Положение моделей, LoS и боевые броски проверяются за столом. Итоговые факты подтверждают
        оба командира.
      </p>
    </details>
  )
}
