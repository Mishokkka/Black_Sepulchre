import { HONOURS, SCARS, EQUIPMENT_EFFECTS, ASSET_EFFECTS } from '../../shared/rules.generated'
import { SIDES } from '../../shared/model'
import { ARMOURY, RELICS, armouryBlocked } from '../../shared/rules'
import { labels, type Props } from './common'
import { DatasheetView } from './DatasheetView'

export function BattlePacket({ s }: Props) {
  const b = s.battle!
  return (
    <details className="panel">
      <summary>Пакет боя · составы, улучшения и Assets</summary>
      <p>
        Одноразовые способности отмечайте за столом. Расходуемые средства с кампанийными
        последствиями указываются в итоговом отчёте.
      </p>
      {SIDES.map((who) => (
        <section key={who}>
          <h3>
            {labels[who]} · {b.forces?.[who] ?? 'mf'}
          </h3>
          {b.muster[who]?.picks.map((p) => {
            const u = b.before.find((u) => u.id === p.id)!
            return (
              <details key={p.id}>
                <summary>
                  {u.name} · {p.role} · {b.costs[p.id]} Effective · Damage {u.damage}
                </summary>
                <p>
                  Формация: {b.before.find((u) => u.id === p.formation)?.name ?? p.formation}
                  {p.transport
                    ? ' · В транспорте: ' + b.before.find((u) => u.id === p.transport)?.name
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
                    </p>
                  )
                })}
                {u.scars.map((sc) => {
                  const scar = SCARS[who].find((c) => c.id === sc.id)!
                  return (
                    <p key={sc.id}>
                      <strong>{scar.name}</strong> — {scar.effect}
                    </p>
                  )
                })}
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
                  </p>
                )}
                {p.relic && u.relic && (
                  <p>
                    <strong>{RELICS[u.relic].name}</strong> —{' '}
                    {EQUIPMENT_EFFECTS[RELICS[u.relic].name]}
                  </p>
                )}
                {p.enhancement && (
                  <p>
                    Enhancement: {b.snapshot.enhancements.find((e) => e.id === p.enhancement)?.name}
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
          }) ?? <p>Состав ещё закрыт.</p>}
          {b.assets[who] &&
            Object.entries(b.assets[who]!).flatMap(([list, ids]) =>
              ids.map((id) => (
                <p key={list + id}>
                  <strong>{id}</strong> — {ASSET_EFFECTS[list + ':' + id]}
                </p>
              )),
            )}
        </section>
      ))}
    </details>
  )
}
