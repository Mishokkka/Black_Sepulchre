import { ASSET_EFFECTS } from '../../shared/rules.generated'
import { SIDES, type State } from '../../shared/model'
import {
  ASSET_LABELS,
  ASSET_LISTS,
  ASSET_NOTES,
  ASSET_TIMING,
  type AssetList,
} from '../content/assets'
import { labels } from './common'

export function AssetRule({ list, id }: { list: AssetList; id: string }) {
  return (
    <div className="asset-rule">
      <small className="asset-timing">Когда: {ASSET_TIMING[id]}</small>
      <p>
        {list === 'tactical' && id === 'barricades'
          ? 'Разместите две области 6×2 дюйма в своей зоне расстановки, не ближе 3 дюймов к objectives. INFANTRY / BEAST / SWARM внутри получают обычный Cover; области не Obscuring.'
          : ASSET_EFFECTS[`${list}:${id}`]}
      </p>
      {ASSET_NOTES[id] && <p className="muted">{ASSET_NOTES[id]}</p>}
    </div>
  )
}

export function AssetGuide() {
  return (
    <details className="asset-guide">
      <summary>Как получить и применить Assets</summary>
      <p>
        Asset — поддержка только на этот бой. За Supply её не покупают: после раскрытия составов
        сайт выдаёт лимиты бесплатных выборов. Сначала решите Interdict, затем выберите до своего
        лимита. Можно взять меньше или ничего; неиспользованные выборы не копятся.
      </p>
      <dl>
        {Object.entries(ASSET_LISTS).map(([list, group]) => (
          <div key={list}>
            <dt>
              <strong>{group.name}</strong>
            </dt>
            <dd>{group.source}</dd>
          </div>
        ))}
      </dl>
      <p>
        Один Asset с одним именем нельзя повторять, даже из разных списков. Interdict стоит 2 Intel
        за один запрещённый вариант Tactical/Breach противника на этот бой; бесплатный пропуск
        сохраняет Intel. Defensive и обязательные эффекты миссии этим не запрещаются.
      </p>
      <p>
        Применяйте эффекты и отмечайте одноразовое использование за столом. Выбранные Assets
        останутся в памятке миссии. Данные для Casualty внесите в итоговый отчёт — расчёт сделает
        сайт.
      </p>
      <p>
        Формация — отряд на столе вместе с присоединёнными лидерами. Shooting/Fight activation —
        одно применение его стрельбы или ближнего боя. Cover — обычное укрытие; Casualty —
        послебоевая проверка потерь.
      </p>
    </details>
  )
}

export function ArmouryGuide() {
  return (
    <details className="asset-guide">
      <summary>Что я покупаю: Armoury, расходники и Assets</summary>
      <p>
        Assets выдаются бесплатно на один бой при его подготовке. Здесь за Supply покупаются
        предметы Armoury: у каждого non-Epic ID один слот. Покупка для ID сразу занимает слот;
        постоянный предмет сохраняется между боями, а использованный расходник освобождает слот.
      </p>
      <p>
        Покупка и выдача — в Logistics при Main Force в своём снабжаемом секторе, до объявления
        враждебного контакта. Предмет надо включить в состав боя в Muster: выключенный предмет
        занимает слот, но не даёт эффекта и CR. CR — добавка к очкам отряда в этом бою, не цена в
        Supply.
      </p>
      <p>
        Medicae и Recovery Cache можно купить на склад и затем выдать подходящему ID до фиксации
        состава. Medicae работает после бросков потерь; Cache выбирается при оплате лечения в
        Logistics. Scar, закрывающий слот, отключает и расходник. Отказ от предмета не возвращает
        Supply.
      </p>
      <p>
        Reserve Beacon в Armoury — покупка для одного ID; Defensive Reserve Beacon — отдельный
        бесплатный Asset на этот бой.
      </p>
    </details>
  )
}

export function SelectedAssets({ s }: { s: State }) {
  const b = s.battle!
  if (!SIDES.some((who) => Object.values(b.assets[who] ?? {}).some((ids) => ids.length)))
    return null
  return (
    <section className="selected-assets" aria-label="Памятка выбранных Assets">
      <h3>Assets этого боя · памятка применения</h3>
      <p>
        Эффекты разыгрывайте за столом в указанный момент. Одноразовое использование отмечайте у
        себя.
      </p>
      {SIDES.map((who) => {
        const chosen = Object.entries(b.assets[who] ?? {}).flatMap(([list, ids]) =>
          ids.map((id) => ({ list: list as AssetList, id })),
        )
        if (!chosen.length) return null
        return (
          <div key={who}>
            <h4>{labels[who]}</h4>
            <div className="asset-cards">
              {chosen.map(({ list, id }) => (
                <article className="asset-card" key={`${list}:${id}`}>
                  <strong>{ASSET_LABELS[id]}</strong>
                  <small>{ASSET_LISTS[list].name}</small>
                  <AssetRule list={list} id={id} />
                </article>
              ))}
            </div>
          </div>
        )
      })}
    </section>
  )
}
