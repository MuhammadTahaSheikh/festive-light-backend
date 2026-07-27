import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { GOOGLE_MAPS_API_KEY } from '../config/env.js';
import { RENDERS_DIR, PUBLIC_DIR } from '../config/paths.js';
import { getSeasonVariants, setSeasonVariant } from '../db/seasonVariants.js';
import { geocodeAddress, fetchStreetViewImage } from './maps.js';
import { resolveStreetViewForAddress } from './streetviewValidate.js';
import { doRender, activeProvider } from './render.js';

/** Seasons homeowners can preview on the quote page (unique vs single-scheme mailers). */
export const SEASON_SWITCH_SCHEMES = [
  { id: 'warm-white', label: 'Every night', sub: 'Warm white' },
  { id: 'christmas', label: 'Christmas', sub: 'Red & green' },
  { id: 'july-4th', label: 'July 4th', sub: 'Red, white & blue' },
  { id: 'halloween', label: 'Halloween', sub: 'Orange & purple' },
];

const SCHEME_IDS = new Set(SEASON_SWITCH_SCHEMES.map((s) => s.id));

export function seasonMeta() {
  return SEASON_SWITCH_SCHEMES;
}

export async function buildSeasonGallery(render) {
  const cached = await getSeasonVariants(render.id);
  const primary = render.scheme || 'warm-white';
  const gallery = {};
  for (const { id } of SEASON_SWITCH_SCHEMES) {
    if (id === primary && render.image_url) {
      gallery[id] = render.image_url;
    } else if (cached[id]) {
      gallery[id] = cached[id];
    }
  }
  return { primary, gallery, available: Object.keys(gallery) };
}

function loadExistingRenderFile(render) {
  const rel = String(render.image_url || '').replace(/^\//, '');
  if (!rel) return null;
  const filePath = path.join(PUBLIC_DIR, rel);
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
  return { buffer, mimeType };
}

async function loadSourceForSeason(render) {
  if (render.address && GOOGLE_MAPS_API_KEY) {
    const geo = await geocodeAddress(render.address);
    if (geo?.lat && geo?.lng) {
      const sv = await resolveStreetViewForAddress(
        { lat: geo.lat, lng: geo.lng, address: render.address },
        fetchStreetViewImage,
      );
      if (sv.ok) {
        return { buffer: sv.buffer, mimeType: sv.mimeType, source: 'streetview' };
      }
    }
  }
  const file = loadExistingRenderFile(render);
  if (file) return { ...file, source: 'render_file' };
  return null;
}

export async function resolveSeasonImage(render, scheme) {
  if (!render?.id || !render.image_url) {
    throw new Error('render_not_found');
  }
  if (!SCHEME_IDS.has(scheme)) {
    throw new Error('invalid_season');
  }
  const primary = render.scheme || 'warm-white';
  if (scheme === primary) {
    return { imageUrl: render.image_url, cached: true, generated: false };
  }

  const variants = await getSeasonVariants(render.id);
  if (variants[scheme]) {
    console.log(`[season] cache hit ${render.id} ${scheme}`);
    return { imageUrl: variants[scheme], cached: true, generated: false };
  }

  if (activeProvider() === 'none') {
    throw new Error('render_unavailable');
  }

  console.log(`[season] generating ${render.id} ${scheme} (Gemini billed once, then cached)`);
  const source = await loadSourceForSeason(render);
  if (!source) {
    throw new Error('season_source_unavailable');
  }

  const rendered = await doRender(source.buffer, source.mimeType, {
    scheme,
    customColors: [],
    landscape: Boolean(render.landscape),
    decor: render.decor || 'none',
    decorColor: 'warm-white',
    serviceType: 'permanent',
  });

  const ext = rendered.mimeType.includes('png') ? 'png' : 'jpg';
  const filename = `${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(RENDERS_DIR, filename), rendered.buffer);
  const imageUrl = `/renders/${filename}`;
  await setSeasonVariant(render.id, scheme, imageUrl);

  return { imageUrl, cached: false, generated: true };
}
