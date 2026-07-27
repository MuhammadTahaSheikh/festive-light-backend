import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, '..', '..', 'data');

export const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
export const RENDERS_FILE = path.join(DATA_DIR, 'renders.json');
export const CAMPAIGNS_FILE = path.join(DATA_DIR, 'campaigns.json');
export const HOMES_FILE = path.join(DATA_DIR, 'campaign_homes.json');

export const supa = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

export const dbMode = supa ? 'supabase' : 'json';
export const authMode = supa ? 'supabase' : 'demo';

fs.mkdirSync(DATA_DIR, { recursive: true });

export function readJson(file) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8') || '[]');
  } catch (_) {}
  return [];
}

export function appendJson(file, row) {
  const rows = readJson(file);
  rows.push(row);
  fs.writeFileSync(file, JSON.stringify(rows, null, 2));
}

export function writeJson(file, rows) {
  fs.writeFileSync(file, JSON.stringify(rows, null, 2));
}
