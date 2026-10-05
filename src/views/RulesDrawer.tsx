import { useEffect, useRef, useState } from 'react'
import { Search, Shield, X } from 'lucide-react'
import {
  findRule,
  RULE_ENTRIES,
  ruleVisible,
  searchRules,
  type RuleEntry,
} from '../content/rule-library'
import type { RuleTarget } from '../content/rule-topics'
import { RuleText } from './RuleText'

export default function RulesDrawer({
  target,
  currentMission,
  onEntryChange,
}: {
  target: RuleTarget
  currentMission?: string
  onEntryChange: (title: string) => void
}) {
  const [selected, setSelected] = useState<RuleEntry | undefined>(() => findRule(target))
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'human' | 'exact'>('human')
  const [spoilers, setSpoilers] = useState(false)
  const [selection, setSelection] = useState(0)
  const readingTitle = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (selection) readingTitle.current?.focus()
  }, [selection])
  const choose = (entry: RuleEntry) => {
    setSelected(entry)
    setQuery('')
    setSelection((n) => n + 1)
    onEntryChange(entry.title)
  }
  const searching = !!query.trim()
  const results = searching ? searchRules(query, spoilers) : []
  const visible = selected && ruleVisible(selected, spoilers, currentMission)
  return (
    <>
      <div className="rules-search">
        <label>
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Найти другое правило</span>
          <input
            type="search"
            value={query}
            placeholder="Найти другое правило…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && query) {
                e.preventDefault()
                e.stopPropagation()
                setQuery('')
              }
            }}
          />
        </label>
        {query && (
          <button
            type="button"
            className="quiet icon-button"
            aria-label="Очистить поиск правил"
            onClick={() => setQuery('')}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      {searching ? (
        <div className="rules-search-results">
          <p className="muted" role="status">
            Найдено: {results.length}
            {!spoilers && ' · кризис скрыт'}
          </p>
          {!results.length && (
            <p className="notice">Совпадений нет. Попробуйте название механики или код миссии.</p>
          )}
          {results.map((r) => (
            <button type="button" className="quiet" key={r.key} onClick={() => choose(r)}>
              <strong>{r.title}</strong>
              <span>
                {r.guide?.title ??
                  (r.book === 'missions' ? 'Карточка миссии' : 'Точная формулировка')}
              </span>
            </button>
          ))}
        </div>
      ) : !selected ? (
        <p className="notice">Раздел не найден. Найдите правило через поиск выше.</p>
      ) : !visible ? (
        <div className="rules-spoiler-gate">
          <Shield size={26} aria-hidden="true" />
          <h3>Этот раздел содержит спойлеры</h3>
          <p>
            Choir и финалы раскрываются по мере кампании. Для чтения всей истории включите спойлеры
            ниже.
          </p>
        </div>
      ) : (
        <article className="rules-reading" key={selected.key}>
          <p className="rules-source">{selected.title}</p>
          <div className="reference-modes buttons" role="group" aria-label="Способ чтения справки">
            <button
              type="button"
              className={mode === 'human' ? 'selected' : 'quiet'}
              aria-pressed={mode === 'human'}
              onClick={() => setMode('human')}
            >
              С пояснениями
            </button>
            <button
              type="button"
              className={mode === 'exact' ? 'selected' : 'quiet'}
              aria-pressed={mode === 'exact'}
              onClick={() => setMode('exact')}
            >
              Точные правила
            </button>
          </div>
          <h3 ref={readingTitle} tabIndex={-1}>
            {mode === 'human' ? (selected.guide?.title ?? selected.title) : selected.title}
          </h3>
          <RuleText
            body={mode === 'human' ? (selected.guide?.body ?? selected.body) : selected.body}
          />
          {mode === 'human' && selected.guide && (
            <details className="exact-rule">
              <summary>Точная формулировка: числа и исключения</summary>
              <RuleText body={selected.body} />
            </details>
          )}
          {target.startsWith('mission:') && selected.book === 'missions' && (
            <button
              type="button"
              className="quiet rules-related"
              onClick={() =>
                choose(RULE_ENTRIES.find((r) => r.key === 'core:Общие правила миссий')!)
              }
            >
              Общие правила: Actions и scoring →
            </button>
          )}
        </article>
      )}
      <label className="rules-spoiler-switch">
        <input type="checkbox" checked={spoilers} onChange={(e) => setSpoilers(e.target.checked)} />
        Показывать спойлеры кризиса
      </label>
    </>
  )
}
