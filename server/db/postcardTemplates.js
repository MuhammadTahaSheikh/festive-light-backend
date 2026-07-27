import crypto from 'node:crypto';
import { supa, readJson, writeJson } from './client.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STARTER_TEMPLATES } from '../services/postcardStarters.js';
import { stripCoveredRenderSlots } from '../services/postcardPdf.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, '..', '..', 'data', 'postcard_templates.json');

/** Cached after first Supabase miss — table may not exist until migration 003 is applied. */
let supaTableAvailable = supa ? null : false;

function readAll() {
  return readJson(FILE);
}

function writeAll(rows) {
  writeJson(FILE, rows);
}

function normKey(accountKey) {
  return String(accountKey || 'default').trim().toLowerCase();
}

function missingTableError(error) {
  const msg = String(error?.message || error);
  return /postcard_templates|schema cache|does not exist|PGRST/i.test(msg);
}

function listJson(key) {
  return readAll().filter((t) => (t.account_key || 'default') === key);
}

function cleanSides(payload) {
  return {
    ...payload,
    front: stripCoveredRenderSlots(payload.front),
    back: stripCoveredRenderSlots(payload.back),
  };
}

async function listCustom(key) {
  if (supa && supaTableAvailable !== false) {
    const { data, error } = await supa
      .from('postcard_templates')
      .select('*')
      .eq('account_key', key)
      .order('updated_at', { ascending: false });
    if (error) {
      if (missingTableError(error)) {
        supaTableAvailable = false;
        return listJson(key);
      }
      throw new Error(error.message);
    }
    supaTableAvailable = true;
    return data || [];
  }
  return listJson(key);
}

export async function listPostcardTemplates(accountKey = 'default') {
  const key = normKey(accountKey);
  const custom = await listCustom(key);
  return { starters: STARTER_TEMPLATES, custom };
}

export async function getPostcardTemplate(id, accountKey = 'default') {
  const starter = STARTER_TEMPLATES.find((t) => t.id === id);
  if (starter) return { ...starter, is_starter: true };
  const key = normKey(accountKey);
  if (supa && supaTableAvailable !== false) {
    const { data, error } = await supa.from('postcard_templates').select('*').eq('id', id).maybeSingle();
    if (error) {
      if (missingTableError(error)) {
        supaTableAvailable = false;
        return readAll().find((t) => t.id === id && (t.account_key || 'default') === key) || null;
      }
      throw new Error(error.message);
    }
    if (data && data.account_key === key) return data;
    return null;
  }
  return readAll().find((t) => t.id === id && (t.account_key || 'default') === key) || null;
}

export async function savePostcardTemplate(accountKey, payload) {
  const key = normKey(accountKey);
  const now = new Date().toISOString();
  const cleaned = cleanSides(payload || {});
  const row = {
    id: cleaned.id || crypto.randomUUID(),
    account_key: key,
    name: cleaned.name || 'Untitled template',
    category: cleaned.category || 'Uncategorized',
    format: cleaned.format || '6x9',
    front: cleaned.front || { background: '#0b0b0d', elements: [] },
    back: cleaned.back || { background: '#141416', elements: [] },
    is_starter: false,
    created_at: cleaned.created_at || now,
    updated_at: now,
  };

  if (supa && supaTableAvailable !== false) {
    const { data, error } = await supa.from('postcard_templates').upsert(row).select().maybeSingle();
    if (error) {
      if (missingTableError(error)) {
        supaTableAvailable = false;
      } else {
        throw new Error(error.message);
      }
    } else {
      return data || row;
    }
  }

  const rows = readAll();
  const idx = rows.findIndex((t) => t.id === row.id);
  if (idx >= 0) rows[idx] = { ...rows[idx], ...row, created_at: rows[idx].created_at || now };
  else rows.push(row);
  writeAll(rows);
  return row;
}

export async function deletePostcardTemplate(id, accountKey = 'default') {
  const key = normKey(accountKey);
  if (STARTER_TEMPLATES.some((t) => t.id === id)) {
    throw new Error('cannot_delete_starter');
  }
  if (supa && supaTableAvailable !== false) {
    const { error } = await supa.from('postcard_templates').delete().eq('id', id).eq('account_key', key);
    if (error) {
      if (missingTableError(error)) {
        supaTableAvailable = false;
      } else {
        throw new Error(error.message);
      }
    } else {
      return true;
    }
  }
  writeAll(readAll().filter((t) => !(t.id === id && (t.account_key || 'default') === key)));
  return true;
}

export async function cloneStarterTemplate(accountKey, starterId, name) {
  const starter = STARTER_TEMPLATES.find((t) => t.id === starterId);
  if (!starter) throw new Error('starter_not_found');
  return savePostcardTemplate(accountKey, {
    name: name || `${starter.name} (copy)`,
    category: starter.category,
    format: starter.format,
    front: JSON.parse(JSON.stringify(starter.front)),
    back: JSON.parse(JSON.stringify(starter.back)),
  });
}
