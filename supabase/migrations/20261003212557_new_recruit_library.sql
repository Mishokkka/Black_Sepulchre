-- Immutable source library. Campaign mutations stay in the existing state engine.
create table campaign_private.source_imports (
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 side text not null check(side in ('deathwatch','necrons')),
 source_hash text not null check(source_hash ~ '^[0-9a-f]{64}$'),
 data jsonb not null check(coalesce(jsonb_typeof(data)='object'
   and data->>'schema'='black-sepulchre.nr.v1' and data->>'side'=side
   and data->'source'->>'hash'=source_hash,false))
   check(octet_length(data::text)<=1500000),
 created_by uuid not null,
 created_at timestamptz not null default now(),
 primary key(campaign_id,side,source_hash)
);
alter table campaign_private.source_imports enable row level security;
revoke all on campaign_private.source_imports from public,anon,authenticated,service_role;
grant select,insert on campaign_private.source_imports to service_role;
grant usage on schema campaign_private to service_role;
grant select on public.campaign_members to service_role;

create function public.v221_list_imports(p_campaign uuid,p_actor uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor_side text;
begin
 select side into actor_side from public.campaign_members where campaign_id=p_campaign and user_id=p_actor;
 if actor_side is null then raise exception 'Not a campaign member' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('hash',source_hash,'data',data,'createdAt',created_at)
   order by created_at desc,source_hash) from campaign_private.source_imports
   where campaign_id=p_campaign and side=actor_side),'[]'::jsonb);
end $$;

create function public.v221_save_import(p_campaign uuid,p_actor uuid,p_hash text,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor_side text;existing jsonb;total integer;
begin
 select side into actor_side from public.campaign_members where campaign_id=p_campaign and user_id=p_actor;
 if actor_side is null then raise exception 'Not a campaign member' using errcode='42501';end if;
 if p_data->>'side' is distinct from actor_side or p_data->'source'->>'hash' is distinct from p_hash then
   raise exception 'Source does not belong to actor side' using errcode='42501';end if;
 if p_data->>'schema' is distinct from 'black-sepulchre.nr.v1'
   or jsonb_typeof(p_data->'units') is distinct from 'array'
   or jsonb_array_length(p_data->'units') not between 1 and 200 then raise exception 'Invalid import';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_campaign::text||actor_side,0));
 select data into existing from campaign_private.source_imports
   where campaign_id=p_campaign and side=actor_side and source_hash=p_hash;
 if existing is not null then return jsonb_build_object('reused',true,'data',existing);end if;
 select count(*) into total from campaign_private.source_imports where campaign_id=p_campaign and side=actor_side;
 if total>=30 then raise exception 'Source library limit reached';end if;
 insert into campaign_private.source_imports(campaign_id,side,source_hash,data,created_by)
 values(p_campaign,actor_side,p_hash,p_data,p_actor);
 return jsonb_build_object('reused',false,'data',p_data);
end $$;
revoke all on function public.v221_list_imports(uuid,uuid),public.v221_save_import(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.v221_list_imports(uuid,uuid),public.v221_save_import(uuid,uuid,text,jsonb) to service_role;
