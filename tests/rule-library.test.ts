import assert from 'node:assert/strict'
import test from 'node:test'
import { RULE_SECTIONS } from '../shared/reference.generated.ts'
import { MISSION_CARDS } from '../shared/rules.generated.ts'
import { RULE_TOPICS, type RuleTopic } from '../src/content/rule-topics.ts'
import { findRule, RULE_ENTRIES, ruleVisible, searchRules } from '../src/content/rule-library.ts'

test('contextual topics resolve to the authored exact source and explanation', () => {
  for (const topic of Object.keys(RULE_TOPICS) as RuleTopic[]) {
    const entry = findRule(topic)
    assert.ok(entry, topic)
    assert.ok(entry.guide, `${topic}: missing explanation`)
    if (topic !== 'emergency')
      assert.equal(
        entry.body,
        RULE_SECTIONS.find((r) => `${r.book}:${r.title}` === RULE_TOPICS[topic].section)?.body,
      )
  }
  assert.equal(new Set(RULE_ENTRIES.map((r) => r.key)).size, RULE_ENTRIES.length)
})

test('Emergency Muster exposes only its mechanical paragraph and authored explanation', () => {
  const entry = findRule('emergency')!
  assert.ok(entry.body.includes('**Emergency Muster**'))
  assert.ok(entry.body.includes('25 Supply'))
  assert.ok(entry.guide?.body.includes('целевой долг'))
  const source = RULE_SECTIONS.find((r) => r.title === 'Последний такт · подготовка к финалу')!
  assert.ok(source.body.includes(entry.body))
  assert.equal(entry.body.split('\n\n').length, 1)
  assert.equal(ruleVisible(entry, false), true)
  assert.ok(searchRules('Emergency Muster').some((r) => r.key === entry.key))
})

test('all mission aliases resolve, preserve sector preamble and share the authored guide', () => {
  for (const card of Object.values(MISSION_CARDS)) {
    const entry = findRule(`mission:${card.code}`)
    assert.ok(entry, card.code)
    assert.ok(entry.body.endsWith(card.body), card.code)
    assert.ok(entry.guide, card.code)
  }
  assert.equal(findRule('mission:A1'), findRule('mission:K1'))
  assert.equal(findRule('mission:A3'), findRule('mission:K3'))
  const region = RULE_SECTIONS.find((r) => r.book === 'missions' && r.title.startsWith('A / K'))!
  assert.ok(findRule('mission:K1')!.body.startsWith(region.body.split(/^## /m)[0].trim()))
  assert.ok(findRule('mission:encounter')?.guide)
  assert.equal(findRule('mission:unknown'), undefined)
})

test('crisis stays hidden in search until explicit opt-in, including its guide text', () => {
  const publicEntries = searchRules('')
  assert.ok(publicEntries.length > 0)
  assert.ok(publicEntries.every((r) => r.book !== 'crisis'))
  assert.equal(searchRules('', false, 'crisis').length, 0)
  assert.ok(searchRules('', true, 'crisis').length >= 5)
  assert.ok(searchRules('проекциями', false).every((r) => r.book !== 'crisis'))
  assert.ok(searchRules('проекциями', true).some((r) => r.book === 'crisis'))
  assert.equal(ruleVisible(findRule('choir')!, false), false)
})

test('the current final mission opens only its own rules without unlocking other spoilers', () => {
  const war = findRule('mission:WAR')!,
    pact = findRule('mission:PACT')!,
    choir = findRule('choir')!
  assert.equal(ruleVisible(war, false), false)
  assert.equal(ruleVisible(pact, false), false)
  assert.equal(ruleVisible(war, false, 'WAR'), true)
  assert.equal(ruleVisible(pact, false, 'WAR'), false)
  assert.equal(ruleVisible(pact, false, 'PACT'), true)
  assert.equal(ruleVisible(war, false, 'PACT'), false)
  assert.equal(ruleVisible(choir, false, 'PACT'), false)
  assert.equal(ruleVisible(choir, true), true)
})

test('search matches explanations case-insensitively with combined book filtering', () => {
  const entries = searchRules('  LOCAL SUPPLY  ', false, 'core')
  assert.ok(entries.some((r) => r.key === 'core:Экономика и Logistics'))
  assert.ok(entries.every((r) => r.book === 'core'))
  assert.ok(
    searchRules('Вынужденный контакт', false, 'missions').some((r) => r.id === 'mission:encounter'),
  )
  assert.equal(searchRules('nothing-matches-this-123').length, 0)
})
