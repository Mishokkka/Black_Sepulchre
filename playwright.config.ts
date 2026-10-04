import { defineConfig } from '@playwright/test'
import { readFileSync } from 'node:fs'

// Local credentials only; production URL/keys never qualify for this suite.
for (const line of readFileSync('tmp/e2e.env', 'utf8').trim().split('\n')) {
  const i = line.indexOf('=')
  process.env[line.slice(0, i)] = line.slice(i + 1)
}
const url = new URL(process.env.E2E_SUPABASE_URL!)
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  throw Error('Refusing E2E against a remote database')
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120000,
  workers: 1,
  retries: 0,
  expect: { timeout: 15000 },
  use: { baseURL: 'http://127.0.0.1:4173/Black_Sepulchre/', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173/Black_Sepulchre/',
    reuseExistingServer: false,
    timeout: 120000,
  },
})
