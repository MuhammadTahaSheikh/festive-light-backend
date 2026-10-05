/**
 * Create postcard_templates in Supabase (if needed) and copy data/postcard_templates.json into it.
 * Local JSON is gitignored, so production never sees those edits until they live in the shared database.
 *
 * Usage: node scripts/setup-postcard-templates.js
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const JSON_FILE = path.join(ROOT, 'data', 'postcard_templates.json');
const MIGRATION_FILE = path.join(ROOT, 'supabase', 'migrations', '003_postcard_templates.sql');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supa = createClient(url, key, { auth: { persistSession: false } });
const projectRef = new URL(url).hostname.split('.')[0];
const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');

async function tableExists() {
  const { error } = await supa.from('postcard_templates').select('id').limit(1);
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
  if (!pat) return { ok: false, reason: 'no access token' };
  const resp = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pat}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await resp.text();
  if (!resp.ok) return { ok: false, reason: `management api ${resp.status}` };
  return { ok: true, detail: text.slice(0, 120) };
}

async function runViaSupabaseCli() {
  const conn = dbUrl();
  if (!conn) return { ok: false, reason: 'no database password' };
  try {
    execSync(`npx supabase db query --file "${MIGRATION_FILE}" --db-url "${conn}"`, {
      stdio: 'inherit',
      cwd: ROOT,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: String(err.message || err).slice(0, 200) };
  }
}

function loadRows() {
  if (!fs.existsSync(JSON_FILE)) return [];
  const parsed = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
  return Array.isArray(parsed) ? parsed : [];
}

function rowForDb(row) {
  const front = { ...(row.front || { background: '#0b0b0d', elements: [] }) };
  if (row.layouts && !front.__sizeLayouts) front.__sizeLayouts = row.layouts;
  return {
    id: row.id,
    account_key: String(row.account_key || 'default').trim().toLowerCase(),
    name: row.name || 'Untitled template',
    category: row.category || 'Uncategorized',
    format: row.format || '6x9',
    front,
    back: row.back || { background: '#141416', elements: [] },
    is_starter: false,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

async function main() {
  if (!(await tableExists())) {
    console.log('Creating postcard_templates…');
    let created = await runViaSupabaseCli();
    if (!created.ok) {
      console.log('Database password path skipped:', created.reason);
      created = await runViaMgmtApi();
    }
    if (!created.ok) {
      console.log('Access token path skipped:', created.reason);
      console.error('Could not create postcard_templates. Paste supabase/migrations/003_postcard_templates.sql into the Supabase SQL editor, then run this script again.');
      process.exit(2);
    }
    for (let i = 0; i < 8; i += 1) {
      if (await tableExists()) break;
      await new Promise((r) => setTimeout(r, 700));
    }
  }
  if (!(await tableExists())) {
    console.error('Table still not readable.');
    process.exit(2);
  }
  console.log('postcard_templates is ready');

  const rows = loadRows().map(rowForDb).filter((row) => row.id && row.name);
  if (!rows.length) {
    console.log('No local templates to copy');
    return;
  }
  const { error } = await supa.from('postcard_templates').upsert(rows);
  if (error) {
    console.error('Copy failed:', error.message);
    process.exit(1);
  }
  console.log(`Copied ${rows.length} template(s): ${rows.map((r) => r.name).join(', ')}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
