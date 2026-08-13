-- Track which installer account created leads, campaigns, homes, and renders.
-- Nullable so existing rows and public (unauthenticated) submissions keep working.
alter table public.leads add column if not exists created_by text;
alter table public.campaigns add column if not exists created_by text;
alter table public.campaign_homes add column if not exists created_by text;
alter table public.renders add column if not exists created_by text;

create index if not exists leads_created_by_idx on public.leads (created_by, created_at desc);
create index if not exists campaigns_created_by_idx on public.campaigns (created_by, created_at desc);
create index if not exists renders_created_by_idx on public.renders (created_by, created_at desc);
