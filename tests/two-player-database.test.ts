import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

test('Real create/join entrypoints support two accounts, reject a third, preserve setup and enforce state integrity', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema public,auth to authenticated;
      create table campaigns(id uuid primary key default gen_random_uuid(), name text, invite_code text unique,
        status text, created_by uuid, rules_version text, battle_count int default 0,
        stage_index smallint default 0, black_choir smallint default 0, active_side text, winner_side text);
      create table campaign_members(campaign_id uuid references campaigns, user_id uuid, side text not null
        check(side in ('necrons','deathwatch')), role text, display_name text, primary key(campaign_id,user_id));
      grant select on campaign_members to authenticated;
      create table players(id uuid default gen_random_uuid(),campaign_id uuid,side text,user_id uuid,main_force_sector text);
      create table sectors(id uuid default gen_random_uuid(),campaign_id uuid,sector_key text,name text,sector_class text,owner_side text);
      create table units(id uuid default gen_random_uuid(),campaign_id uuid,side text,name text,datasheet text,
        reference_cost int,size_label text,keywords text[],is_character boolean,is_battleline boolean,garrison_class text,
        created_at timestamptz default now());
      create table resource_ledger(id uuid,campaign_id uuid,side text,resource text,delta int,reason text,actor_user_id uuid);
      create table audit_log(id uuid,campaign_id uuid,actor_user_id uuid,action text,entity_type text,entity_id text,details jsonb);
      create table battle_units(id uuid,battle_id uuid);
    `)
    for (const t of [
      'activations',
      'battles',
      'campaign_events',
      'reactions',
      'recon_scar_commitments',
      'interdict_commitments',
    ])
      await db.exec(`create table ${t}(id uuid,campaign_id uuid,side text);`)
    for (const t of ['recon_scar_commitments', 'interdict_commitments'])
      await db.exec(
        `alter table ${t} enable row level security; create policy ${t}_select_own on ${t} for select to authenticated using(false);`,
      )
    await db.exec(
      readFileSync(new URL('./fixtures/legacy-entrypoints.sql', import.meta.url), 'utf8'),
    )
    for (const file of [
      '20261003182938_rules_221_state_engine.sql',
      '20261004070247_audit_two_player_integrity.sql',
    ])
      await db.exec(
        readFileSync(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'),
      )
    const first = '00000000-0000-4000-8000-000000000001'
    const second = '00000000-0000-4000-8000-000000000002'
    const third = '00000000-0000-4000-8000-000000000003'
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [first])
    await db.exec('set role authenticated')
    const cid = (
      await db.query<{ id: string }>("select create_campaign('Integration','necrons','One') id")
    ).rows[0].id
    await db.exec('reset role')
    const invite = (
      await db.query<{ invite_code: string }>('select invite_code from campaigns where id=$1', [
        cid,
      ])
    ).rows[0].invite_code
    const state = { id: cid, rules: '2.2.1', version: 0, phase: 'setup', active: 'necrons' }
    await db.query('select v221_initialize($1,$2,$3::jsonb)', [cid, first, JSON.stringify(state)])
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [second])
    await db.exec('set role authenticated')
    for (let i = 0; i < 2; i++)
      assert.equal(
        (
          await db.query<{ id: string }>('select v221_join_campaign($1,$2) id', [
            '  ' + invite.toLowerCase() + '  ',
            'Two',
          ])
        ).rows[0].id,
        cid,
      )
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [third])
    await assert.rejects(
      db.query('select v221_join_campaign($1,$2)', [invite, 'Third']),
      /two players/,
    )
    await db.exec('reset role')
    const members = (await db.query('select side from campaign_members order by side')).rows
    assert.deepEqual(members, [{ side: 'deathwatch' }, { side: 'necrons' }])
    assert.equal(
      (await db.query<{ status: string }>('select status from campaigns')).rows[0].status,
      'setup',
    )
    for (const [actor, side] of [
      [first, 'necrons'],
      [second, 'deathwatch'],
    ])
      assert.equal(
        (await db.query<{ data: { side: string } }>('select v221_load($1,$2) data', [cid, actor]))
          .rows[0].data.side,
        side,
      )
    await assert.rejects(db.query('select v221_load($1,$2)', [cid, third]), /member/)
    await assert.rejects(
      db.query("insert into campaign_members(campaign_id,user_id,side) values($1,$2,'necrons')", [
        cid,
        third,
      ]),
      /unique/,
    )
    await assert.rejects(
      db.exec("update campaign_private.states set state=state - 'version'"),
      /state_envelope/,
    )
    await assert.rejects(
      db.exec("update campaign_private.states set state=jsonb_set(state,'{version}','9')"),
      /state_envelope/,
    )
    await assert.rejects(db.exec('update units set reference_cost=1'), /frozen/)
    await db.exec('set role anon')
    await assert.rejects(
      db.query('select v221_join_campaign($1,$2)', [invite, 'Anonymous']),
      /permission denied/,
    )
  } finally {
    await db.close()
  }
})
