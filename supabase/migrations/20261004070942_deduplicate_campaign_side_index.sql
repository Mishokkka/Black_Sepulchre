-- Keep the existing legacy unique index; ensure the same invariant on fresh baselines.
create unique index if not exists campaign_members_one_side_per_campaign
 on public.campaign_members(campaign_id,side);
-- The audit found this equivalent legacy index only in pg_indexes (not pg_constraint).
-- Remove just the duplicate introduced by the previous migration; no rows or constraints are removed.
drop index if exists public.campaign_members_one_side_idx;
