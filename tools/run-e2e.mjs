import { spawn } from 'node:child_process'
import { readFileSync, openSync, closeSync } from 'node:fs'
const env = Object.fromEntries(
  readFileSync('tmp/e2e.env', 'utf8')
    .trim()
    .split('\n')
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1)]
    }),
)
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(env.E2E_SUPABASE_URL).hostname))
  throw Error('Local stack required')
const log = openSync('tmp/e2e-functions.log', 'w')
const functions = spawn(
  process.execPath,
  ['node_modules/supabase/dist/supabase.js', 'functions', 'serve', '--workdir', 'tmp/e2e-stack'],
  { stdio: ['ignore', log, log], windowsHide: true },
)
let exit = 1
try {
  let ready = false
  for (let attempt = 0; attempt < 45; attempt++) {
    if (functions.exitCode !== null) throw Error('Edge runtime exited; see tmp/e2e-functions.log')
    try {
      const r = await fetch(`${env.E2E_SUPABASE_URL}/functions/v1/campaign-engine`, {
        method: 'OPTIONS',
      })
      if (r.status === 200) {
        ready = true
        break
      }
    } catch {
      /* The local runtime is still booting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  if (!ready) throw Error('Edge runtime unavailable; see tmp/e2e-functions.log')
  const playwright = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], {
    stdio: 'inherit',
    windowsHide: true,
  })
  exit = await new Promise((resolve) => playwright.on('exit', (code) => resolve(code ?? 1)))
} finally {
  functions.kill('SIGTERM')
  closeSync(log)
}
process.exitCode = exit
