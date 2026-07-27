import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const ddl = fs.readFileSync(path.join(root, 'supabase/migrations/002_credits.sql'), 'utf8');
const accounts = Object.values(JSON.parse(fs.readFileSync(path.join(root, 'data/credits.json'), 'utf8')));
const txs = JSON.parse(fs.readFileSync(path.join(root, 'data/credit_transactions.json'), 'utf8'));

function esc(s) {
  return String(s).replace(/'/g, "''");
}

function jsonSql(obj) {
  return esc(JSON.stringify(obj ?? {}));
}

let sql = `-- Festive Lighting Pros: credit tables + import from local JSON
-- Run in Supabase Dashboard -> SQL Editor -> New query -> Run

${ddl}

-- Import account balances (from data/credits.json)
`;

for (const a of accounts) {
  sql += `insert into public.credit_accounts (account_key, balance, updated_at) values ('${esc(a.account_key)}', ${a.balance}, '${a.updated_at}') on conflict (account_key) do update set balance = excluded.balance, updated_at = excluded.updated_at;\n`;
}

sql += '\n-- Import transaction history (from data/credit_transactions.json)\n';

for (const t of txs) {
  sql += `insert into public.credit_transactions (id, account_key, delta, reason, meta, created_at) values ('${t.id}', '${esc(t.account_key)}', ${t.delta}, '${esc(t.reason)}', '${jsonSql(t.meta)}'::jsonb, '${t.created_at}') on conflict (id) do nothing;\n`;
}

sql += `
-- Verify your accounts
select account_key, balance from public.credit_accounts
where account_key in ('tahasheikh682@gmail.com', 'mtahasheikh750@gmail.com');
`;

const out = path.join(__dirname, 'import-credits-to-supabase.sql');
fs.writeFileSync(out, sql);
console.log(`Wrote ${out} (${accounts.length} accounts, ${txs.length} transactions)`);
