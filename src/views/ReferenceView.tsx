import { useMemo, useState } from 'react'
import { RULE_GUIDES } from '../content/rules-guide.generated'
import { searchRules } from '../content/rule-library'
import type { State } from '../../shared/model'
import { Check } from './common'
import { RuleText } from './RuleText'
import { BookOpen, Search, X } from 'lucide-react'

const books = [
  { id: 'all', name: 'Все разделы' },
  { id: 'core', name: 'Механики кампании' },
  { id: 'missions', name: 'Миссии по секторам' },
  { id: 'reference', name: 'События и памятки' },
  { id: 'crisis', name: 'Кризис и финалы · спойлеры' },
]

export default function ReferenceView({ s }: { s: State }) {
  const [query, setQuery] = useState(''),
    [spoilers, setSpoilers] = useState(false),
    [book, setBook] = useState('all'),
    [mode, setMode] = useState<'human' | 'exact'>('human')
  const normalizedQuery = query.trim().toLocaleLowerCase('ru')
  const sections = useMemo(
    () => searchRules(normalizedQuery, spoilers, book),
    [normalizedQuery, spoilers, book],
  )
  return (
    <section className="reference reference-workspace">
      <header className="hero">
        <div>
          <p className="eyebrow">СПРАВОЧНИК КОМАНДИРА · 2.2.1</p>
          <h2>Правила кампании</h2>
          <p>
            Механики, миссии и памятки. Читайте объяснение с примерами или откройте точную
            формулировку.
          </p>
        </div>
        <a href={`${import.meta.env.BASE_URL}rules.pdf`} target="_blank" rel="noreferrer">
          PDF правил ↗
        </a>
      </header>
      <div className="reference-grid">
        <aside className="panel reference-navigation">
          <h3>
            <BookOpen size={18} /> Разделы свода
          </h3>
          <div className="reference-book-buttons" role="group" aria-label="Разделы правил">
            {books
              .filter((b) => spoilers || b.id !== 'crisis')
              .map((b) => (
                <button
                  key={b.id}
                  className="quiet"
                  aria-pressed={book === b.id}
                  onClick={() => setBook(b.id)}
                >
                  {b.name}
                </button>
              ))}
          </div>
          <label className="reference-book-select">
            Раздел
            <select value={book} onChange={(e) => setBook(e.target.value)}>
              {books
                .filter((b) => spoilers || b.id !== 'crisis')
                .map((b) => (
                  <option value={b.id} key={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
          </label>
          <Check
            label={`Показывать весь кризис (Choir ${s.choir}/8)`}
            value={spoilers}
            change={(show) => {
              setSpoilers(show)
              if (!show && book === 'crisis') setBook('all')
            }}
          />
          <small className="muted">
            {spoilers ? 'Сюжетные разделы и финалы открыты.' : 'Сюжетные разделы и финалы скрыты.'}
          </small>
        </aside>
        <div className="reference-content">
          <div className="panel reference-toolbar">
            <label htmlFor="reference-search">Поиск по правилам</label>
            <div className="reference-search">
              <Search size={18} aria-hidden="true" />
              <input
                id="reference-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setQuery('')
                }}
                placeholder="Local Supply, Recovery, CLAIM…"
              />
              {query && (
                <button
                  className="quiet"
                  aria-label="Очистить поиск правил"
                  onClick={() => setQuery('')}
                >
                  <X size={18} />
                </button>
              )}
            </div>
            <div className="buttons reference-modes" role="group" aria-label="Способ чтения правил">
              <button
                className={mode === 'human' ? 'selected' : 'quiet'}
                aria-pressed={mode === 'human'}
                onClick={() => setMode('human')}
              >
                С пояснениями
              </button>
              <button
                className={mode === 'exact' ? 'selected' : 'quiet'}
                aria-pressed={mode === 'exact'}
                onClick={() => setMode('exact')}
              >
                Точные правила
              </button>
            </div>
            <p className="muted" aria-live="polite">
              Разделов найдено: {sections.length}.
            </p>
          </div>
          {!normalizedQuery && book === 'all' && mode === 'human' && (
            <details className="panel guide-start">
              <summary>{RULE_GUIDES['overview:start'].title}</summary>
              <RuleText body={RULE_GUIDES['overview:start'].body} />
            </details>
          )}
          {!sections.length && (
            <div className="panel empty-state">
              <Search size={25} />
              <h3>Ничего не найдено</h3>
              <p>Попробуйте название действия, код миссии или другой раздел.</p>
              <button
                className="quiet"
                onClick={() => {
                  setQuery('')
                  setBook('all')
                }}
              >
                Сбросить поиск и раздел
              </button>
            </div>
          )}
          {sections.map((r) => (
            <details
              className="panel reference-chapter"
              key={`${mode}:${normalizedQuery}:${book}:${r.id}`}
              open={!!normalizedQuery && sections.length === 1}
            >
              <summary>
                {r.title}
                {mode === 'human' && r.guide && <small>{r.guide.title}</small>}
              </summary>
              {mode === 'human' && r.guide ? (
                <>
                  <RuleText body={r.guide.body} />
                  <details className="exact-rule">
                    <summary>Точная формулировка: числа и исключения</summary>
                    <RuleText body={r.body} />
                  </details>
                </>
              ) : (
                <RuleText body={r.body} />
              )}
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
