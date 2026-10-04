import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { importLegacy } from '../shared/state'
import { startingArmy } from '../shared/setup'
import { context } from './fixture'

test('The isolated browser stack fixture applies every current migration and creates legal starter armies', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to authenticated;`)
    await db.exec(readFileSync('tests/e2e/legacy-schema.sql', 'utf8'))
    await db.exec(readFileSync('tests/fixtures/legacy-entrypoints.sql', 'utf8'))
    for (const file of readdirSync('supabase/migrations')
      .filter((f) => f.endsWith('.sql'))
      .sort())
      await db.exec(readFileSync('supabase/migrations/' + file, 'utf8'))
    const actor = '00000000-0000-4000-8000-000000000001'
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor])
    const campaign = (
      await db.query<{ id: string }>("select create_campaign('Browser fixture','necrons','One') id")
    ).rows[0].id
    const loaded = (
      await db.query<{ data: { baseline: Parameters<typeof importLegacy>[0] } }>(
        'select v221_load($1,$2) data',
        [campaign, actor],
      )
    ).rows[0].data
    const s = importLegacy(loaded.baseline, context('necrons'))
    for (const side of ['necrons', 'deathwatch'] as const)
      assert(startingArmy(s, side).effective >= 470)
    await db.query('select v221_initialize($1,$2,$3::jsonb)', [campaign, actor, JSON.stringify(s)])
    assert.equal(s.phase, 'setup')
  } finally {
    await db.close()
  }
})
