import crypto from 'node:crypto';
import { supa, RENDERS_FILE, readJson, appendJson, insertRows } from './client.js';

export async function saveRender(render) {
  const row = {
    id: crypto.randomUUID(),
    address: render.address || null,
    image_url: render.image_url || null,
    scheme: render.scheme || null,
    landscape: Boolean(render.landscape),
    decor: render.decor || null,
    roofline_feet: render.roofline_feet ?? null,
    price_per_foot: render.price_per_foot ?? null,
    estimated_total: render.estimated_total ?? null,
    lead_email: render.lead_email || null,
    created_by: render.created_by || null,
    created_at: new Date().toISOString(),
  };
  if (supa) {
    const inserted = await insertRows('renders', row);
    return inserted[0] || row;
  }
  appendJson(RENDERS_FILE, row);
  return row;
}

export async function listRenders(limit = 200) {
  if (supa) {
    const { data, error } = await supa
      .from('renders').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
  }
  return readJson(RENDERS_FILE).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, limit);
}

export async function getRender(id) {
  if (!id) return null;
  if (supa) {
    const { data, error } = await supa.from('renders').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data || null;
  }
  return readJson(RENDERS_FILE).find((r) => r.id === id) || null;
}
