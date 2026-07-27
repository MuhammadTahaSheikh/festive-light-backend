-- Season Switch cache: one generated image per quote (render) × holiday scheme.
-- Prevents re-calling Gemini every time a homeowner taps Christmas / July 4th / Halloween.

create table if not exists public.season_variants (
  render_id  text not null,
  scheme     text not null,
  image_url  text not null,
  created_at timestamptz not null default now(),
  primary key (render_id, scheme)
);

create index if not exists season_variants_render_idx
  on public.season_variants (render_id);

alter table public.season_variants enable row level security;
