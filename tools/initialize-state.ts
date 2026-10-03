import { readFileSync, writeFileSync } from 'node:fs'
import { randomInt, randomUUID } from 'node:crypto'
import { importLegacy } from '../shared/state.ts'
const raw = JSON.parse(
  readFileSync(new URL('../tmp/legacy-baseline.json', import.meta.url), 'utf8'),
)
if (
  raw.baseline.campaign.battle_count !== 0 ||
  raw.baseline.units.some((u: Record<string, unknown>) => u.xp !== 0 || u.damage !== 0)
)
  throw Error('Recheck migration review for a progressed campaign')
const state = importLegacy(raw.baseline, {
  actor: raw.side,
  dice: (sides) => randomInt(1, sides + 1),
  id: randomUUID,
})
const literal = (s: string) => "'" + s.replaceAll("'", "''") + "'"
writeFileSync(
  new URL('../tmp/initialize-state.sql', import.meta.url),
  `select public.v221_initialize(${literal(state.id)}::uuid,${literal(raw.actor)}::uuid,${literal(JSON.stringify(state))}::jsonb)->>'version' as initialized_version;`,
)
console.log('Prepared setup state with original persistent IDs and resources')
