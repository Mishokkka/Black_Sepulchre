import { useState } from 'react'
import { HONOURS, SCARS, EQUIPMENT_EFFECTS } from '../../shared/rules.generated'
import { honourEligible } from '../../shared/campaign-upgrades'
import { ARMOURY, entry, present, RELICS } from '../../shared/rules'
import { command } from '../../shared/engine'
import { logisticsForce } from '../../shared/logistics'
import { enhancementBearers, enhancementEligible } from '../../shared/enhancements'
import type { Unit } from '../../shared/model'
import { sizeKey, priceKey } from '../../shared/unit-choices'
import { LogisticsAction } from './LogisticsAction'
import { UnitChoice } from './UnitChoice'
import { Options, type Props } from './common'
export function UnitService({ s, side, send, u }: Props & { u: Unit }) {
  const [honour, setHonour] = useState(''),
    [item, setItem] = useState(''),
    [relic, setRelic] = useState(''),
    [scar, setScar] = useState(String(u.scars[0]?.id ?? '')),
    [recipient, setRecipient] = useState(''),
    [refitCatalog, setRefitCatalog] = useState(u.catalogId),
    [successor, setSuccessor] = useState(''),
    [deed, setDeed] = useState('HOLD')
  const p = s.players[side],
    selected = logisticsForce(s, side),
    serviceAt = selected === 'stf' ? p.stf : p.mf,
    here =
      !!serviceAt &&
      present(s, u) === serviceAt &&
      s.sectors[serviceAt].owner === side &&
      (u.location === 'garrison'
        ? serviceAt === p.mf
        : u.location === (selected === 'stf' ? 'stf' : 'field')),
    legal =
      s.phase === 'logistics' &&
      (s.activation?.logistics.includes(side) || s.battle?.logistics.includes(side))
  const refit = s.snapshot.catalog.find((c) => c.id === refitCatalog)
  const primary = u.flags.ammunitionDue
    ? 'ammo'
    : u.evacDebt
      ? 'evac'
      : u.damage
        ? u.flags.paidWindow
          ? 'overhaul'
          : 'recover'
        : 'commission'
  const changed =
    !!refit &&
    (sizeKey(refit) !== sizeKey(entry(s, u)) || priceKey(refit) !== priceKey(entry(s, u)))
  const refitPayload = {
    id: u.id,
    catalogId: refitCatalog,
    kind: refit?.models !== entry(s, u).models ? 'size' : 'loadout',
  }
  let refitCost = 0,
    refitProblem = ''
  if (changed) {
    try {
      const next = command(
        s,
        { type: 'refit', payload: refitPayload },
        { actor: side, dice: () => 1, id: () => 'preview' },
      )
      refitCost = p.supply - next.players[side].supply
    } catch (e) {
      refitProblem = (e as Error).message
    }
  }
  return (
    <fieldset className="unit-service" disabled={!here || !legal}>
      <p className="muted">
        {here
          ? u.location === 'stf'
            ? 'Обслуживание при STF. Armoury и Relics доступны при Main Force.'
            : 'Обслуживание при Main Force'
          : 'Для обслуживания своя Force должна быть в секторе ID.'}
      </p>
      <p className="service-window">
        Window для этого ID: Recovery {Number(!!u.flags.paidWindow)}/1 · Overhaul{' '}
        {Number(!!u.flags.overhaulWindow)}/1 · Rehab {Number(!!u.flags.rehabWindow)}/1
      </p>
      <div className="buttons">
        {u.damage > 0 && (
          <>
            <LogisticsAction
              s={s}
              side={side}
              send={send}
              type="recover"
              payload={{ id: u.id }}
              label="Recovery"
              quiet={primary !== 'recover'}
            />
            <LogisticsAction
              s={s}
              side={side}
              send={send}
              type="recover"
              payload={{ id: u.id, overhaul: true }}
              label="Overhaul"
              quiet={primary !== 'overhaul'}
            />
            <LogisticsAction
              s={s}
              side={side}
              send={send}
              type="recover"
              payload={{ id: u.id, cache: true }}
              label="Recovery с Cache"
              quiet
            />
          </>
        )}
        {u.flags.commission && (
          <LogisticsAction
            s={s}
            side={side}
            send={send}
            type="commission_buyout"
            payload={{ id: u.id }}
            label="Выкупить Commission"
            quiet={primary !== 'commission'}
          />
        )}
        {u.evacDebt > 0 && (
          <LogisticsAction
            s={s}
            side={side}
            send={send}
            type="pay_evac"
            payload={{ id: u.id }}
            label="Оплатить Evacuation"
            quiet={primary !== 'evac'}
          />
        )}
        {u.flags.ammunitionDue && (
          <>
            <LogisticsAction
              s={s}
              side={side}
              send={send}
              type="ammunition_choice"
              payload={{ id: u.id, pay: true }}
              label="Оплатить Ammunition"
              quiet={primary !== 'ammo'}
            />
            <button
              className="quiet"
              onClick={() => send('ammunition_choice', { id: u.id, pay: false })}
            >
              Принять штраф
            </button>
          </>
        )}
      </div>
      <details className="service-advanced">
        <summary>Honours, предметы и Rehabilitation</summary>
        <div className="form-grid">
          <div>
            <Options
              label="Honour в свободный слот"
              value={honour}
              change={setHonour}
              items={HONOURS.filter(
                (h) => honourEligible(h.id, entry(s, u)) && !u.honours.includes(h.id),
              ).map((h) => ({ id: h.id, name: `${h.name} · ${h.tier}${h.formation ? ' Ф' : ''}` }))}
            />
            {honour && (
              <>
                <p className="muted">
                  {HONOURS.find((h) => h.id === honour)?.effect} Активный эффект добавляет CR при
                  сборе на бой.
                </p>
                <LogisticsAction
                  s={s}
                  side={side}
                  send={send}
                  type="claim_honour"
                  payload={{ id: u.id, honour }}
                  label="Выбрать Honour"
                  quiet
                />
              </>
            )}
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
            {item && (
              <>
                <p className="muted">
                  {EQUIPMENT_EFFECTS[ARMOURY[item].name]}{' '}
                  {ARMOURY[item].tier
                    ? `${ARMOURY[item].tier}${ARMOURY[item].formation ? ' Ф' : ''} · CR при активации в составе.`
                    : 'Без CR.'}
                </p>
                <LogisticsAction
                  s={s}
                  side={side}
                  send={send}
                  type="buy_armoury"
                  payload={{ id: u.id, item }}
                  label="Купить Armoury"
                  quiet
                />
              </>
            )}
            {p.inventory.includes(item) && (
              <LogisticsAction
                s={s}
                side={side}
                send={send}
                type="assign_armoury"
                payload={{ id: u.id, item }}
                label="Выдать из inventory"
                quiet
              />
            )}
            {u.armoury && (
              <button className="quiet" onClick={() => send('discard_armoury', { id: u.id })}>
                Отказаться от предмета · без возврата Supply
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
                <p className="muted">
                  {u.scars.find((sc) => sc.id === Number(scar))?.progress
                    ? 'Progress: следующая попытка гарантирована за обычную цену.'
                    : u.flags.rehabLedger
                      ? 'Corpse Ledger: +1 к следующему броску.'
                      : 'Провал даст Progress. Повторная попытка доступна в новом Window.'}
                </p>
                <LogisticsAction
                  s={s}
                  side={side}
                  send={send}
                  type="rehabilitate"
                  payload={{ id: u.id, scar: Number(scar) }}
                  label={
                    u.scars.find((sc) => sc.id === Number(scar))?.progress
                      ? 'Rehab · гарантирован'
                      : u.flags.rehabLedger
                        ? 'Rehab · D6 2+'
                        : 'Rehab · D6 3+'
                  }
                  quiet
                />
                <LogisticsAction
                  s={s}
                  side={side}
                  send={send}
                  type="rehabilitate"
                  payload={{ id: u.id, scar: Number(scar), deep: true }}
                  label="Deep Rehabilitation"
                  quiet
                />
              </div>
            </div>
          )}
          {p.relics.length > 0 && (
            <div>
              <Options
                label="Relic со склада"
                value={relic}
                change={setRelic}
                items={[...new Set(p.relics)].map((id) => ({
                  id,
                  name: `${RELICS[id].name} · на складе ${p.relics.filter((v) => v === id).length}`,
                }))}
              />
              {relic && (
                <>
                  <p className="muted">
                    {EQUIPMENT_EFFECTS[RELICS[relic].name]}{' '}
                    {u.relic && `Прежняя реликвия ${RELICS[u.relic].name} вернётся на склад.`}
                  </p>
                  <LogisticsAction
                    s={s}
                    side={side}
                    send={send}
                    type="assign_relic"
                    payload={{ id: u.id, item: relic }}
                    label="Назначить Relic"
                    quiet
                  />
                </>
              )}
            </div>
          )}
        </div>
      </details>
      {u.retiredCatalog && (
        <div className="notice">
          <p>Datasheet убран из каталога. ID и XP сохранены.</p>
          <UnitChoice
            label="Successor той же роли"
            value={successor}
            change={setSuccessor}
            side={side}
            search
            catalog={s.snapshot.catalog.filter(
              (c) =>
                c.side === side &&
                c.character === u.retiredCatalog!.character &&
                c.garrison === u.retiredCatalog!.garrison,
            )}
          />
          <button
            className="quiet"
            disabled={!successor}
            onClick={() => send('resolve_retired', { id: u.id, catalogId: successor })}
          >
            Выбрать Successor
          </button>
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
        <p className="muted">
          Бесплатное вооружение меняйте в New Recruit. Здесь меняется размер или платная
          комплектация.
        </p>
        <UnitChoice
          label={`Refit: ${u.name}`}
          fixedDatasheet={entry(s, u).datasheet}
          side={side}
          catalog={s.snapshot.catalog}
          value={refitCatalog}
          change={setRefitCatalog}
        />
        <button
          className="quiet"
          disabled={!changed || !!refitProblem}
          onClick={() => send('refit', refitPayload)}
        >
          Применить Refit{changed && !refitProblem ? ` · ${refitCost} Supply` : ''}
        </button>
        {changed && refitProblem && <p className="validation">{refitProblem}</p>}
        <Options
          label="Deed of the Stage до первого боя"
          value={deed}
          change={setDeed}
          items={['HOLD', 'EXTRACT', 'OPERATE'].map((id) => ({ id, name: id }))}
        />
        <LogisticsAction
          s={s}
          side={side}
          send={send}
          type="stage_deed"
          payload={{ id: u.id, deed }}
          label="Закрепить Deed Stage"
          quiet
        />
        {u.relic && (
          <>
            <Options
              label="Передать Relic местному ID"
              value={recipient}
              change={setRecipient}
              items={s.units
                .filter(
                  (v) =>
                    v.side === side &&
                    v.status === 'active' &&
                    v.id !== u.id &&
                    !v.relic &&
                    !entry(s, v).epic &&
                    present(s, v) === p.mf,
                )
                .map((v) => ({ id: v.id, name: v.name }))}
            />
            {recipient && (
              <LogisticsAction
                s={s}
                side={side}
                send={send}
                type="transfer_relic"
                payload={{ from: u.id, to: recipient }}
                label="Передать Relic"
                quiet
              />
            )}
          </>
        )}
        {Object.entries(p.enhancements)
          .filter(([id]) => enhancementBearers(p, id).includes(u.id))
          .map(([id]) => (
            <EnhancementTransfer key={id} s={s} side={side} send={send} u={u} id={id} />
          ))}
        <button className="danger" onClick={() => send('disband', { id: u.id })}>
          Disband ID с положенным возвратом
        </button>
      </details>
    </fieldset>
  )
}

function EnhancementTransfer({ s, side, send, u, id }: Props & { u: Unit; id: string }) {
  const [to, setTo] = useState('')
  const p = s.players[side],
    e = s.snapshot.enhancements.find((e) => e.id === id)
  if (!e) return null
  return (
    <div>
      <Options
        label={`Передать Enhancement ${e.name}`}
        value={to}
        change={setTo}
        items={s.units
          .filter(
            (v) =>
              v.side === side &&
              v.id !== u.id &&
              v.status === 'active' &&
              present(s, v) === p.mf &&
              !enhancementBearers(p, id).includes(v.id) &&
              enhancementEligible(e, entry(s, v)),
          )
          .map((v) => ({ id: v.id, name: v.name }))}
      />
      {to && (
        <LogisticsAction
          s={s}
          side={side}
          send={send}
          type="transfer_enhancement"
          payload={{ enhancement: id, from: u.id, to }}
          label="Передать Enhancement"
          quiet
        />
      )}
    </div>
  )
}
