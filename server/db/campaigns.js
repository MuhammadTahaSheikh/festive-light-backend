import crypto from 'node:crypto';
import { supa, CAMPAIGNS_FILE, HOMES_FILE, readJson, appendJson, writeJson, insertRows } from './client.js';

export async function saveCampaign(campaign) {
  const row = {
    id: crypto.randomUUID(),
    name: campaign.name || 'Untitled campaign',
    area: campaign.area || null,
    status: campaign.status || 'active',
    notes: campaign.notes || null,
    created_by: campaign.created_by || null,
    created_at: new Date().toISOString(),
  };
  if (supa) {
    const inserted = await insertRows('campaigns', row);
    return inserted[0] || row;
  }
  appendJson(CAMPAIGNS_FILE, row);
  return row;
}

export async function getCampaign(id) {
  if (!id) return null;
  if (supa) {
    const { data, error } = await supa.from('campaigns').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data || null;
  }
  return readJson(CAMPAIGNS_FILE).find((c) => c.id === id) || null;
}

export async function listCampaigns(limit = 200) {
  if (supa) {
    const { data, error } = await supa
      .from('campaigns').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
  }
  return readJson(CAMPAIGNS_FILE).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, limit);
}

function homeRow(home) {
  const row = {
    id: crypto.randomUUID(),
    campaign_id: home.campaign_id,
    address: home.address,
    status: home.status || 'prospect',
    render_id: home.render_id || null,
    estimated_total: home.estimated_total ?? null,
    owner_name: home.owner_name || null,
    owner_phone: home.owner_phone || null,
    owner_email: home.owner_email || null,
    notes: home.notes || null,
    created_by: home.created_by || null,
    created_at: new Date().toISOString(),
  };
  // JSON fallback stores map coordinates; Supabase needs migration 001 for lat/lng columns.
  if (!supa) {
    row.lat = home.lat ?? null;
    row.lng = home.lng ?? null;
    row.place_id = home.place_id || null;
  }
  return row;
}

export async function addCampaignHome(home) {
  const row = homeRow(home);
  if (supa) {
    const inserted = await insertRows('campaign_homes', row);
    return inserted[0] || row;
  }
  appendJson(HOMES_FILE, row);
  return row;
}

export async function listCampaignHomes(campaignId) {
  if (supa) {
    const { data, error } = await supa
      .from('campaign_homes').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  }
  return readJson(HOMES_FILE).filter((h) => h.campaign_id === campaignId);
}

/** Find a campaign home linked to a quote/render (for Quotes page mail preview). Prefers a row with owner_name. */
export async function findCampaignHomeByRenderId(renderId) {
  if (!renderId) return null;
  if (supa) {
    const { data, error } = await supa
      .from('campaign_homes')
      .select('*')
      .eq('render_id', renderId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    const rows = data || [];
    return rows.find((h) => String(h.owner_name || '').trim()) || rows[0] || null;
  }
  const rows = readJson(HOMES_FILE)
    .filter((h) => h.render_id === renderId)
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  return rows.find((h) => String(h.owner_name || '').trim()) || rows[0] || null;
}

export async function bulkAddCampaignHomes(campaignId, homes, createdBy = null) {
  if (!homes?.length) return { added: [], skipped: 0 };
  const existing = await listCampaignHomes(campaignId);
  const seen = new Set(existing.map((h) => (h.address || '').toLowerCase().trim()));
  const toAdd = [];
  let skipped = 0;
  for (const h of homes) {
    const addr = (h.address || '').trim();
    if (!addr) { skipped++; continue; }
    const key = addr.toLowerCase();
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);
    toAdd.push(homeRow({
      ...h,
      campaign_id: campaignId,
      created_by: h.created_by || createdBy || null,
    }));
  }
  if (!toAdd.length) return { added: [], skipped };

  if (supa) {
    const data = await insertRows('campaign_homes', toAdd);
    return { added: data || [], skipped };
  }
  const rows = readJson(HOMES_FILE);
  rows.push(...toAdd);
  writeJson(HOMES_FILE, rows);
  return { added: toAdd, skipped };
}

export async function updateCampaign(id, fields) {
  const allowed = ['name', 'area', 'status', 'notes', 'selection_geojson', 'default_scheme', 'default_price_per_foot'];
  const patch = {};
  for (const k of allowed) if (k in fields) patch[k] = fields[k];
  if (!Object.keys(patch).length) return getCampaign(id);
  if (supa) {
    const { data, error } = await supa.from('campaigns').update(patch).eq('id', id).select().maybeSingle();
    if (error) {
      if (/default_price_per_foot|default_scheme|selection_geojson|schema cache/i.test(error.message)) {
        throw new Error(
          'Pricing columns missing in Supabase. Run supabase/migrations/001_outreach_columns.sql in the SQL Editor (or: node scripts/setup-outreach-columns.js).',
        );
      }
      throw new Error(error.message);
    }
    return data;
  }
  const rows = readJson(CAMPAIGNS_FILE);
  const idx = rows.findIndex((c) => c.id === id);
  if (idx >= 0) {
    rows[idx] = { ...rows[idx], ...patch };
    writeJson(CAMPAIGNS_FILE, rows);
    return rows[idx];
  }
  return null;
}

export async function updateCampaignHome(id, fields) {
  const allowed = ['status', 'address', 'estimated_total', 'render_id', 'owner_name', 'owner_phone', 'owner_email', 'notes', 'lat', 'lng', 'place_id', 'mail_status', 'lob_postcard_id', 'mail_template_id', 'mailed_at'];
  const patch = {};
  for (const k of allowed) if (k in fields) patch[k] = fields[k];
  if (supa) {
    const { data, error } = await supa.from('campaign_homes').update(patch).eq('id', id).select().maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }
  const rows = readJson(HOMES_FILE);
  const idx = rows.findIndex((h) => h.id === id);
  if (idx >= 0) {
    rows[idx] = { ...rows[idx], ...patch };
    writeJson(HOMES_FILE, rows);
    return rows[idx];
  }
  return null;
}
