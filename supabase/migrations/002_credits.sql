-- Credit wallet for outreach / batch renders (Light Launch–style billing)

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
