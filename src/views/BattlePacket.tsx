import { useState } from 'react'
import { HONOURS, SCARS, EQUIPMENT_EFFECTS, ASSET_EFFECTS } from '../../shared/rules.generated'
import { SIDES } from '../../shared/model'
import { ARMOURY, RELICS, STAGES, armouryBlocked } from '../../shared/rules'
import { Options, type Props } from './common'
import { labels } from './common'
import { DatasheetView } from './DatasheetView'
import { scarHasOnceUse } from '../../shared/campaign-upgrades'
export function BattlePacket({ s, side, send }: Props) {
  const b = s.battle!,
    [extra, setExtra] = useState('')
  return (
    <details className="panel">
      <summary>Пакет боя · составы, улучшения и Assets</summary>
      <p>
        Поле{' '}
        {['WAR', 'PACT'].includes(b.type)
          ? '60 × 44'
          : `${STAGES[b.stage].l} × ${STAGES[b.stage].w}`}{' '}
        · AL {b.al}
      </p>
      {SIDES.map((who) => (
        <section key={who}>
          <h3>
            {labels[who]} · {b.forces?.[who] ?? 'mf'}
          </h3>
          {b.muster[who] ? (
            b.muster[who]!.picks.map((p) => {
              const u = b.before.find((u) => u.id === p.id)!
              return (
                <details key={p.id}>
                  <summary>
                    {u.name} · {p.role} · {b.costs[p.id]} Effective · Damage {u.damage}
                  </summary>
                  <p>
                    Формация: {b.before.find((u) => u.id === p.formation)?.name ?? p.formation}
                    {p.transport
                      ? ` · Cargo: ${b.before.find((u) => u.id === p.transport)?.name}`
                      : ''}
                    {p.reserve ? ' · Initial Reserves' : ''}
                  </p>
                  <DatasheetView
                    card={
                      b.snapshot.catalog.find((c) => c.id === u.catalogId)?.card ??
                      u.retiredCatalog?.card
                    }
                  />
                  {p.honours.map((id) => {
                    const h = HONOURS.find((h) => h.id === id)!
                    return (
                      <p key={id}>
                        <strong>{h.name}</strong> — {h.effect}
                        {[
                          'field_engineers',
                          'operational_mastery',
                          'black_spear_veteran',
                          'secure_and_extract',
                        ].includes(id) && (
                          <small>
                            {' '}
                            ·{' '}
                            {b.table.records[`use:${who}:${p.id}:${id}`]
                              ? 'Использовано'
                              : 'Отмечается при Action'}
                          </small>
                        )}
                        {who === side &&
                          s.phase === 'battle' &&
                          id !== 'dig_in' &&
                          ![
                            'field_engineers',
                            'operational_mastery',
                            'black_spear_veteran',
                            'secure_and_extract',
                          ].includes(id) && (
                            <button
                              className="quiet"
                              disabled={!!b.table.records[`use:${side}:${p.id}:${id}`]}
                              onClick={() => send('table_use', { actor: p.id, item: id })}
                            >
                              Отметить одноразовое использование
                            </button>
                          )}
                      </p>
                    )
                  })}
                  {u.scars.map((sc) => (
                    <p key={sc.id}>
                      <strong>{SCARS[who].find((c) => c.id === sc.id)!.name}</strong> —{' '}
                      {SCARS[who].find((c) => c.id === sc.id)!.effect}
                      {scarHasOnceUse(who, sc.id) && who === side && s.phase === 'battle' && (
                        <button
                          className="quiet"
                          disabled={!!b.table.records[`use:${side}:${p.id}:scar:${sc.id}`]}
                          onClick={() => send('table_use', { actor: p.id, item: `scar:${sc.id}` })}
                        >
                          Отметить одноразовый бонус шрама
                        </button>
                      )}
                    </p>
                  ))}
                  {p.armoury && u.armoury && (
                    <p>
                      <strong>{ARMOURY[u.armoury].name}</strong> —{' '}
                      {EQUIPMENT_EFFECTS[ARMOURY[u.armoury].name]}
                      {armouryBlocked(s, u) && (
                        <strong className="validation">
                          {' '}
                          · Заблокировано: эффект и CR отключены
                        </strong>
                      )}
                      {!armouryBlocked(s, u) &&
                        !ARMOURY[u.armoury].consumable &&
                        who === side &&
                        s.phase === 'battle' && (
                          <button
                            className="quiet"
                            disabled={
                              !!b.table.records[`use:${side}:${p.id}:${u.armoury}`] ||
                              !s.units.find((v) => v.id === p.id)?.armoury
                            }
                            onClick={() => send('table_use', { actor: p.id, item: u.armoury })}
                          >
                            Отметить одноразовое использование
                          </button>
                        )}
                    </p>
                  )}
                  {p.relic && u.relic && (
                    <p>
                      <strong>{RELICS[u.relic].name}</strong> —{' '}
                      {EQUIPMENT_EFFECTS[RELICS[u.relic].name]}
                      {u.relic === 'key' && (
                        <small>
                          {' '}
                          ·{' '}
                          {b.table.records[`use:${who}:${p.id}:key`]
                            ? 'Использовано'
                            : 'Отмечается при Action'}
                        </small>
                      )}
                      {u.relic !== 'key' && who === side && s.phase === 'battle' && (
                        <button
                          className="quiet"
                          disabled={!!b.table.records[`use:${side}:${p.id}:${u.relic}`]}
                          onClick={() => send('table_use', { actor: p.id, item: u.relic })}
                        >
                          Отметить одноразовое использование
                        </button>
                      )}
                    </p>
                  )}
                  {p.enhancement && (
                    <p>
                      Enhancement:{' '}
                      {b.snapshot.enhancements.find((e) => e.id === p.enhancement)?.name}
                    </p>
                  )}
                  {(b.snapshot.catalog.find((c) => c.id === u.catalogId)?.packageCosts ?? [])
                    .filter(
                      (o) =>
                        o.detachments.some((d) => b.muster[who]!.detachments.includes(d)) &&
                        (!o.optional || (p.paidOptions ?? []).includes(o.name)),
                    )
                    .map((o) => (
                      <p key={o.name}>
                        {o.name} · +{o.cost} очков на бой
                      </p>
                    ))}
                </details>
              )
            })
          ) : (
            <p>Состав ещё закрыт.</p>
          )}
          {b.assets[who] &&
            Object.entries(b.assets[who]!).flatMap(([list, ids]) =>
              ids.map((id) => (
                <p key={list + id}>
                  <strong>
                    {list} · {id}
                  </strong>{' '}
                  — {ASSET_EFFECTS[`${list}:${id}`]}
                </p>
              )),
            )}
        </section>
      ))}
      {b.table.records.defAssetDisabled && (
        <p className="notice">
          Четыре Home consoles отключены: Defensive Asset больше не действует.
        </p>
      )}
      {b.mission &&
        /^[AK]2$/.test(b.mission) &&
        side === b.attacker &&
        b.table.records.a2ExtraAsset &&
        !b.table.records.a2AssetChosen && (
          <div>
            <Options
              label="Дополнительный Tactical Asset от второго HACK"
              value={extra}
              change={setExtra}
              items={[
                { id: 'smoke', name: 'Smoke Screen' },
                { id: 'reserves', name: 'Field Reserves' },
                { id: 'evacuation', name: 'Hard Evacuation' },
              ]}
            />
            <button disabled={!extra} onClick={() => send('table_extra_asset', { asset: extra })}>
              Получить миссионный Asset
            </button>
          </div>
        )}
    </details>
  )
}
