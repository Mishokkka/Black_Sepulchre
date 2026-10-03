-- Additive migration. Legacy rows and history are retained; new state is private.
create schema if not exists campaign_private;
revoke all on schema campaign_private from public, anon, authenticated;
create table campaign_private.states (
 campaign_id uuid primary key references public.campaigns(id),
 version bigint not null default 0 check(version>=0),
 state jsonb not null check(state->>'rules'='2.2.1'),
 legacy_backup jsonb not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table campaign_private.commands (
 campaign_id uuid not null references campaign_private.states(campaign_id),
 request_id uuid not null, actor uuid not null, fingerprint text not null,
 version bigint not null, command_type text not null, dice jsonb not null,
 created_at timestamptz not null default now(), primary key(campaign_id,request_id)
);
create index commands_actor_idx on campaign_private.commands(actor,campaign_id);
alter table campaign_private.states enable row level security;
alter table campaign_private.commands enable row level security;
revoke all on all tables in schema campaign_private from public,anon,authenticated;
create table public.campaign_versions (
 campaign_id uuid primary key references public.campaigns(id), version bigint not null,
 updated_at timestamptz not null default now()
);
alter table public.campaign_versions enable row level security;
revoke all on public.campaign_versions from public,anon,authenticated;
grant select on public.campaign_versions to authenticated;
create policy versions_member_read on public.campaign_versions for select to authenticated
 using (exists(select 1 from public.campaign_members m where m.campaign_id=campaign_versions.campaign_id and m.user_id=(select auth.uid())));

create or replace function public.v221_load(p_campaign uuid,p_actor uuid,p_request uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare member_side text; current_state jsonb; receipt jsonb;
begin
 select m.side into member_side from public.campaign_members m where m.campaign_id=p_campaign and m.user_id=p_actor;
 if member_side is null then raise exception 'Not a campaign member' using errcode='42501';end if;
 select state into current_state from campaign_private.states where campaign_id=p_campaign;
 if p_request is not null then select jsonb_build_object('actor',actor,'fingerprint',fingerprint,'version',version) into receipt from campaign_private.commands where campaign_id=p_campaign and request_id=p_request;end if;
 if current_state is null then
  return jsonb_build_object('side',member_side,'baseline',jsonb_build_object(
   'campaign',(select to_jsonb(c) from public.campaigns c where id=p_campaign),
   'players',coalesce((select jsonb_agg(to_jsonb(p)) from public.players p where campaign_id=p_campaign),'[]'::jsonb),
   'sectors',coalesce((select jsonb_agg(to_jsonb(s)) from public.sectors s where campaign_id=p_campaign),'[]'::jsonb),
   'units',coalesce((select jsonb_agg(to_jsonb(u) order by u.created_at,u.id) from public.units u where campaign_id=p_campaign),'[]'::jsonb)));
 end if;
 return jsonb_build_object('side',member_side,'state',current_state,'receipt',receipt);
end $$;

create or replace function public.v221_initialize(p_campaign uuid,p_actor uuid,p_state jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing jsonb; backup jsonb;
begin
 perform 1 from public.campaigns where id=p_campaign for update;
 if not exists(select 1 from public.campaign_members where campaign_id=p_campaign and user_id=p_actor) then raise exception 'Not a member' using errcode='42501';end if;
 select state into existing from campaign_private.states where campaign_id=p_campaign;
 if existing is not null then return existing;end if;
 if p_state->>'id'<>p_campaign::text or p_state->>'rules'<>'2.2.1' or (p_state->>'version')::bigint<>0 then raise exception 'Invalid initial state';end if;
 backup:=jsonb_build_object('campaign',(select to_jsonb(c) from public.campaigns c where id=p_campaign),
  'players',(select jsonb_agg(to_jsonb(p)) from public.players p where campaign_id=p_campaign),
  'sectors',(select jsonb_agg(to_jsonb(s)) from public.sectors s where campaign_id=p_campaign),
  'units',(select jsonb_agg(to_jsonb(u)) from public.units u where campaign_id=p_campaign),
  'activations',coalesce((select jsonb_agg(to_jsonb(a)) from public.activations a where campaign_id=p_campaign),'[]'::jsonb),
  'battles',coalesce((select jsonb_agg(to_jsonb(b)) from public.battles b where campaign_id=p_campaign),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(to_jsonb(e)) from public.campaign_events e where campaign_id=p_campaign),'[]'::jsonb),
  'battle_units',coalesce((select jsonb_agg(to_jsonb(u)) from public.battle_units u join public.battles b on b.id=u.battle_id where b.campaign_id=p_campaign),'[]'::jsonb),
  'ledger',coalesce((select jsonb_agg(to_jsonb(l)) from public.resource_ledger l where campaign_id=p_campaign),'[]'::jsonb),
  'audit',coalesce((select jsonb_agg(to_jsonb(l)) from public.audit_log l where campaign_id=p_campaign),'[]'::jsonb),
  'reactions',coalesce((select jsonb_agg(to_jsonb(l)) from public.reactions l where campaign_id=p_campaign),'[]'::jsonb),
  'recon_commitments',coalesce((select jsonb_agg(to_jsonb(l)) from public.recon_scar_commitments l where campaign_id=p_campaign),'[]'::jsonb),
  'interdict_commitments',coalesce((select jsonb_agg(to_jsonb(l)) from public.interdict_commitments l where campaign_id=p_campaign),'[]'::jsonb));
 insert into campaign_private.states(campaign_id,state,legacy_backup) values(p_campaign,p_state,backup);
 insert into public.campaign_versions(campaign_id,version) values(p_campaign,0);
 perform set_config('app.v221_commit','1',true);
 update public.campaigns set rules_version='2.2.1',status='setup',active_side=p_state->>'active' where id=p_campaign;
 return p_state;
end $$;

create or replace function public.v221_commit(p_campaign uuid,p_actor uuid,p_expected bigint,p_request uuid,p_fingerprint text,p_command text,p_state jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare old_version bigint; receipt campaign_private.commands%rowtype; actor_side text;
begin
 select side into actor_side from public.campaign_members where campaign_id=p_campaign and user_id=p_actor;
 if actor_side is null then raise exception 'Not a member' using errcode='42501';end if;
 select version into old_version from campaign_private.states where campaign_id=p_campaign for update;
 if old_version is null then raise exception 'State not initialized';end if;
 select * into receipt from campaign_private.commands where campaign_id=p_campaign and request_id=p_request;
 if found then
  if receipt.actor<>p_actor or receipt.fingerprint<>p_fingerprint then raise exception 'Request id collision' using errcode='22023';end if;
  return jsonb_build_object('version',receipt.version,'replayed',true);
 end if;
 if old_version<>p_expected then raise exception 'STATE_CONFLICT' using errcode='40001';end if;
 if p_state->>'id'<>p_campaign::text or p_state->>'rules'<>'2.2.1' or (p_state->>'version')::bigint<>old_version+1 then raise exception 'Invalid state';end if;
 update campaign_private.states set state=p_state,version=old_version+1,updated_at=now() where campaign_id=p_campaign;
 insert into campaign_private.commands(campaign_id,request_id,actor,fingerprint,version,command_type,dice) values(p_campaign,p_request,p_actor,p_fingerprint,old_version+1,p_command,coalesce(p_state->'log'->-1->'dice','[]'::jsonb));
 update public.campaign_versions set version=old_version+1,updated_at=now() where campaign_id=p_campaign;
 perform set_config('app.v221_commit','1',true);
 update public.campaigns set rules_version='2.2.1',status=case when p_state->>'phase'='setup' then 'setup' when p_state->>'phase'='terminal' then 'finished' else 'active' end,
  battle_count=(p_state->>'battles')::integer,stage_index=(p_state->>'stage')::smallint,black_choir=(p_state->>'choir')::smallint,active_side=p_state->>'active',winner_side=case when p_state->>'winner' in ('deathwatch','necrons') then p_state->>'winner' else null end
 where id=p_campaign;
 return jsonb_build_object('version',old_version+1,'replayed',false);
end $$;
revoke all on function public.v221_load(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.v221_initialize(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.v221_commit(uuid,uuid,bigint,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.v221_load(uuid,uuid,uuid),public.v221_initialize(uuid,uuid,jsonb),public.v221_commit(uuid,uuid,bigint,uuid,text,text,jsonb) to service_role;

create or replace function public.v221_join_campaign(p_invite_code text,p_display_name text default 'Commander')
returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid; previous_setting text;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 select id into cid from public.campaigns where upper(invite_code)=upper(trim(p_invite_code)) and status in ('setup','active') for update;
 if cid is null then raise exception 'Campaign not found';end if;
 previous_setting:=current_setting('app.v221_commit',true);
 perform set_config('app.v221_commit','1',true);
 cid:=public.join_campaign(p_invite_code,p_display_name);
 perform set_config('app.v221_commit',coalesce(previous_setting,''),true);
 return cid;
end $$;
revoke all on function public.v221_join_campaign(text,text) from public,anon;
grant execute on function public.v221_join_campaign(text,text) to authenticated;

create or replace function campaign_private.guard_legacy_write() returns trigger language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 if current_setting('app.v221_commit',true)='1' then return new;end if;
 if tg_table_name='campaigns' then cid:=coalesce(new.id,old.id);
 elsif tg_table_name='battle_units' then select campaign_id into cid from public.battles where id=coalesce(new.battle_id,old.battle_id);
 else cid:=coalesce(new.campaign_id,old.campaign_id);end if;
 if exists(select 1 from campaign_private.states where campaign_id=cid) then raise exception 'Legacy campaign is frozen. Use the 2.2.1 engine.' using errcode='42501';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function campaign_private.guard_legacy_write() from public,anon,authenticated;
do $$ declare t text;begin
 foreach t in array array['campaigns','players','sectors','units','activations','battles','battle_units','campaign_events','reactions','resource_ledger','audit_log','recon_scar_commitments','interdict_commitments'] loop
  execute format('create trigger v221_freeze_legacy before insert or update or delete on public.%I for each row execute function campaign_private.guard_legacy_write()',t);
 end loop;
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.campaign_versions;end if;
end $$;

-- Retire the old mutation API. Membership helpers live in private and retain their
-- existing ACL. Only create_campaign and the checked join wrapper are client RPCs.
do $$ declare f record;begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef and p.prokind='f' and p.proname not in ('create_campaign','v221_join_campaign') loop
  execute format('revoke execute on function %s from public,anon,authenticated',f.signature);
 end loop;
end $$;
