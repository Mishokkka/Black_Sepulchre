import { RULE_SECTIONS } from '../../shared/reference.generated'
import { MISSION_CARDS } from '../../shared/rules.generated'
import { EXTRA_MISSION_RULES, RULE_GUIDES } from './rules-guide.generated'
import { RULE_TOPICS, type RuleTarget, type RuleTopic } from './rule-topics'

export type RuleEntry = {
  id: string
  key: string
  book: string
  title: string
  body: string
  guide?: { title: string; body: string }
}

const seenMissions = new Set<string>()
// This mechanical rule is needed before a forced battle. Show only its authored
// paragraph, rather than revealing the surrounding final-act narrative.
const emergencySource = RULE_SECTIONS.find(
  (r) => r.title === 'Последний такт · подготовка к финалу',
)!
const emergencyBody = emergencySource.body
  .split('\n\n')
  .find((p) => p.startsWith('Нельзя превратить отсутствие available ID'))!
const emergencyGuide = RULE_GUIDES['crisis:Последний такт · подготовка к финалу'].body
  .split('\n\n')
  .find((p) => p.includes('**Emergency Muster**'))!
export const RULE_ENTRIES: RuleEntry[] = [
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
  { id: 'reference:emergency', book: 'reference', title: 'Emergency Muster', body: emergencyBody },
  ...RULE_SECTIONS.filter((r) => r.book === 'reference' || r.book === 'crisis'),
].map((r) => {
  const key = r.book === 'missions' ? r.id : `${r.book}:${r.title}`
  return {
    ...r,
    key,
    guide:
      r.id === 'reference:emergency'
        ? { title: 'Законный состав для обязательного боя', body: emergencyGuide }
        : RULE_GUIDES[key],
  }
})

export function findRule(target: RuleTarget): RuleEntry | undefined {
  if (!target.startsWith('mission:'))
    return RULE_ENTRIES.find((r) => r.key === RULE_TOPICS[target as RuleTopic]?.section)
  const code = target.slice(8)
  if (code === 'WAR' || code === 'PACT')
    return RULE_ENTRIES.find(
      (r) =>
        r.key ===
        (code === 'WAR'
          ? 'crisis:Финал WAR · Один исходный шаблон'
          : 'crisis:Финал PACT · Две подписи'),
    )
  // A/K missions share a card; both codes must resolve to the same source and guide.
  const title = MISSION_CARDS[code]?.title
  return RULE_ENTRIES.find((r) => r.id === target || (r.book === 'missions' && r.title === title))
}

export function ruleVisible(entry: RuleEntry, spoilers: boolean, currentMission?: string): boolean {
  return (
    entry.book !== 'crisis' ||
    spoilers ||
    (currentMission === 'WAR' && entry.key === 'crisis:Финал WAR · Один исходный шаблон') ||
    (currentMission === 'PACT' && entry.key === 'crisis:Финал PACT · Две подписи')
  )
}

export function searchRules(query: string, spoilers = false, book = 'all'): RuleEntry[] {
  const needle = query.trim().toLocaleLowerCase('ru')
  return RULE_ENTRIES.filter(
    (r) =>
      ruleVisible(r, spoilers) &&
      (book === 'all' || r.book === book) &&
      `${r.title} ${r.body} ${r.guide?.title ?? ''} ${r.guide?.body ?? ''}`
        .toLocaleLowerCase('ru')
        .includes(needle),
  )
}
