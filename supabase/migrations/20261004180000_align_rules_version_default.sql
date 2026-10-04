-- New campaign rows should advertise the rules version the current engine initializes.
alter table public.campaigns alter column rules_version set default '2.2.1';
