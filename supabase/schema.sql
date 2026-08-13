-- ─────────────────────────────────────────────────────────────
-- Festive Lighting Pros — Supabase schema
-- Run this in your Supabase project:
--   Dashboard -> SQL Editor -> New query -> paste -> Run
-- ─────────────────────────────────────────────────────────────

-- Leads captured from the render widget + the "book a call" modal.
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  email       text,
  phone       text,
  address     text,
  source      text,                 -- 'render_widget' | 'book_call'
  notes       text,
  ip          text,
  created_by  text,                 -- installer account email when known
  created_at  timestamptz not null default now()
);

alter table public.leads add column if not exists created_by text;

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_email_idx on public.leads (email);
create index if not exists leads_created_by_idx on public.leads (created_by, created_at desc);

-- Every house we render, so you can review / re-show them and see demand.
create table if not exists public.renders (
  id               uuid primary key default gen_random_uuid(),
  address          text,
  image_url        text,           -- path under /renders served by the app
  scheme           text,           -- warm-white | july-4th | christmas | custom
  landscape        boolean default false,
  decor            text,
  roofline_feet    integer,
  price_per_foot   numeric,
  estimated_total  numeric,
  lead_email       text,
  created_by       text,           -- installer account email when known
  created_at       timestamptz not null default now()
);

alter table public.renders add column if not exists created_by text;

create index if not exists renders_created_at_idx on public.renders (created_at desc);
create index if not exists renders_created_by_idx on public.renders (created_by, created_at desc);

-- Season Switch cache (Christmas / July 4th / Halloween previews per quote)
create table if not exists public.season_variants (
  render_id  text not null,
  scheme     text not null,
  image_url  text not null,
  created_at timestamptz not null default now(),
  primary key (render_id, scheme)
);
create index if not exists season_variants_render_idx on public.season_variants (render_id);

-- Campaigns group a batch of homes / renders / quotes together.
create table if not exists public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  area        text,                    -- neighborhood / street targeted
  status      text default 'active',   -- active | archived
  notes       text,
  created_by  text,                    -- installer account email who created it
  created_at  timestamptz not null default now()
);
-- If the table already existed, add the area column.
alter table public.campaigns add column if not exists area text;
alter table public.campaigns add column if not exists selection_geojson jsonb;
alter table public.campaigns add column if not exists default_scheme text;
alter table public.campaigns add column if not exists default_price_per_foot numeric;
alter table public.campaigns add column if not exists created_by text;

alter table public.campaign_homes add column if not exists lat double precision;
alter table public.campaign_homes add column if not exists lng double precision;
alter table public.campaign_homes add column if not exists place_id text;

create index if not exists campaigns_created_at_idx on public.campaigns (created_at desc);
create index if not exists campaigns_created_by_idx on public.campaigns (created_by, created_at desc);

-- Each home targeted within a campaign, with its status through the pipeline.
create table if not exists public.campaign_homes (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid not null references public.campaigns (id) on delete cascade,
  address          text not null,
  status           text default 'prospect', -- prospect|rendered|quote_sent|viewed|interested|closed
  render_id        uuid,                     -- linked render (optional)
  estimated_total  numeric,
  owner_name       text,
  owner_phone      text,
  owner_email      text,
  notes            text,
  created_by       text,                     -- installer who added the home
  created_at       timestamptz not null default now()
);

alter table public.campaign_homes add column if not exists created_by text;

create index if not exists campaign_homes_campaign_idx on public.campaign_homes (campaign_id, created_at desc);

-- Row Level Security: the server uses the SERVICE ROLE key, which bypasses
-- RLS, so these tables are NOT publicly readable/writable. We enable RLS
-- with no public policies to keep the anon key from touching them.
alter table public.leads          enable row level security;
alter table public.renders        enable row level security;
alter table public.campaigns      enable row level security;
alter table public.campaign_homes enable row level security;
alter table public.season_variants enable row level security;

-- Credit wallet (outreach / batch renders)
create table if not exists public.credit_accounts (
  account_key  text primary key,
  balance      integer not null default 0 check (balance >= 0),
  updated_at   timestamptz not null default now()
);

create table if not exists public.credit_transactions (
  id           uuid primary key default gen_random_uuid(),
  account_key  text not null references public.credit_accounts (account_key) on delete cascade,
  delta        integer not null,
  reason       text not null,
  meta         jsonb default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists credit_transactions_account_idx
  on public.credit_transactions (account_key, created_at desc);

alter table public.credit_accounts enable row level security;
alter table public.credit_transactions enable row level security;
