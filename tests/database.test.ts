import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
test('SQL migration enforces membership, private state, replay and optimistic commit', async () => {
  const db = new PGlite()
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated;create table public.campaigns(id uuid primary key,invite_code text default 'INVITE',rules_version text,status text,battle_count integer,stage_index smallint,black_choir smallint,active_side text,winner_side text);create table public.campaign_members(campaign_id uuid,user_id uuid,side text);grant select on campaign_members to authenticated;`,
  )
  for (const table of [
    'players',
    'sectors',
    'units',
    'activations',
    'battles',
    'campaign_events',
    'reactions',
    'resource_ledger',
    'audit_log',
    'recon_scar_commitments',
    'interdict_commitments',
  ])
    await db.exec(
      `create table public.${table}(id uuid,campaign_id uuid,created_at timestamptz default now());`,
    )
  await db.exec(
    `create table public.battle_units(id uuid,battle_id uuid);create function public.join_campaign(p_invite_code text,p_display_name text) returns uuid language plpgsql security definer as $$declare cid uuid;begin select id into cid from public.campaigns where invite_code=p_invite_code;insert into public.campaign_members values(cid,auth.uid(),'necrons');update public.campaigns set status='setup' where id=cid;return cid;end$$;`,
  )
  await db.exec(
    readFileSync(
      new URL('../supabase/migrations/20261003182938_rules_221_state_engine.sql', import.meta.url),
      'utf8',
    ),
  )
  const cid = '00000000-0000-4000-8000-000000000001',
    actor = '00000000-0000-4000-8000-000000000002',
    outsider = '00000000-0000-4000-8000-000000000003',
    request = '00000000-0000-4000-8000-000000000004'
  await db.query(
    `insert into campaigns(id,rules_version,status,battle_count) values($1,'2.1','setup',0)`,
    [cid],
  )
  await db.query(`insert into campaign_members values($1,$2,'deathwatch')`, [cid, actor])
  await db.query('insert into units(id,campaign_id) values($1,$2)', [actor, cid])
  const state = {
    id: cid,
    rules: '2.2.1',
    version: 0,
    phase: 'setup',
    battles: 0,
    stage: 0,
    choir: 0,
    active: 'deathwatch',
    winner: null,
    log: [],
  }
  await assert.rejects(db.query('select v221_load($1,$2)', [cid, outsider]), /member/)
  await db.query('select v221_initialize($1,$2,$3::jsonb)', [cid, actor, JSON.stringify(state)])
  assert.equal(
    (await db.query<{ rules_version: string }>('select rules_version from campaigns')).rows[0]
      .rules_version,
    '2.2.1',
  )
  await assert.rejects(db.query(`update campaigns set battle_count=1 where id=$1`, [cid]), /frozen/)
  const next = { ...state, version: 1, log: [{ dice: [4] }] }
  const params = [cid, actor, 0, request, 'fingerprint', 'test', JSON.stringify(next)]
  const one = await db.query<{ v221_commit: { version: number; replayed: boolean } }>(
    'select v221_commit($1,$2,$3,$4,$5,$6,$7::jsonb)',
    params,
  )
  assert.equal(one.rows[0].v221_commit.version, 1)
  const replay = await db.query<{ v221_commit: { replayed: boolean } }>(
    'select v221_commit($1,$2,$3,$4,$5,$6,$7::jsonb)',
    params,
  )
  assert.equal(replay.rows[0].v221_commit.replayed, true)
  await assert.rejects(
    db.query('select v221_commit($1,$2,$3,$4,$5,$6,$7::jsonb)', [
      ...params.slice(0, 4),
      'changed',
      ...params.slice(5),
    ]),
    /collision/,
  )
  await assert.rejects(
    db.query('select v221_commit($1,$2,$3,$4,$5,$6,$7::jsonb)', [
      cid,
      actor,
      0,
      '00000000-0000-4000-8000-000000000005',
      'fresh',
      'test',
      JSON.stringify(next),
    ]),
    /STATE_CONFLICT/,
  )
  const backup = await db.query<{ legacy_backup: { campaign: { rules_version: string } } }>(
    'select legacy_backup from campaign_private.states',
  )
  assert.equal(backup.rows[0].legacy_backup.campaign.rules_version, '2.1')
  await db.exec('set role authenticated')
  await assert.rejects(db.query('select * from campaign_private.states'), /permission denied/)
  await assert.rejects(db.query('select v221_load($1,$2)', [cid, actor]), /permission denied/)
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [outsider])
  let visible = await db.query('select * from campaign_versions')
  assert.equal(visible.rows.length, 0)
  await assert.rejects(db.query("select join_campaign('INVITE','Second')"), /permission denied/)
  await db.query("select v221_join_campaign('INVITE','Second')")
  visible = await db.query('select * from campaign_versions')
  assert.equal(visible.rows.length, 1)
  await db.exec('reset role')
  await assert.rejects(
    db.query(`update units set created_at=now() where campaign_id=$1`, [cid]),
    /frozen/,
  )
  const saved = await db.query<{ state: { version: number } }>(
    'select state from campaign_private.states',
  )
  assert.equal(saved.rows[0].state.version, 1)
  await db.close()
})
