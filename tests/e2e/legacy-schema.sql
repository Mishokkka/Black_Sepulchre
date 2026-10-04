-- Test-only compatibility fixture for the retired SQL engine. Never apply to a linked project.
create table public.campaigns(id uuid primary key default gen_random_uuid(), name text, invite_code text unique,
  status text, created_by uuid, rules_version text default '2.1', battle_count int default 0,
  stage_index smallint default 0, black_choir smallint default 0, active_side text, winner_side text,
  snapshot_date date default current_date);
create table public.campaign_members(campaign_id uuid references campaigns, user_id uuid, side text not null
  check(side in ('necrons','deathwatch')), role text, display_name text, created_at timestamptz default now(),
  primary key(campaign_id,user_id));
create unique index campaign_members_one_side_per_campaign on public.campaign_members(campaign_id,side);
create table public.players(id uuid default gen_random_uuid(),campaign_id uuid,side text,user_id uuid,main_force_sector text,
  supply int default 100, intelligence int default 1, recovery_supply int default 0, secret_fragments int default 0,
  fortress_integrity int default 2);
create table public.sectors(id uuid default gen_random_uuid(),campaign_id uuid,sector_key text,name text,sector_class text,owner_side text);
create table public.units(id uuid default gen_random_uuid(),campaign_id uuid,side text,name text,datasheet text,
  reference_cost int,size_label text,keywords text[],is_character boolean,is_battleline boolean,garrison_class text,
  created_at timestamptz default now(), xp int default 0, damage int default 0, location_type text default 'field',
  sector_key text, status text default 'active', is_epic_hero boolean default false);
create table public.resource_ledger(id uuid default gen_random_uuid(),campaign_id uuid,side text,resource text,delta int,reason text,actor_user_id uuid);
create table public.audit_log(id uuid default gen_random_uuid(),campaign_id uuid,actor_user_id uuid,action text,entity_type text,entity_id text,details jsonb);
create table public.battle_units(id uuid,battle_id uuid);
do $$ declare t text; begin
  foreach t in array array['activations','battles','campaign_events','reactions','recon_scar_commitments','interdict_commitments'] loop
    execute format('create table public.%I(id uuid,campaign_id uuid,side text)',t);
  end loop;
end $$;
create schema private;
create function private.is_campaign_member(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.campaign_members where campaign_id=cid and user_id=(select auth.uid()))
$$;
revoke all on schema private from public,anon,authenticated;
revoke all on function private.is_campaign_member(uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.is_campaign_member(uuid) to authenticated;
alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
create policy campaigns_member_read on public.campaigns for select to authenticated using ((select private.is_campaign_member(id)));
create policy campaign_members_member_read on public.campaign_members for select to authenticated using ((select private.is_campaign_member(campaign_id)));
alter table public.recon_scar_commitments enable row level security;
alter table public.interdict_commitments enable row level security;
create policy recon_scar_commitments_select_own on public.recon_scar_commitments for select to authenticated using(false);
create policy interdict_commitments_select_own on public.interdict_commitments for select to authenticated using(false);
