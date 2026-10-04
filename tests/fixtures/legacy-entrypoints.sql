-- Schema code only, captured read-only from the linked project on 2026-10-04.
CREATE OR REPLACE FUNCTION public.create_campaign(p_name text, p_side text DEFAULT 'necrons'::text, p_display_name text DEFAULT 'Commander'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_campaign uuid;
  v_code text;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;
  if p_side not in ('necrons','deathwatch') then
    raise exception 'Invalid side';
  end if;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists (select 1 from public.campaigns where invite_code = v_code);
  end loop;

  insert into public.campaigns(name, invite_code, status, created_by)
  values (coalesce(nullif(trim(p_name),''),'The Black Sepulchre'), v_code, 'setup', v_user)
  returning id into v_campaign;

  insert into public.campaign_members(campaign_id,user_id,side,role,display_name)
  values (v_campaign,v_user,p_side,'owner',coalesce(nullif(trim(p_display_name),''),'Commander'));

  insert into public.players(campaign_id,side,user_id,main_force_sector)
  values
    (v_campaign,'deathwatch',case when p_side='deathwatch' then v_user else null end,'A'),
    (v_campaign,'necrons',case when p_side='necrons' then v_user else null end,'K');

  insert into public.sectors(campaign_id,sector_key,name,sector_class,owner_side)
  values
    (v_campaign,'A','Watch Fortress Tenebris','Home Stronghold','deathwatch'),
    (v_campaign,'B','Basilica Ossuary','Ordinary','deathwatch'),
    (v_campaign,'C','Orbital Ossuary Lift','Strategic Node','deathwatch'),
    (v_campaign,'D','Fleshworks IX','Ordinary','deathwatch'),
    (v_campaign,'E','Ash Meridian','Strategic Node','deathwatch'),
    (v_campaign,'F','Noctis Relay','Strategic Node','necrons'),
    (v_campaign,'G','Cathedral of Black Glass','Strategic Node',null),
    (v_campaign,'H','Glass Wastes','Ordinary','necrons'),
    (v_campaign,'I','Necropolis Khepra','Ordinary','necrons'),
    (v_campaign,'J','Canoptek Foundry','Strategic Node','necrons'),
    (v_campaign,'K','Sepulchre of the Nameless King','Home Stronghold','necrons');

  insert into public.units(campaign_id,side,name,datasheet,reference_cost,size_label,keywords,is_character,is_battleline,garrison_class)
  values
    (v_campaign,'necrons','Skorpekh Lord','Skorpekh Lord',90,'1 model',array['CHARACTER','NECRONS'],true,false,'forbidden'),
    (v_campaign,'necrons','Necron Warriors','Necron Warriors',80,'10 models',array['INFANTRY','BATTLELINE','NECRONS'],false,true,'core'),
    (v_campaign,'necrons','Immortals','Immortals',70,'5 models',array['INFANTRY','BATTLELINE','NECRONS'],false,true,'core'),
    (v_campaign,'necrons','Skorpekh Destroyers','Skorpekh Destroyers',85,'3 models',array['INFANTRY','NECRONS'],false,false,'unknown'),
    (v_campaign,'necrons','Deathmarks','Deathmarks',60,'5 models',array['INFANTRY','NECRONS'],false,false,'core'),
    (v_campaign,'necrons','Canoptek Scarab Swarms','Canoptek Scarab Swarms',40,'3 models',array['SWARM','CANOPTEK','NECRONS'],false,false,'core'),
    (v_campaign,'necrons','Lokhust Heavy Destroyer','Lokhust Heavy Destroyer',50,'1 model',array['MOUNTED','NECRONS'],false,false,'core'),
    (v_campaign,'deathwatch','Librarian','Librarian',75,'1 model',array['CHARACTER','INFANTRY','ADEPTUS ASTARTES'],true,false,'forbidden'),
    (v_campaign,'deathwatch','Deathwatch Veterans','Deathwatch Veterans',100,'5 models',array['INFANTRY','DEATHWATCH'],false,false,'core'),
    (v_campaign,'deathwatch','Intercessors','Intercessor Squad',80,'5 models',array['INFANTRY','BATTLELINE','ADEPTUS ASTARTES'],false,true,'core'),
    (v_campaign,'deathwatch','Assault Intercessors','Assault Intercessor Squad',75,'5 models',array['INFANTRY','BATTLELINE','ADEPTUS ASTARTES'],false,true,'core'),
    (v_campaign,'deathwatch','Bladeguard Veterans','Bladeguard Veteran Squad',80,'3 models',array['INFANTRY','ADEPTUS ASTARTES'],false,false,'core'),
    (v_campaign,'deathwatch','Eliminators','Eliminator Squad',75,'3 models',array['INFANTRY','ADEPTUS ASTARTES'],false,false,'core');

  insert into public.resource_ledger(campaign_id,side,resource,delta,reason,actor_user_id)
  values
    (v_campaign,'necrons','supply',100,'Старт кампании',v_user),
    (v_campaign,'necrons','intelligence',1,'Старт кампании',v_user),
    (v_campaign,'deathwatch','supply',100,'Старт кампании',v_user),
    (v_campaign,'deathwatch','intelligence',1,'Старт кампании',v_user);

  insert into public.audit_log(campaign_id,actor_user_id,action,entity_type,entity_id,details)
  values (v_campaign,v_user,'create_campaign','campaign',v_campaign::text,jsonb_build_object('creator_side',p_side,'rules_version','2.0'));

  return v_campaign;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.join_campaign(p_invite_code text, p_display_name text DEFAULT 'Commander'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_campaign uuid;
  v_side text;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  select id into v_campaign
  from public.campaigns
  where upper(invite_code) = upper(trim(p_invite_code))
    and status in ('setup','active')
  limit 1;

  if v_campaign is null then
    raise exception 'Campaign not found';
  end if;

  if exists (
    select 1 from public.campaign_members
    where campaign_id = v_campaign and user_id = v_user
  ) then
    return v_campaign;
  end if;

  if (select count(*) from public.campaign_members where campaign_id = v_campaign) >= 2 then
    raise exception 'Campaign already has two players';
  end if;

  if exists (
    select 1 from public.campaign_members
    where campaign_id = v_campaign and side = 'necrons'
  ) then
    v_side := 'deathwatch';
  else
    v_side := 'necrons';
  end if;

  insert into public.campaign_members(campaign_id,user_id,side,role,display_name)
  values (v_campaign,v_user,v_side,'player',coalesce(nullif(trim(p_display_name),''),'Commander'));

  update public.players
  set user_id = v_user
  where campaign_id = v_campaign and side = v_side;

  update public.campaigns
  set status = 'active'
  where id = v_campaign;

  insert into public.audit_log(campaign_id,actor_user_id,action,entity_type,entity_id,details)
  values (v_campaign,v_user,'join_campaign','campaign',v_campaign::text,jsonb_build_object('side',v_side));

  return v_campaign;
end;
$function$
;
