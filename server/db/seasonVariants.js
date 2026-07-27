import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, supa } from './client.js';

const FILE = path.join(DATA_DIR, 'season_variants.json');

/** Local file fallback: { [renderId]: { [scheme]: imageUrl } } */
function readFileAll() {
  try {
    if (!fs.existsSync(FILE)) return {};
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8') || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeFileAll(all) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(all, null, 2));
}

function fileGet(renderId) {
  if (!renderId) return {};
  const row = readFileAll()[renderId];
  return row && typeof row === 'object' && !Array.isArray(row) ? { ...row } : {};
}

function fileSet(renderId, scheme, imageUrl) {
  if (!renderId || !scheme || !imageUrl) return;
  const all = readFileAll();
  if (!all[renderId] || typeof all[renderId] !== 'object' || Array.isArray(all[renderId])) {
    all[renderId] = {};
  }
  all[renderId][scheme] = imageUrl;
  writeFileAll(all);
}

/**
 * All cached season image URLs for a quote/render.
 * Prefer Supabase; always merge with local JSON so we never lose a paid render.
 */
export async function getSeasonVariants(renderId) {
  if (!renderId) return {};
  const fromFile = fileGet(renderId);
  const out = { ...fromFile };

  if (supa) {
    const { data, error } = await supa
      .from('season_variants')
      .select('scheme, image_url')
      .eq('render_id', String(renderId));
    if (error) {
      console.warn('[season_variants] supabase read failed:', error.message);
    } else if (data?.length) {
      for (const row of data) {
        if (row.scheme && row.image_url) out[row.scheme] = row.image_url;
      }
    }
  }

  return out;
}

/** Persist one season preview. Upserts so repeat clicks never re-bill Gemini. */
export async function setSeasonVariant(renderId, scheme, imageUrl) {
  if (!renderId || !scheme || !imageUrl) return;

  // Always mirror to file so local recovery works if DB is briefly unavailable.
  fileSet(renderId, scheme, imageUrl);

  if (!supa) return;

  const { error } = await seasonUpsert(renderId, scheme, imageUrl);
  if (error) {
    console.warn('[season_variants] supabase write failed:', error.message);
  }
}

async function seasonUpsert(renderId, scheme, imageUrl) {
  return supa.from('season_variants').upsert(
    {
      render_id: String(renderId),
      scheme,
      image_url: imageUrl,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'render_id,scheme' },
  );
}

/** One-time: push local file cache rows into Supabase (safe to call on boot). */
export async function migrateSeasonVariantsFileToDb() {
  if (!supa) return { ok: false, reason: 'no_supabase' };
  const all = readFileAll();
  const ids = Object.keys(all);
  if (!ids.length) return { ok: true, upserted: 0 };

  const rows = [];
  for (const renderId of ids) {
    const schemes = all[renderId];
    if (!schemes || typeof schemes !== 'object') continue;
    for (const [scheme, imageUrl] of Object.entries(schemes)) {
      if (scheme && imageUrl) {
        rows.push({
          render_id: String(renderId),
          scheme,
          image_url: imageUrl,
          created_at: new Date().toISOString(),
        });
      }
    }
  }
  if (!rows.length) return { ok: true, upserted: 0 };

  const { error } = await supa.from('season_variants').upsert(rows, { onConflict: 'render_id,scheme' });
  if (error) {
    console.warn('[season_variants] migrate failed:', error.message);
    return { ok: false, reason: error.message };
  }
  console.log(`[season_variants] migrated ${rows.length} cached season image(s) to Supabase`);
  return { ok: true, upserted: rows.length };
}
