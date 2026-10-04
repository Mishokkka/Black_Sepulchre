-- Narrow the browser-facing Data API to the three relations the current client actually reads.
-- Authoritative campaign state and all writes go through campaign-engine / audited RPCs.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all tables in schema public from authenticated;

grant select on table
  public.campaigns,
  public.campaign_members,
  public.campaign_versions
to authenticated;

-- Do not let future public objects silently regain the legacy broad client grants.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- These legacy entrypoints use fully-qualified relation/auth references.  Keep their
-- definer lookup path empty so later objects in public cannot shadow built-ins.
alter function public.create_campaign(text,text,text) set search_path = '';
alter function public.join_campaign(text,text) set search_path = '';
