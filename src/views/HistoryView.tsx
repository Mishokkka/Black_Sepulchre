import { useState } from 'react'
import { historySummary, ownHistory } from '../../shared/history'
import type { Side, State } from '../../shared/model'
import { labels } from '../App'

export function HistoryView({ s, side }: { s: State; side: Side }) {
  const [battle, setBattle] = useState(''),
    [actor, setActor] = useState('')
  const battles = [
    ...new Map(s.log.filter((l) => l.battle).map((l) => [l.battle!.id, l.battle!])).values(),
  ]
  const rows = s.log
    .filter((l) => (!battle || l.battle?.id === battle) && (!actor || l.actor === actor))
    .slice()
    .reverse()
  const download = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            campaign: s.name,
            side,
            exportedAt: new Date().toISOString(),
            entries: ownHistory(s, side, battle),
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob),
      a = document.createElement('a')
    a.href = url
    a.download = `black-sepulchre-${side}-history.json`
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <section className="panel history-panel">
      <h2>История кампании</h2>
      <div className="columns">
        <label>
          Бой
          <select value={battle} onChange={(e) => setBattle(e.target.value)}>
            <option value="">Все бои и подготовка</option>
            {battles.map((b) => (
              <option key={b.id} value={b.id}>
                Бой {b.number}
              </option>
            ))}
          </select>
        </label>
        <label>
          Сторона
          <select value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="">Обе стороны</option>
            {Object.entries(labels).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button className="quiet" onClick={download}>
        Скачать мою историю{battle ? ' этого боя' : ''}
      </button>
      <p className="muted">
        В старых записях доступны действие и броски. Подробные изменения ресурсов записываются с
        этого обновления.
      </p>
      {rows.length ? (
        rows.map((l) => (
          <article className="history-entry" key={l.version}>
            <small>
              #{l.version} · {labels[l.actor]}
              {l.battle ? ` · Бой ${l.battle.number}` : ''}
            </small>
            <strong>{historySummary(l)}</strong>
            {l.resources
              ?.filter((r) => r.supply[0] !== r.supply[1] || r.intel[0] !== r.intel[1])
              .map((r) => (
                <small key={r.side}>
                  {labels[r.side]}: Supply {r.supply[0]} → {r.supply[1]}; Intel {r.intel[0]} →{' '}
                  {r.intel[1]}
                </small>
              ))}
            {l.dice.length > 0 && <small>Броски: {l.dice.join(', ')}</small>}
          </article>
        ))
      ) : (
        <p>Под выбранными фильтрами пока нет записей.</p>
      )}
    </section>
  )
}
