import crypto from 'node:crypto';
import { supa, readJson, writeJson } from './client.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CREDITS_FILE = path.join(__dirname, '..', '..', 'data', 'credits.json');
const TX_FILE = path.join(__dirname, '..', '..', 'data', 'credit_transactions.json');

/** When Supabase is configured but credit tables were never migrated, use local JSON. */
let forceLocal = false;

function normKey(accountKey) {
  return String(accountKey || 'default').trim().toLowerCase() || 'default';
}

function isMissingTableError(err) {
  const msg = String(err?.message || err || '');
  return /Could not find the table|schema cache|does not exist/i.test(msg);
}

function useSupa() {
  return Boolean(supa) && !forceLocal;
}

function readAccounts() {
  const raw = readJson(CREDITS_FILE);
  if (Array.isArray(raw)) {
    const map = {};
    for (const row of raw) map[row.account_key] = row;
    return map;
  }
  return raw && typeof raw === 'object' ? raw : {};
}

function writeAccounts(map) {
  writeJson(CREDITS_FILE, map);
}

function getLocalBalance(key, startingBalance) {
  const map = readAccounts();
  if (!map[key]) {
    map[key] = { account_key: key, balance: startingBalance, updated_at: new Date().toISOString() };
    writeAccounts(map);
  }
  return map[key];
}

function setLocalBalance(key, acct, balance) {
  const map = readAccounts();
  map[key] = { ...acct, balance, updated_at: new Date().toISOString() };
  writeAccounts(map);
}

export async function getCreditBalance(accountKey, startingBalance = 5) {
  const key = normKey(accountKey);
  if (useSupa()) {
    try {
      const { data, error } = await supa.from('credit_accounts').select('*').eq('account_key', key).maybeSingle();
      if (error) throw new Error(error.message);
      if (data) return { account_key: key, balance: data.balance, updated_at: data.updated_at };
      const row = { account_key: key, balance: startingBalance, updated_at: new Date().toISOString() };
      const { error: insErr } = await supa.from('credit_accounts').insert(row);
      if (insErr) throw new Error(insErr.message);
      return row;
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
      forceLocal = true;
      console.warn('[credits] credit_accounts missing in Supabase — using local JSON store');
    }
  }
  return getLocalBalance(key, startingBalance);
}

async function logTransaction(accountKey, delta, reason, meta = {}) {
  const row = {
    id: crypto.randomUUID(),
    account_key: normKey(accountKey),
    delta,
    reason,
    meta,
    created_at: new Date().toISOString(),
  };
  if (useSupa()) {
    try {
      const { error } = await supa.from('credit_transactions').insert(row);
      if (error) throw new Error(error.message);
      return row;
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
      forceLocal = true;
    }
  }
  const txs = readJson(TX_FILE);
  if (!Array.isArray(txs)) {
    writeJson(TX_FILE, [row]);
  } else {
    txs.push(row);
    writeJson(TX_FILE, txs);
  }
  return row;
}

export async function addCredits(accountKey, amount, reason, meta = {}) {
  const n = Math.round(Number(amount));
  if (n <= 0) throw new Error('invalid_amount');
  const acct = await getCreditBalance(accountKey);
  const next = acct.balance + n;
  const key = normKey(accountKey);
  if (useSupa()) {
    try {
      const { error } = await supa.from('credit_accounts').update({ balance: next, updated_at: new Date().toISOString() }).eq('account_key', key);
      if (error) throw new Error(error.message);
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
      forceLocal = true;
      setLocalBalance(key, acct, next);
    }
  } else {
    setLocalBalance(key, acct, next);
  }
  await logTransaction(key, n, reason, meta);
  return { balance: next };
}

export async function deductCredits(accountKey, amount, reason, meta = {}) {
  const n = Math.round(Number(amount));
  if (n <= 0) throw new Error('invalid_amount');
  const acct = await getCreditBalance(accountKey);
  if (acct.balance < n) {
    const err = new Error('insufficient_credits');
    err.code = 'insufficient_credits';
    err.balance = acct.balance;
    err.required = n;
    throw err;
  }
  const next = acct.balance - n;
  const key = normKey(accountKey);
  if (useSupa()) {
    try {
      const { error } = await supa.from('credit_accounts').update({ balance: next, updated_at: new Date().toISOString() }).eq('account_key', key);
      if (error) throw new Error(error.message);
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
      forceLocal = true;
      setLocalBalance(key, acct, next);
    }
  } else {
    setLocalBalance(key, acct, next);
  }
  await logTransaction(key, -n, reason, meta);
  return { balance: next };
}

export async function listCreditTransactions(accountKey, limit = 50) {
  const key = normKey(accountKey);
  if (useSupa()) {
    try {
      const { data, error } = await supa
        .from('credit_transactions')
        .select('*')
        .eq('account_key', key)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return data || [];
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
      forceLocal = true;
    }
  }
  const txs = readJson(TX_FILE);
  return (Array.isArray(txs) ? txs : []).filter((t) => t.account_key === key).slice(-limit).reverse();
}

/** One-time import from data/credits.json + credit_transactions.json into Supabase. */
export async function migrateCreditsFileToDb() {
  if (!supa) return { ok: false, reason: 'no_supabase' };

  const accountsMap = readAccounts();
  const accounts = Object.values(accountsMap);
  if (!accounts.length) return { ok: true, accounts: 0, transactions: 0, skipped: 0 };

  let accountsUpserted = 0;
  for (const acct of accounts) {
    const row = {
      account_key: acct.account_key,
      balance: Math.max(0, Math.round(Number(acct.balance) || 0)),
      updated_at: acct.updated_at || new Date().toISOString(),
    };
    const { error } = await supa.from('credit_accounts').upsert(row, { onConflict: 'account_key' });
    if (error) throw new Error(`account ${acct.account_key}: ${error.message}`);
    accountsUpserted += 1;
  }

  const txs = readJson(TX_FILE);
  const list = Array.isArray(txs) ? txs : [];
  let inserted = 0;
  let skipped = 0;

  for (const tx of list) {
    if (!tx?.id || !tx?.account_key) continue;
    const { data: existing } = await supa.from('credit_transactions').select('id').eq('id', tx.id).maybeSingle();
    if (existing) {
      skipped += 1;
      continue;
    }
    const row = {
      id: tx.id,
      account_key: tx.account_key,
      delta: Math.round(Number(tx.delta) || 0),
      reason: String(tx.reason || 'unknown'),
      meta: tx.meta && typeof tx.meta === 'object' ? tx.meta : {},
      created_at: tx.created_at || new Date().toISOString(),
    };
    const { error } = await supa.from('credit_transactions').insert(row);
    if (error) throw new Error(`tx ${tx.id}: ${error.message}`);
    inserted += 1;
  }

  return { ok: true, accounts: accountsUpserted, transactions: inserted, skipped };
}
