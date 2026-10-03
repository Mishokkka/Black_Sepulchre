import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { createHash } from 'node:crypto'
import { parseNewRecruit } from '../shared/datasheets.ts'

// Local preparation only; never connects to Supabase or mutates the campaign.
const output = process.argv[2],
  files = process.argv.slice(3)
if (!output || !files.length)
  throw Error('Usage: tsx tools/prepare-import.ts OUTPUT_DIRECTORY INPUT.json [...]')
mkdirSync(output, { recursive: true })
for (const path of files) {
  const raw = readFileSync(path, 'utf8'),
    source = parseNewRecruit(raw, basename(path))
  source.source.hash = createHash('sha256').update(raw).digest('hex')
  const target = join(output, `${basename(path, '.json')}.normalized.json`)
  writeFileSync(target, JSON.stringify(source))
  console.log(
    JSON.stringify({
      file: basename(path),
      side: source.side,
      units: source.units.length,
      bytes: Buffer.byteLength(JSON.stringify(source)),
      hash: source.source.hash,
    }),
  )
}
