-- Additive hardening; no campaign state, accounts, or historical rows are removed.
create unique index campaign_members_one_side_idx on public.campaign_members(campaign_id,side);
create index recon_scar_commitments_campaign_idx on public.recon_scar_commitments(campaign_id);
create index interdict_commitments_campaign_idx on public.interdict_commitments(campaign_id);

alter policy recon_scar_commitments_select_own on public.recon_scar_commitments
 using (exists(select 1 from public.campaign_members m where
 m.campaign_id=recon_scar_commitments.campaign_id and m.user_id=(select auth.uid())
 and m.side=recon_scar_commitments.side));
alter policy interdict_commitments_select_own on public.interdict_commitments
 using (exists(select 1 from public.campaign_members m where
 m.campaign_id=interdict_commitments.campaign_id and m.user_id=(select auth.uid())
 and m.side=interdict_commitments.side));

alter table campaign_private.states add constraint state_envelope_matches_row check (
 jsonb_typeof(state) = 'object' and
 (state->>'id') is not distinct from campaign_id::text and
 (state->>'rules') is not distinct from '2.2.1' and
 (state->>'version')::bigint is not distinct from version
);

-- Legacy join updates the public header to active even while armies are preparing.
-- Preserve the private engine's lifecycle, and normalize the invite before delegation.
create or replace function public.v221_join_campaign(p_invite_code text,p_display_name text default 'Commander')
returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid; previous_setting text; phase text;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 select id into cid from public.campaigns where upper(invite_code)=upper(trim(p_invite_code))
  and status in ('setup','active') for update;
 if cid is null then raise exception 'Campaign not found';end if;
 previous_setting:=current_setting('app.v221_commit',true);
 perform set_config('app.v221_commit','1',true);
 cid:=public.join_campaign(upper(trim(p_invite_code)),p_display_name);
 select state->>'phase' into phase from campaign_private.states where campaign_id=cid;
 if phase is not null then
  update public.campaigns set status=case when phase='setup' then 'setup'
    when phase='terminal' then 'finished' else 'active' end where id=cid;
 end if;
 perform set_config('app.v221_commit',coalesce(previous_setting,''),true);
 return cid;
end $$;
revoke all on function public.v221_join_campaign(text,text) from public,anon;
grant execute on function public.v221_join_campaign(text,text) to authenticated;
