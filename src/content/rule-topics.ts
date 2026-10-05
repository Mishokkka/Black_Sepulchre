export const RULE_TOPICS = {
  prices: { label: 'AL, RC и Effective', section: 'core:Старт и армии' },
  supply: { label: 'Supplied и движение', section: 'core:Карта и стратегический ход' },
  actions: { label: 'Strategic Action', section: 'core:Actions и состояния' },
  local: { label: 'Local Supply и Commission', section: 'core:Экономика и Logistics' },
  recovery: { label: 'Recovery и Damage', section: 'core:Armoury, Relics и Damage' },
  garrison: { label: 'Initial и Pool', section: 'core:Гарнизон и последствия столкновения' },
  preparation: { label: 'Muster, Recon Lock и Assets', section: 'core:Подготовка боя и Assets' },
  honours: { label: 'Battle Honours', section: 'core:Battle Honours' },
  scarsDeathwatch: { label: 'Scars · Deathwatch', section: 'core:Battle Scars · Deathwatch' },
  scarsNecrons: { label: 'Scars · Necrons', section: 'core:Battle Scars · Necrons' },
  emergency: { label: 'Emergency Muster', section: 'reference:Emergency Muster' },
  missionBasics: { label: 'Actions и scoring миссии', section: 'core:Общие правила миссий' },
  siege: { label: 'Integrity и осада Home', section: 'core:Осада, отход и исход кампании' },
  choir: { label: 'Choir и Fragments', section: 'crisis:BLACK CHOIR · скрытая история' },
} as const

export type RuleTopic = keyof typeof RULE_TOPICS
export type RuleTarget = RuleTopic | `mission:${string}`

export function ruleTargetLabel(target: RuleTarget): string {
  return target.startsWith('mission:')
    ? `Миссия ${target.slice(8)}`
    : RULE_TOPICS[target as RuleTopic].label
}
