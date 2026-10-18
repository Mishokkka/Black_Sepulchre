import { missionInputs } from '../../shared/tabletop-report'
import type { Battle, Report, State } from '../../shared/model'
import { Check, Options } from './common'

export function MissionReportFacts({
  s,
  b,
  report,
  change,
}: {
  s: State
  b: Battle
  report: Report
  change: (v: Report['facts']) => void
}) {
  return (
    <div className="mission-report-facts">
      <p>
        Укажите только выполненные условия. Обычные броски и VP уже учтены вами за столом; сайт
        начислит кампанийные награды один раз после подтверждения.
      </p>
      {missionInputs(s, b, report).map((f) =>
        f.kind === 'check' ? (
          <Check
            key={f.key}
            label={f.label}
            value={report.facts[f.key] === true}
            change={(v) => change({ ...report.facts, [f.key]: v })}
          />
        ) : f.kind === 'count' ? (
          <label key={f.key}>
            {f.label}
            <input
              type="number"
              min="0"
              max={f.max}
              value={Number(report.facts[f.key] ?? 0)}
              onChange={(e) => change({ ...report.facts, [f.key]: Number(e.target.value) })}
            />
          </label>
        ) : (
          <Options
            key={f.key}
            label={f.label}
            emptyLabel="Не выполнялся"
            value={String(report.facts[f.key] ?? '')}
            change={(v) => change({ ...report.facts, [f.key]: v })}
            items={f.ids!.map((id) => ({ id, name: b.before.find((u) => u.id === id)!.name }))}
          />
        ),
      )}
    </div>
  )
}
