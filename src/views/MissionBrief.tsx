import { EXTRA_MISSION_RULES, RULE_GUIDES } from '../content/rules-guide.generated'
import { RuleText } from './RuleText'

export function MissionBrief({ code, exact }: { code: string; exact: string }) {
  const guide = RULE_GUIDES[`mission:${code}`]
  const exactBody = code === 'encounter' ? EXTRA_MISSION_RULES.encounter.body : exact
  return (
    <>
      {guide && (
        <div className="mission-brief">
          <p className="eyebrow">КАК ИГРАТЬ ЭТУ МИССИЮ</p>
          <h3>{guide.title}</h3>
          <RuleText body={guide.body} />
          <p className="muted">Общие условия Actions и scoring действуют вместе с карточкой.</p>
        </div>
      )}
      {guide ? (
        <details className="exact-rule">
          <summary>Точная формулировка миссии: числа и исключения</summary>
          <RuleText body={exactBody} />
        </details>
      ) : (
        <RuleText body={exactBody} />
      )}
      <details className="mission-basics">
        <summary>Памятка: Actions, метки, scoring и носители</summary>
        <RuleText body={RULE_GUIDES['core:Общие правила миссий'].body} />
      </details>
    </>
  )
}
