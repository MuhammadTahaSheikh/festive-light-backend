import crypto from 'node:crypto';
import { supa, LEADS_FILE, appendJson, insertRows, readJson } from './client.js';

export async function saveLead(lead) {
  const row = {
    id: crypto.randomUUID(),
    name: lead.name || null,
    email: lead.email || null,
    phone: lead.phone || null,
    address: lead.address || null,
    source: lead.source || 'widget',
    notes: lead.notes || null,
    ip: lead.ip || null,
    created_by: lead.created_by || null,
    created_at: new Date().toISOString(),
  };
  if (supa) {
    const inserted = await insertRows('leads', row);
    return inserted[0] || row;
  }
  appendJson(LEADS_FILE, row);
  return row;
}

export async function listLeads(limit = 200) {
  if (supa) {
    const { data, error } = await supa
      .from('leads').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
  }
  return readJson(LEADS_FILE).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, limit);
}
