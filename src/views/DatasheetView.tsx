import type { DataProfile, DatasheetCard, Equipment } from '../../shared/datasheets'

export function ProfileTable({ profiles }: { profiles: DataProfile[] }) {
  const keys = [...new Set(profiles.flatMap((p) => Object.keys(p.values)))].filter(
    (k) => !/description/i.test(k),
  )
  if (!profiles.length) return null
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Профиль</th>
            {keys.map((k) => (
              <th key={k}>{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {profiles.map((p, i) => (
            <tr key={i}>
              <td>{p.name}</td>
              {keys.map((k) => (
                <td key={k}>{p.values[k] ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
function Gear({ gear, card }: { gear: Equipment[]; card: DatasheetCard }) {
  return (
    <>
      {gear
        .filter((e) => e.count > 0)
        .map((e, i) => (
          <div className="gear" key={i}>
            <h4>
              {e.count} × {e.name}
            </h4>
            <ProfileTable
              profiles={e.profiles
                .map((id) => card.profiles[id])
                .filter((p) => p && /weapons/i.test(p.type))}
            />
            {e.profiles
              .filter((id) => card.profiles[id] && !/weapons/i.test(card.profiles[id].type))
              .map((id) => (
                <Ability key={id} p={card.profiles[id]} />
              ))}
          </div>
        ))}
    </>
  )
}
function Ability({ p }: { p: DataProfile }) {
  return (
    <details>
      <summary>{p.name}</summary>
      {Object.entries(p.values).map(([k, v]) => (
        <p className="ability-text" key={k}>
          {v}
        </p>
      ))}
    </details>
  )
}
export function DatasheetView({ card }: { card?: DatasheetCard }) {
  if (!card)
    return (
      <small>
        Профили ещё не добавлены. Выберите экспорт во вкладке «Каталог» и обновите этот вариант
        каталога.
      </small>
    )
  const seen = new Set<string>(),
    abilities = [
      ...card.unitProfiles,
      ...card.rules,
      ...card.models.flatMap((g) => g.abilities),
    ].filter(
      (id) =>
        card.profiles[id] &&
        !/Unit|Weapons/.test(card.profiles[id].type) &&
        !seen.has(id) &&
        !!seen.add(id),
    )
  return (
    <div className="datasheet">
      {card.models.map((g) => (
        <section className="model-group" key={g.id}>
          <h4>
            {g.count} × {g.name}
          </h4>
          <small>{g.keywords.join(' · ')}</small>
          {g.stats.length ? (
            <ProfileTable profiles={g.stats.map((id) => card.profiles[id]).filter(Boolean)} />
          ) : (
            <p className="validation">Нет statline — нужно сопоставление</p>
          )}
          <Gear gear={g.equipment} card={card} />
        </section>
      ))}
      <Gear gear={card.equipment} card={card} />
      {abilities.length > 0 && (
        <details>
          <summary>Способности и правила ({abilities.length})</summary>
          {abilities.map((id) => (
            <Ability key={id} p={card.profiles[id]} />
          ))}
        </details>
      )}
      <small>{card.unitKeywords.join(' · ')}</small>
      <p className="muted">
        {card.source.provider ?? 'New Recruit'} · каталог {card.source.catalogueRevision} · система{' '}
        {card.source.gameRevision}
        <br />
        Проверено по: {card.reviewedAgainst || 'ещё не проверено'}
        {card.source.url && (
          <>
            {' '}
            ·{' '}
            <a href={card.source.url} target="_blank" rel="noreferrer">
              Источник
            </a>
          </>
        )}
      </p>
    </div>
  )
}
