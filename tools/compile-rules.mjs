import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
const root = new URL('../', import.meta.url)
const texts = Object.fromEntries(
  ['core', 'missions', 'crisis', 'reference'].map((k) => [
    k,
    readFileSync(new URL(`docs/Black_Sepulchre_v2.2.1_${k}_RU.md`, root), 'utf8').replace(
      /\r\n/g,
      '\n',
    ),
  ]),
)
const sections = Object.entries(texts).flatMap(([book, text]) =>
  text
    .split(/^# /m)
    .filter(Boolean)
    .map((s, i) => ({
      id: `${book}-${i}`,
      book,
      title: s.split('\n')[0].trim(),
      body: s.slice(s.indexOf('\n') + 1).trim(),
    })),
)
const missions = {}
for (const section of texts.missions.split(/^## /m).slice(1)) {
  const title = section.split('\n')[0].trim(),
    body = section
      .slice(section.indexOf('\n') + 1)
      .split('\n# ')[0]
      .trim()
  for (const code of title.match(/\b[A-K][1-3]\b/g) ?? []) missions[code] = { code, title, body }
}
function tableAfter(source, heading) {
  const p = source.indexOf(heading)
  return source
    .slice(p)
    .split('\n')
    .filter((l) => l.startsWith('|'))
    .slice(2)
    .map((l) =>
      l
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim()),
    )
}
const honours = []
for (const tier of ['Minor', 'Major', 'Signature']) {
  const rows = tableAfter(texts.core, `| ${tier} |`).slice(
    0,
    tier === 'Minor' ? 18 : tier === 'Major' ? 6 : 6,
  )
  for (const [label, effect] of rows)
    honours.push({
      id: label
        .replace(/ · Ф/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_'),
      name: label.replace(/ · Ф/g, ''),
      tier,
      formation: label.includes('· Ф'),
      character: effect.startsWith('CHARACTER'),
      side:
        tier === 'Signature' ? (effect.startsWith('Deathwatch') ? 'deathwatch' : 'necrons') : null,
      effect,
    })
}
const scars = {}
for (const side of ['deathwatch', 'necrons']) {
  const heading = side === 'deathwatch' ? '# Battle Scars · Deathwatch' : '# Battle Scars · Necrons'
  scars[side] = tableAfter(
    texts.core.slice(texts.core.indexOf(heading)).split('\n# ')[0],
    '| D12 / Scar |',
  )
    .slice(0, 12)
    .map(([label, effect]) => ({
      id: Number(label.match(/^\d+/)[0]),
      name: label.replace(/^\d+ /, ''),
      effect,
    }))
}
const events = Object.fromEntries(
  [...texts.reference.matchAll(/^\| ([1-6][1-6]) ([^|]+)\| ([^|]+)\|$/gm)].map((m) => [
    m[1],
    { code: m[1], name: m[2].trim(), effect: m[3].trim() },
  ]),
)
const equipment = Object.fromEntries(
  [
    ...tableAfter(texts.core, '| Armoury / Supply |').slice(0, 7),
    ...tableAfter(texts.core, '| D6 Relic |').slice(0, 6),
  ].map(([name, , effect]) => [name.replace(/^\d+ /, '').split(' · ')[0], effect]),
)
const assetRows = texts.core
  .split('\n')
  .filter((l) => /^\| (Defensive|Breach|Tactical) ·/.test(l))
  .map((l) =>
    l
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim()),
  )
const assetNames = {
  Barricades: 'barricades',
  'Mine Corridor': 'mines',
  'Reserve Beacon': 'beacon',
  'Hardened Stores': 'stores',
  Suppression: 'suppression',
  'Breach Charge': 'charge',
  'Infiltration Route': 'infiltration',
  'Extraction Beacon': 'extraction',
  'Smoke Screen': 'smoke',
  'Emergency Coordinates': 'coordinates',
  'Field Reserves': 'reserves',
  'Booby-trapped Objective': 'booby',
  'Hard Evacuation': 'evacuation',
}
const assets = Object.fromEntries(
  assetRows.map(([name, effect]) => [
    name.split(' · ')[0].toLowerCase() + ':' + assetNames[name.split(' · ')[1]],
    effect,
  ]),
)
mkdirSync(new URL('shared/', root), { recursive: true })
writeFileSync(
  new URL('shared/rules.generated.ts', root),
  `// Generated from the authoritative 2.2.1 Markdown. Run npm run rules.\nexport const MISSION_CARDS: Record<string,{code:string;title:string;body:string}> = ${JSON.stringify(missions)}\nexport const CRISIS_CARDS:Record<string,string> = ${JSON.stringify(
    {
      WAR: sections
        .filter((s) => s.title.startsWith('Финал WAR'))
        .map((s) => s.body)
        .join('\n\n'),
      PACT: sections
        .filter((s) => s.title.startsWith('Финал PACT'))
        .map((s) => s.body)
        .join('\n\n'),
    },
  )}\nexport const EQUIPMENT_EFFECTS:Record<string,string> = ${JSON.stringify(equipment)}\nexport const ASSET_EFFECTS:Record<string,string> = ${JSON.stringify(assets)}\nexport const HONOURS = ${JSON.stringify(honours)} as const\nexport const SCARS = ${JSON.stringify(scars)} as const\nexport const EVENTS: Record<string,{code:string;name:string;effect:string}> = ${JSON.stringify(events)}\n`,
)
writeFileSync(
  new URL('shared/reference.generated.ts', root),
  `// Generated rulebook, loaded only by the searchable reference.\nexport const RULE_SECTIONS = ${JSON.stringify(sections)} as const\n`,
)
// Website explanations are separate from the authoritative rules and engine data.
const guideText = readFileSync(
  new URL('docs/Black_Sepulchre_v2.2.1_guide_RU.md', root),
  'utf8',
).replace(/\r\n/g, '\n')
const guides = {}
for (const section of guideText.split(/^# /m).filter(Boolean)) {
  const heading = section.split('\n')[0].trim()
  const match = heading.match(/^(overview|core|reference|crisis|mission):(.+?) \| (.+)$/)
  if (!match) throw Error(`Invalid website guide heading: ${heading}`)
  const [, book, target, title] = match
  const body = section.slice(section.indexOf('\n') + 1).trim()
  if (!body) throw Error(`Empty website guide: ${heading}`)
  for (const name of book === 'mission' ? target.split(',') : [target]) {
    const key = `${book}:${name}`
    if (guides[key]) throw Error(`Duplicate website guide: ${key}`)
    guides[key] = { title, body }
  }
}
for (const section of sections.filter((s) => s.book !== 'missions')) {
  const key = `${section.book}:${section.title}`
  if (!guides[key]) throw Error(`Missing website explanation: ${key}`)
}
for (const code of Object.keys(missions)) {
  if (!guides[`mission:${code}`]) throw Error(`Missing mission explanation: ${code}`)
}
guides['mission:WAR'] = guides['crisis:Финал WAR · Один исходный шаблон']
guides['mission:PACT'] = {
  title: guides['crisis:Финал PACT · Две подписи'].title,
  body: `${guides['crisis:Финал PACT · Две подписи'].body}\n\n### Игра с Echo\n\n${guides['crisis:Финал PACT · Бой с проекциями'].body}`,
}
mkdirSync(new URL('src/content/', root), { recursive: true })
const encounterBody = texts.crisis.match(/^\*\*Forced Encounter:\*\* .+$/m)?.[0]
if (!encounterBody) throw Error('Missing authoritative Forced Encounter rules')
writeFileSync(
  new URL('src/content/rules-guide.generated.ts', root),
  `// Website explanations only; generated from docs/Black_Sepulchre_v2.2.1_guide_RU.md.\nexport const RULE_GUIDES: Record<string, {title:string;body:string}> = ${JSON.stringify(guides)}\nexport const EXTRA_MISSION_RULES = ${JSON.stringify({ encounter: { title: 'Forced Encounter · Вынужденный контакт', body: encounterBody } })} as const\n`,
)
if (
  Object.keys(missions).length !== 33 ||
  honours.length !== 30 ||
  Object.keys(events).length !== 36 ||
  scars.deathwatch.length !== 12 ||
  scars.necrons.length !== 12
)
  throw Error('Incomplete rules tables')
console.log('Compiled: 33 missions, 30 honours, 24 scars, 36 events')
