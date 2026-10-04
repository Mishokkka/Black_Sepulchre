import { useMemo, useState } from 'react'
import { RULE_SECTIONS } from '../../shared/reference.generated'
import { MISSION_CARDS } from '../../shared/rules.generated'
import { EXTRA_MISSION_RULES, RULE_GUIDES } from '../content/rules-guide.generated'
import type { State } from '../../shared/model'
import { Check } from './common'
import { RuleText } from './RuleText'

const books = [
  { id: 'all', name: 'Все разделы' },
  { id: 'core', name: 'Механики кампании' },
  { id: 'missions', name: 'Миссии по секторам' },
  { id: 'reference', name: 'События и памятки' },
  { id: 'crisis', name: 'Кризис и финалы · спойлеры' },
]
const seenMissions = new Set<string>()
const entries = [
  ...RULE_SECTIONS.filter((r) => r.book === 'core'),
  ...Object.values(MISSION_CARDS)
    .filter((card) => {
      if (seenMissions.has(card.title)) return false
      seenMissions.add(card.title)
      return true
    })
    .map((card) => {
      const region = RULE_SECTIONS.find(
        (section) => section.book === 'missions' && section.body.includes(`## ${card.title}`),
      )
      const preamble = region?.body.split(/^## /m)[0].trim()
      return {
        id: `mission:${card.code}`,
        book: 'missions',
        ...card,
        body: preamble ? `${preamble}\n\n${card.body}` : card.body,
      }
    }),
  ...Object.entries(EXTRA_MISSION_RULES).map(([code, card]) => ({
    id: `mission:${code}`,
    book: 'missions',
    ...card,
  })),
  ...RULE_SECTIONS.filter((r) => r.book === 'reference' || r.book === 'crisis'),
].map((r) => ({
  ...r,
  guide: RULE_GUIDES[r.book === 'missions' ? r.id : `${r.book}:${r.title}`],
}))

export default function ReferenceView({ s }: { s: State }) {
  const [query, setQuery] = useState(''),
    [spoilers, setSpoilers] = useState(false),
    [book, setBook] = useState('all'),
    [mode, setMode] = useState<'human' | 'exact'>('human')
  const normalizedQuery = query.trim().toLocaleLowerCase('ru')
  const sections = useMemo(
    () =>
      entries.filter(
        (r) =>
          (spoilers || r.book !== 'crisis') &&
          (book === 'all' || r.book === book) &&
          `${r.title} ${r.body} ${r.guide?.title} ${r.guide?.body}`
            .toLocaleLowerCase('ru')
            .includes(normalizedQuery),
      ),
    [normalizedQuery, spoilers, book],
  )
  return (
    <section className="panel reference">
      <div className="section-head">
        <h2>Правила кампании · 2.2.1</h2>
        <a href={`${import.meta.env.BASE_URL}rules.pdf`} target="_blank" rel="noreferrer">
          PDF правил ↗
        </a>
      </div>
      <p>
        Здесь — объяснение механик и миссий с примерами. Пояснения следуют действующим правилам;
        точные ограничения можно открыть в каждом разделе.
      </p>
      <details
        className="guide-start"
        open={!normalizedQuery && book === 'all' && mode === 'human'}
      >
        <summary>{RULE_GUIDES['overview:start'].title}</summary>
        <RuleText body={RULE_GUIDES['overview:start'].body} />
      </details>
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
      <label>
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
      <label>
        Поиск по правилам
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Local Supply, Recovery, CLAIM…"
        />
      </label>
      <Check
        label={`Показывать весь кризис (Choir ${s.choir}/8)`}
        value={spoilers}
        change={(show) => {
          setSpoilers(show)
          if (!show && book === 'crisis') setBook('all')
        }}
      />
      <p className="muted" aria-live="polite">
        Разделов найдено: {sections.length}.
        {!spoilers && ' Кризис скрыт, пока вы не включите спойлеры.'}
      </p>
      {!sections.length && (
        <p className="notice">
          Ничего не найдено. Попробуйте название действия, код миссии или другой раздел.
        </p>
      )}
      {sections.map((r) => (
        <details key={`${mode}:${r.id}`} open={!!normalizedQuery}>
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
    </section>
  )
}
