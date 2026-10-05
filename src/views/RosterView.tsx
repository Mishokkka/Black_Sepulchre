import { useEffect, useMemo, useState } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { ARMOURY, RELICS } from '../../shared/rules'
import { filterRoster, rosterUnits, unitAttention } from '../../shared/roster'
import { entry, available } from '../../shared/rules'
import { HONOURS, SCARS } from '../../shared/rules.generated'
import { DatasheetView } from './DatasheetView'
import { UnitService } from './UnitService'
import { UnitCard } from './UnitCard'
import { ForceBudgets } from './ForceBudgets'
import { labels, type Props } from './common'
const emptyFilters = { search: '', location: '', status: '', role: '', sort: 'name' }
export function RosterView({
  s,
  side,
  send,
  requestedUnit,
  embedded = false,
}: Props & { requestedUnit?: { id: string; request: number }; embedded?: boolean }) {
  const [opponent, setOpponent] = useState(false),
    [filters, setFilters] = useState(emptyFilters),
    [opened, setOpened] = useState<string[]>([])
  const who = opponent ? (side === 'deathwatch' ? 'necrons' : 'deathwatch') : side
  const all = useMemo(() => rosterUnits(s, who), [s, who]),
    units = useMemo(() => filterRoster(s, who, filters), [s, who, filters])
  useEffect(() => {
    if (!requestedUnit) return
    setOpponent(false)
    setFilters(emptyFilters)
    setOpened((v) => (v.includes(requestedUnit.id) ? v : [...v, requestedUnit.id]))
    const frame = requestAnimationFrame(() => {
      const card = document.getElementById(`unit-${requestedUnit.id}`)
      card?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      })
      card?.querySelector('summary')?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [requestedUnit])
  const reset = () => setFilters(emptyFilters)
  return (
    <section className="panel roster-browser" aria-label="Браузер армии">
      <div className="section-head">
        <div>
          <p className="eyebrow">СИЛЫ КАМПАНИИ</p>
          <h2>Армия · {labels[who]}</h2>
        </div>
        <button
          className="quiet"
          onClick={() => {
            setOpponent(!opponent)
            reset()
            setOpened([])
          }}
        >
          {opponent ? 'Своя армия' : 'Армия противника'}
        </button>
      </div>
      {!embedded && <ForceBudgets s={s} side={who} />}
      <div className="roster-totals">
        <span>{all.length} отрядов</span>
        <span>{all.filter((u) => available(s, u) && !u.damage).length} готовы</span>
        <span>{all.filter((u) => unitAttention(s, u).length).length} требуют внимания</span>
        <small>RC — стоимость записей; CR проверяется для боевого состава.</small>
      </div>
      <div className="roster-filters">
        <label className="roster-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Поиск отряда</span>
          <input
            aria-label="Поиск отряда"
            value={filters.search}
            placeholder="Имя, datasheet, сектор или ID"
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </label>
        {[
          [
            'location',
            'Размещение',
            [
              ['', 'Все силы'],
              ['field', 'Main Force'],
              ['stf', 'STF'],
              ['garrison', 'Гарнизон'],
            ],
          ],
          [
            'status',
            'Состояние',
            [
              ['', 'Все состояния'],
              ['ready', 'Готов'],
              ['damaged', 'Повреждён'],
              ['unavailable', 'Недоступен'],
              ['attention', 'Требует внимания'],
            ],
          ],
          [
            'role',
            'Тип отряда',
            [
              ['', 'Все типы'],
              ['character', 'Character'],
              ['battleline', 'Battleline'],
              ['other', 'Другие'],
            ],
          ],
          [
            'sort',
            'Сортировка',
            [
              ['name', 'По имени'],
              ['rc', 'По RC ↓'],
              ['xp', 'По XP ↓'],
              ['damage', 'По Damage ↓'],
            ],
          ],
        ].map(([key, label, items]) => (
          <label key={String(key)}>
            {String(label)}
            <select
              aria-label={String(label)}
              value={filters[key as keyof typeof filters]}
              onChange={(e) => setFilters({ ...filters, [String(key)]: e.target.value })}
            >
              {(items as string[][]).map(([value, name]) => (
                <option value={value} key={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="roster-results">
        <span>
          <SlidersHorizontal size={14} aria-hidden="true" />
          Показано {units.length} из {all.length}
        </span>
        {JSON.stringify(filters) !== JSON.stringify(emptyFilters) && (
          <button className="quiet" onClick={reset}>
            Сбросить фильтры
          </button>
        )}
      </div>
      <div className="roster-list">
        {units.map((u) => (
          <UnitCard
            key={u.id}
            s={s}
            u={u}
            expanded={opened.includes(u.id)}
            onToggle={(open) =>
              setOpened((v) =>
                open ? (v.includes(u.id) ? v : [...v, u.id]) : v.filter((id) => id !== u.id),
              )
            }
          >
            {!opponent && s.phase === 'logistics' && (
              <UnitService s={s} side={side} send={send} u={u} />
            )}
            <details className="unit-reference">
              <summary>Datasheet · профили и вооружение</summary>
              <DatasheetView card={entry(s, u).card} />
            </details>
            {(u.honours.length > 0 || u.scars.length > 0) && (
              <details className="unit-reference">
                <summary>Honours и Scars · эффекты</summary>
                {u.honours.map((id) => {
                  const h = HONOURS.find((h) => h.id === id)
                  return (
                    <p key={id}>
                      <strong>{h?.name ?? id}</strong> — {h?.effect}
                    </p>
                  )
                })}
                {u.scars.map((sc) => {
                  const d = SCARS[u.side].find((v) => v.id === sc.id)
                  return (
                    <p key={sc.id}>
                      <strong>{d?.name ?? sc.id}</strong> — {d?.effect}
                      {sc.progress ? ' · Rehab Progress' : ''}
                    </p>
                  )
                })}
              </details>
            )}
            <p className="unit-equipment">
              Armoury: {u.armoury ? ARMOURY[u.armoury]?.name : '—'} · Relic:{' '}
              {u.relic ? RELICS[u.relic]?.name : '—'}
            </p>
            <details className="unit-reference">
              <summary>Постоянный ID</summary>
              <code>{u.id}</code>
            </details>
          </UnitCard>
        ))}
      </div>
      {!units.length && (
        <div className="roster-empty">
          <Search size={24} aria-hidden="true" />
          <h3>{all.length ? 'Нет отрядов по этим условиям' : 'Список армии пуст'}</h3>
          <p>
            {all.length
              ? 'Измените запрос или сбросьте фильтры.'
              : 'Здесь появятся приобретённые отряды кампании.'}
          </p>
          {all.length > 0 && (
            <button className="quiet" onClick={reset}>
              Сбросить фильтры
            </button>
          )}
        </div>
      )}
    </section>
  )
}
