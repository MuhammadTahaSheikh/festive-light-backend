import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { migrateCreditsFileToDb } from '../server/db/credits.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const MIGRATION_FILE = path.join(__dirname, '..', 'supabase', 'migrations', '002_credits.sql');
const dataOnly = process.argv.includes('--data-only');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supa = createClient(url, key, { auth: { persistSession: false } });
const projectRef = new URL(url).hostname.split('.')[0];

const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');

async function tablesExist() {
  const { error } = await supa.from('credit_accounts').select('account_key').limit(1);
  return !error;
}

function dbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const password = process.env.SUPABASE_DB_PASSWORD || '';
  if (!password) return '';
  const encoded = encodeURIComponent(password);
  return `postgresql://postgres:${encoded}@db.${projectRef}.supabase.co:5432/postgres`;
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

async function ensureTables() {
  if (await tablesExist()) {
    console.log('credit_accounts already exists');
    return true;
  }
  if (dataOnly) {
    console.error('Tables missing. Run without --data-only after creating tables.');
    return false;
  }

  console.log('Creating credit tables…');
  let created = await runViaSupabaseCli();
  if (!created.ok) {
    console.log('Supabase CLI skipped/failed:', created.reason);
    created = await runViaMgmtApi();
  }
  if (!created.ok) {
    console.log('Management API skipped/failed:', created.reason);
    console.error(`
Could not create tables automatically.

Option A — add to .env (Supabase → Project Settings → Database → password):
  SUPABASE_DB_PASSWORD=your-database-password
Then run: npm run setup:credits

Option B — paste supabase/migrations/002_credits.sql in Supabase → SQL Editor → Run
Then run: npm run setup:credits -- --data-only
`);
    return false;
  }

  for (let i = 0; i < 8; i++) {
    if (await tablesExist()) break;
    await new Promise((r) => setTimeout(r, 700));
  }
  if (!(await tablesExist())) {
    console.error('Table create reported OK but select still fails — wait a few seconds and re-run.');
    return false;
  }
  console.log('Tables created and verified');
  return true;
}

function backupJsonFiles() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  for (const name of ['credits.json', 'credit_transactions.json']) {
    const src = path.join(DATA_DIR, name);
    if (fs.existsSync(src)) {
      const dest = path.join(DATA_DIR, `${name}.bak-${stamp}`);
      fs.copyFileSync(src, dest);
      console.log(`Backed up ${name} → ${path.basename(dest)}`);
    }
  }
}

async function verifyAccount(accountKey) {
  const { data, error } = await supa
    .from('credit_accounts')
    .select('balance')
    .eq('account_key', accountKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.balance ?? null;
}

async function main() {
  if (!(await ensureTables())) process.exit(2);

  backupJsonFiles();
  const result = await migrateCreditsFileToDb();
  console.log('Migration result:', result);

  for (const email of ['tahasheikh682@gmail.com', 'mtahasheikh750@gmail.com']) {
    const balance = await verifyAccount(email);
    if (balance != null) console.log(`Verified ${email}: ${balance.toLocaleString()} credits`);
  }

  const { count, error: txErr } = await supa
    .from('credit_transactions')
    .select('*', { count: 'exact', head: true });
  if (txErr) throw new Error(txErr.message);
  console.log(`Total transactions in Supabase: ${count}`);
  console.log('\nRestart the server so it picks up Supabase credits (not JSON fallback).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
