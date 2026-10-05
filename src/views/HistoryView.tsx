import { useEffect, useRef, useState } from 'react'
import { Archive, Download, List, Search } from 'lucide-react'
import { historySummary, ownHistory } from '../../shared/history'
import {
  battleChronicle,
  countText,
  filterChronicle,
  HISTORY_KINDS,
  historyKind,
  historyRows,
  missionTitle,
  PREPARATION,
  type HistoryKind,
} from '../../shared/chronicle'
import type { Side, State } from '../../shared/model'
import { stageFor } from '../../shared/rules'
import { ChronicleCard } from './ChronicleCard'
import { labels } from './common'

export function HistoryView({
  s,
  side,
  initialBattle = '',
}: {
  s: State
  side: Side
  initialBattle?: string
}) {
  const [battle, setBattle] = useState(initialBattle),
    [actor, setActor] = useState(''),
    [search, setSearch] = useState(''),
    [kind, setKind] = useState<HistoryKind>(''),
    [mode, setMode] = useState<'chronicle' | 'audit'>('chronicle'),
    [limit, setLimit] = useState(50)
  const timeline = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const track = timeline.current,
      selected = track?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')
    if (!track || !selected || track.scrollWidth <= track.clientWidth) return
    track.scrollTo({
      left:
        selected.getBoundingClientRect().left -
        track.getBoundingClientRect().left +
        track.scrollLeft -
        track.clientWidth / 2 +
        selected.offsetWidth / 2,
    })
  }, [battle])
  const groups = battleChronicle(s),
    rows = historyRows(s, { battle, actor, search, kind }),
    versions = new Set(rows.map((l) => l.version))
  const filtered = filterChronicle(groups, rows, { battle, actor, search, kind })
  const exports = ownHistory(s, side).filter((l) => versions.has(l.version))
  const reset = () => {
    setBattle('')
    setActor('')
    setSearch('')
    setKind('')
    setLimit(50)
  }
  const changeBattle = (value: string) => {
    setBattle(value)
    setLimit(50)
  }
  const download = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          { campaign: s.name, side, exportedAt: new Date().toISOString(), entries: exports },
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
      <div className="section-head history-heading">
        <div>
          <p className="eyebrow">АРХИВЫ KHARON SECUNDUS</p>
          <h2>Летопись кампании</h2>
        </div>
        <span className="muted">{s.battles} / 18 боёв завершено</span>
      </div>
      <div
        ref={timeline}
        className="history-timeline"
        role="group"
        aria-label="Выбрать бой в истории"
      >
        <button
          className={`quiet${!battle ? ' selected' : ''}`}
          onClick={() => changeBattle('')}
          aria-pressed={!battle}
        >
          Все
        </button>
        <button
          className={`quiet${battle === PREPARATION ? ' selected' : ''}`}
          onClick={() => changeBattle(PREPARATION)}
          aria-pressed={battle === PREPARATION}
        >
          Между боями
        </button>
        {Array.from({ length: 18 }, (_, i) => i + 1).map((number) => {
          const g = groups.find((g) => g.number === number),
            current = !!g && !!s.battle && g.id === s.battle.id && !g.battle?.aftermathApplied
          return (
            <button
              key={number}
              className={`quiet timeline-battle${number === 1 || stageFor(number - 1) !== stageFor(number - 2) ? ' stage-start' : ''}${current ? ' current-battle' : ''}${g?.battle?.type === 'encounter' || g?.battle?.terminal ? ' crisis-battle' : ''}${g && battle === g.id ? ' selected' : ''}`}
              disabled={!g}
              aria-label={`Бой ${number}${current ? ' · текущий' : ''}`}
              aria-pressed={!!g && battle === g.id}
              onClick={() => g && changeBattle(g.id)}
              title={
                g?.battle
                  ? missionTitle(g.battle)
                  : g
                    ? `Бой ${number}`
                    : 'Записей этого боя ещё нет'
              }
            >
              <span>{number}</span>
              {current && <i aria-hidden="true" />}
            </button>
          )
        })}
      </div>
      <div className="history-toolbar">
        <div className="history-modes" role="group" aria-label="Режим истории">
          <button
            className={`quiet${mode === 'chronicle' ? ' selected' : ''}`}
            aria-pressed={mode === 'chronicle'}
            onClick={() => setMode('chronicle')}
          >
            <Archive size={16} aria-hidden="true" />
            Летопись
          </button>
          <button
            className={`quiet${mode === 'audit' ? ' selected' : ''}`}
            aria-pressed={mode === 'audit'}
            onClick={() => setMode('audit')}
          >
            <List size={16} aria-hidden="true" />
            Журнал
          </button>
        </div>
        <button
          className="quiet history-download"
          disabled={!exports.length}
          onClick={download}
          title={
            !exports.length
              ? 'В текущих фильтрах нет ваших записей'
              : 'Скачать свои записи по текущим фильтрам'
          }
        >
          <Download size={15} aria-hidden="true" />
          Скачать мои записи · {exports.length}
        </button>
      </div>
      <div className="history-filters">
        <label className="history-search">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Поиск в истории</span>
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setLimit(50)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSearch('')
            }}
            placeholder="Действие, отряд, миссия или номер боя…"
          />
        </label>
        <label>
          Бой
          <select value={battle} onChange={(e) => changeBattle(e.target.value)}>
            <option value="">Все бои и подготовка</option>
            <option value={PREPARATION}>Действия между боями</option>
            {groups
              .filter((g) => g.number)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  Бой {g.number}
                  {g.battle ? ` · ${missionTitle(g.battle)}` : ''}
                </option>
              ))}
          </select>
        </label>
        <label>
          Сторона
          <select
            value={actor}
            onChange={(e) => {
              setActor(e.target.value)
              setLimit(50)
            }}
          >
            <option value="">Обе стороны</option>
            {Object.entries(labels).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Тип записи
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as HistoryKind)
              setLimit(50)
            }}
          >
            <option value="">Все действия</option>
            {Object.entries(HISTORY_KINDS).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="history-results">
        <span aria-live="polite">
          {mode === 'chronicle'
            ? countText(filtered.length, ['глава', 'главы', 'глав'])
            : countText(rows.length, ['запись', 'записи', 'записей'])}
          {battle || actor || kind || search ? ' по фильтрам' : ''}
        </span>
        {(battle || actor || kind || search) && (
          <button className="quiet" onClick={reset}>
            Сбросить фильтры
          </button>
        )}
      </div>
      {mode === 'chronicle' ? (
        <>
          <p className="history-note">
            Итоги и события из архива боя. Фильтры выбирают главы с подходящими записями; внутри
            главы показана полная история боя.
          </p>
          <div className="chronicle-grid">
            {filtered.map((g) => (
              <ChronicleCard
                key={g.id}
                group={g}
                onOpen={() => {
                  changeBattle(g.id)
                  setActor('')
                  setKind('')
                  setSearch('')
                  setMode('audit')
                }}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="history-note">
            Подробный журнал: версия, сторона, сохранённые броски и ресурсы до → после. Старые
            записи могут содержать только действие.
          </p>
          <div className="audit-list">
            {rows.slice(0, limit).map((l) => (
              <article className={`audit-entry ${l.actor}`} key={l.version}>
                <div className="audit-meta">
                  <span>
                    #{l.version} · {labels[l.actor]}
                    {l.battle ? ` · Бой ${l.battle.number}` : ' · Между боями'}
                  </span>
                  <span>{HISTORY_KINDS[historyKind(l.command)]}</span>
                </div>
                <strong>{historySummary(l)}</strong>
                <div className="audit-resources">
                  {l.resources
                    ?.filter((r) => r.supply[0] !== r.supply[1] || r.intel[0] !== r.intel[1])
                    .map((r) => (
                      <span key={r.side}>
                        {labels[r.side]} ·{' '}
                        {r.supply[0] !== r.supply[1] && (
                          <>
                            Supply {r.supply[0]} → {r.supply[1]}{' '}
                          </>
                        )}
                        {r.intel[0] !== r.intel[1] && (
                          <>
                            Intel {r.intel[0]} → {r.intel[1]}
                          </>
                        )}
                      </span>
                    ))}
                </div>
                {l.dice.length > 0 && <small>Броски: {l.dice.join(' · ')}</small>}
              </article>
            ))}
          </div>
          {rows.length > limit && (
            <button className="quiet audit-more" onClick={() => setLimit((v) => v + 50)}>
              Показать ещё {Math.min(50, rows.length - limit)} записей
            </button>
          )}
        </>
      )}
      {(mode === 'chronicle' ? !filtered.length : !rows.length) && (
        <div className="archive-empty">
          <Archive size={30} aria-hidden="true" />
          <h3>
            {s.log.length || s.history.length || s.battle
              ? 'Нет записей по этим фильтрам'
              : 'Летопись ещё не началась'}
          </h3>
          <p>
            {s.log.length || s.history.length || s.battle
              ? 'Измените поиск, сторону или тип действия.'
              : 'Первые решения командиров появятся здесь после сохранения.'}
          </p>
          {(battle || actor || kind || search) && (
            <button className="quiet" onClick={reset}>
              Показать всю историю
            </button>
          )}
        </div>
      )}
      <p className="history-note">
        Экспорт содержит только ваши записи, подходящие под фильтры, и ваши изменения ресурсов.
        Закрытые составы и решения сохраняют прежние ограничения видимости.
      </p>
    </section>
  )
}
