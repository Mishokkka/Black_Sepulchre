import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

test('source library: service-only RPCs, side isolation, immutable replay and quota', async () => {
  const db = new PGlite()
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema campaign_private;
    create table public.campaigns(id uuid primary key);
    create table public.campaign_members(campaign_id uuid,user_id uuid,side text);
    create table campaign_private.states(campaign_id uuid,state jsonb,version integer);
    grant usage on schema public to service_role,anon,authenticated;`)
  await db.exec(
    readFileSync(
      new URL('../supabase/migrations/20261003204258_new_recruit_library.sql', import.meta.url),
      'utf8',
    ),
  )
  const cid = '00000000-0000-4000-8000-000000000001',
    dw = '00000000-0000-4000-8000-000000000002',
    nc = '00000000-0000-4000-8000-000000000003',
    out = '00000000-0000-4000-8000-000000000004'
  await db.query('insert into campaigns values($1)', [cid])
  await db.query("insert into campaign_members values($1,$2,'deathwatch'),($1,$3,'necrons')", [
    cid,
    dw,
    nc,
  ])
  await db.query(
    'insert into campaign_private.states values($1,\'{"units":["original-id"]}\',17)',
    [cid],
  )
  const hash = 'a'.repeat(64),
    data = {
      schema: 'black-sepulchre.nr.v1',
      side: 'deathwatch',
      source: { hash },
      units: [{ id: 'source-selection' }],
    }
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`)
    await assert.rejects(db.query('select v221_list_imports($1,$2)', [cid, dw]), /permission/)
    await assert.rejects(
      db.query('select v221_save_import($1,$2,$3,$4)', [cid, dw, hash, data]),
      /permission/,
    )
    await assert.rejects(db.query('select * from campaign_private.source_imports'), /permission/)
    await db.exec('reset role')
  }
  await db.exec('set role service_role')
  const save = () =>
    db.query<{ v221_save_import: { reused: boolean; data: unknown } }>(
      'select v221_save_import($1,$2,$3,$4::jsonb)',
      [cid, dw, hash, JSON.stringify(data)],
    )
  assert.equal((await save()).rows[0].v221_save_import.reused, false)
  assert.equal((await save()).rows[0].v221_save_import.reused, true)
  const replay = await db.query<{ v221_save_import: { data: typeof data } }>(
    'select v221_save_import($1,$2,$3,$4::jsonb)',
    [cid, dw, hash, JSON.stringify({ ...data, units: [{ id: 'changed' }] })],
  )
  assert.equal(replay.rows[0].v221_save_import.data.units[0].id, 'source-selection')
  const list = async (actor: string) =>
    (
      await db.query<{ v221_list_imports: unknown[] }>('select v221_list_imports($1,$2)', [
        cid,
        actor,
      ])
    ).rows[0].v221_list_imports
  assert.equal((await list(dw)).length, 1)
  assert.equal((await list(nc)).length, 0)
  await assert.rejects(list(out), /member/)
  await assert.rejects(
    db.query('select v221_save_import($1,$2,$3,$4::jsonb)', [cid, nc, hash, JSON.stringify(data)]),
    /side/,
  )
  await assert.rejects(
    db.query('select v221_save_import($1,$2,$3,$4::jsonb)', [
      cid,
      dw,
      hash,
      JSON.stringify({ ...data, source: { hash: 'b'.repeat(64) } }),
    ]),
    /side/,
  )
  await assert.rejects(
    db.query('update campaign_private.source_imports set data=$1', [JSON.stringify(data)]),
    /permission/,
  )
  await assert.rejects(db.query('delete from campaign_private.source_imports'), /permission/)
  for (let i = 1; i < 30; i++) {
    const h = i.toString(16).padStart(64, '0')
    await db.query('select v221_save_import($1,$2,$3,$4::jsonb)', [
      cid,
      dw,
      h,
      JSON.stringify({ ...data, source: { hash: h } }),
    ])
  }
  await assert.rejects(
    db.query('select v221_save_import($1,$2,$3,$4::jsonb)', [
      cid,
      dw,
      'b'.repeat(64),
      JSON.stringify({ ...data, source: { hash: 'b'.repeat(64) } }),
    ]),
    /limit/,
  )
  assert.equal((await save()).rows[0].v221_save_import.reused, true)
  await db.exec('reset role')
  const state = (
    await db.query<{ version: number; state: { units: string[] } }>(
      'select * from campaign_private.states',
    )
  ).rows[0]
  assert.equal(state.version, 17)
  assert.deepEqual(state.state.units, ['original-id'])
  await db.close()
})
