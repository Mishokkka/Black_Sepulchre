import { useMemo, useState } from 'react'
import Markdown from 'react-markdown'
import { RULE_SECTIONS } from '../../shared/reference.generated'
import type { State } from '../../shared/model'
import { Check } from './CampaignViews'
export default function ReferenceView({ s }: { s: State }) {
  const [query, setQuery] = useState(''),
    [spoilers, setSpoilers] = useState(false)
  const sections = useMemo(
    () =>
      RULE_SECTIONS.filter(
        (r) =>
          (spoilers || r.book !== 'crisis') &&
          `${r.title} ${r.body}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [query, spoilers],
  )
  return (
    <section className="panel reference">
      <div className="section-head">
        <h2>Единый свод 2.2.1</h2>
        <a href={`${import.meta.env.BASE_URL}rules.pdf`} target="_blank" rel="noreferrer">
          PDF правил ↗
        </a>
      </div>
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
        change={setSpoilers}
      />
      {sections.map((r) => (
        <details key={r.id}>
          <summary>{r.title}</summary>
          <Markdown>{r.body.replace(/^@\w+$/gm, '')}</Markdown>
        </details>
      ))}
    </section>
  )
}
