import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
const root = new URL('../', import.meta.url)
const names = [
  'supabase/functions/campaign-engine/index.ts',
  'supabase/functions/campaign-engine/deno.json',
  ...readdirSync(new URL('shared/', root))
    .filter((n) => n.endsWith('.ts') && !n.startsWith('reference.'))
    .map((n) => 'shared/' + n),
]
mkdirSync(new URL('tmp/', root), { recursive: true })
writeFileSync(
  new URL('tmp/edge-bundle.json', root),
  JSON.stringify(
    names.map((name) => ({ name, content: readFileSync(new URL(name, root), 'utf8') })),
  ),
)
console.log(`Edge bundle: ${names.length} files; no client or secrets included`)
