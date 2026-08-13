import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION_FILE = path.join(__dirname, '..', 'supabase', 'migrations', '005_created_by.sql');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supa = createClient(url, key, { auth: { persistSession: false } });
const projectRef = new URL(url).hostname.split('.')[0];
const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');

async function columnsReady() {
  const { error } = await supa.from('campaigns').select('id, created_by').limit(1);
  if (error) {
    if (/created_by|schema cache/i.test(error.message)) return false;
    throw new Error(error.message);
  }
  return true;
}

function dbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const password = process.env.SUPABASE_DB_PASSWORD || '';
  if (!password) return '';
  return `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;
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

async function runViaSupabaseCli() {
  const conn = dbUrl();
  if (!conn) return { ok: false, reason: 'no_db_password' };
  try {
    execSync(`npx supabase db query --file "${MIGRATION_FILE}" --db-url "${conn}"`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: String(err.message || err) };
  }
}

async function main() {
  if (await columnsReady()) {
    console.log('created_by columns already exist.');
    return;
  }

  console.log('Adding created_by to leads / campaigns / campaign_homes / renders…');
  let created = await runViaSupabaseCli();
  if (!created.ok) {
    console.log('Supabase CLI skipped/failed:', created.reason);
    created = await runViaMgmtApi();
  }

  if (!created.ok) {
    console.error(`
Could not add columns automatically (${created.reason}).

Paste this into Supabase → SQL Editor → Run:

${sql}

Or add SUPABASE_DB_PASSWORD / SUPABASE_ACCESS_TOKEN to .env and re-run:
  npm run setup:created-by
`);
    process.exit(2);
  }

  for (let i = 0; i < 8; i++) {
    if (await columnsReady()) {
      console.log('created_by columns ready.');
      return;
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  console.error('Columns may still be propagating — wait a few seconds and retry.');
  process.exit(3);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
