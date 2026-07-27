-- Outreach map columns (optional — run in Supabase SQL Editor if you want geo saved on homes/campaigns)
alter table public.campaigns add column if not exists selection_geojson jsonb;
alter table public.campaigns add column if not exists default_scheme text;
alter table public.campaigns add column if not exists default_price_per_foot numeric;

alter table public.campaign_homes add column if not exists lat double precision;
alter table public.campaign_homes add column if not exists lng double precision;
alter table public.campaign_homes add column if not exists place_id text;
