import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { migrateSeasonVariantsFileToDb } from '../server/db/seasonVariants.js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supa = createClient(url, key, { auth: { persistSession: false } });
const projectRef = new URL(url).hostname.split('.')[0];

const sql = `
create table if not exists public.season_variants (
  render_id  text not null,
  scheme     text not null,
  image_url  text not null,
  created_at timestamptz not null default now(),
  primary key (render_id, scheme)
);
create index if not exists season_variants_render_idx on public.season_variants (render_id);
alter table public.season_variants enable row level security;
`;

async function tableExists() {
  const { error } = await supa.from('season_variants').select('render_id').limit(1);
  return !error;
}

async function runViaMgmtApi() {
  const pat = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT || '';
  if (!pat) return { ok: false, reason: 'no_pat' };

  const resp = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pat}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await resp.text();
  if (!resp.ok) return { ok: false, reason: `mgmt ${resp.status}: ${text.slice(0, 400)}` };
  return { ok: true };
}

async function runViaRpc() {
  for (const fn of ['exec_sql', 'execute_sql', 'sql']) {
    const { error } = await supa.rpc(fn, { query: sql });
    if (!error) return { ok: true, via: fn };
    console.log(`RPC ${fn}: ${error.message}`);
  }
  return { ok: false, reason: 'no_rpc' };
}

async function main() {
  if (await tableExists()) {
    console.log('season_variants already exists');
  } else {
    console.log('Creating season_variants…');
    let created = await runViaMgmtApi();
    if (!created.ok) {
      console.log('Management API skipped/failed:', created.reason);
      created = await runViaRpc();
    }
    if (!created.ok) {
      console.error(`
Could not create the table automatically (Supabase blocks DDL from the app key).

Paste this in Supabase → SQL Editor → Run and enable RLS:

${sql}
`);
      process.exit(2);
    }
    // schema cache can lag briefly
    for (let i = 0; i < 8; i++) {
      if (await tableExists()) break;
      await new Promise((r) => setTimeout(r, 700));
    }
    if (!(await tableExists())) {
      console.error('Table create reported OK but select still fails — wait a few seconds and restart the server.');
      process.exit(1);
    }
    console.log('Table created and verified');
  }

  const migrated = await migrateSeasonVariantsFileToDb();
  console.log('Migrate:', migrated);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
