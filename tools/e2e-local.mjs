import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

// This command has no remote mode: it never links, deploys, or reads production credentials.
const stack = resolve('tmp/e2e-stack')
await mkdir(stack, { recursive: true })
const cli = resolve('node_modules/supabase/dist/supabase.js')
const run = (...args) =>
  execFileSync(process.execPath, [cli, ...args, '--workdir', stack], { stdio: 'inherit' })
try {
  await readFile(resolve(stack, 'supabase/config.toml'))
} catch {
  run('init')
}
const configPath = resolve(stack, 'supabase/config.toml')
let config = await readFile(configPath, 'utf8')
config = config
  .replace(/^project_id = .*$/m, 'project_id = "black-sepulchre-e2e"')
  .replace(/(\[db.seed\][\s\S]*?enabled = )true/, '$1false')
  .replace(/(\[auth.email\][\s\S]*?enable_confirmations = )true/, '$1false')
  .replace(/(\[analytics\][\s\S]*?enabled = )true/, '$1false')
if (!config.includes('[functions.campaign-engine]'))
  config += '\n[functions.campaign-engine]\nverify_jwt = true\n'
await writeFile(configPath, config)
await mkdir(resolve(stack, 'supabase/migrations'), { recursive: true })
const baseline = await readFile('tests/e2e/legacy-schema.sql', 'utf8')
const entrypoints = await readFile('tests/fixtures/legacy-entrypoints.sql', 'utf8')
await writeFile(
  resolve(stack, 'supabase/migrations/00000000000000_test_legacy_fixture.sql'),
  baseline + '\n' + entrypoints,
)
await cp('supabase/migrations', resolve(stack, 'supabase/migrations'), { recursive: true })
await cp('supabase/functions', resolve(stack, 'supabase/functions'), { recursive: true })
await cp('shared', resolve(stack, 'shared'), { recursive: true })
run('start', '--exclude', 'studio,postgres-meta,imgproxy,logflare,vector,supavisor')
const status = JSON.parse(
  execFileSync(process.execPath, [cli, 'status', '--output', 'json', '--workdir', stack], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  }),
)
const url = status.API_URL
if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname))
  throw Error('E2E only supports a local Supabase stack')
const env = {
  VITE_SUPABASE_URL: url,
  VITE_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
  E2E_SUPABASE_URL: url,
  E2E_SUPABASE_ANON_KEY: status.ANON_KEY,
  E2E_SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
}
if (Object.values(env).some((v) => !v)) throw Error('Supabase local status is missing credentials')
await writeFile(
  'tmp/e2e.env',
  Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n') + '\n',
)
console.log(
  'Local Auth, database and Realtime ready. Test configuration: tmp/e2e.env (git-ignored).',
)
