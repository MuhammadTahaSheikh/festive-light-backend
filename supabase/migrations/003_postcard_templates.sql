-- Postcard templates (6x9 direct mail layouts)

create table if not exists public.postcard_templates (
  id           uuid primary key default gen_random_uuid(),
  account_key  text not null default 'default',
  name         text not null,
  category     text default 'Uncategorized',
  format       text default '6x9',
  front        jsonb not null default '{}'::jsonb,
  back         jsonb not null default '{}'::jsonb,
  is_starter   boolean default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists postcard_templates_account_idx
  on public.postcard_templates (account_key, updated_at desc);

alter table public.campaign_homes add column if not exists mail_status text;
alter table public.campaign_homes add column if not exists lob_postcard_id text;
alter table public.campaign_homes add column if not exists mail_template_id text;
alter table public.campaign_homes add column if not exists mailed_at timestamptz;

alter table public.postcard_templates enable row level security;
