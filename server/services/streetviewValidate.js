import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY } from '../config/env.js';
import { fetchBuildingSqft } from './property.js';

const genai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;
const VALIDATE_MODEL = process.env.GEMINI_VALIDATE_MODEL || 'gemini-2.0-flash';

const VALIDATE_PROMPT = `You validate Google Street View photos for a permanent roofline lighting app.

Reply with ONLY compact JSON, no markdown:
{"houseVisible": true}
or
{"houseVisible": false, "reason": "brief reason"}

Set houseVisible to TRUE only when a clear building facade (home, townhome, or commercial building) is visible and large enough that roofline lights could be installed along its eaves or architectural edges.

Set FALSE when the view is mostly road, street, pavement, parking lot, empty lot, field, water, sky, the building is too far away or too small, trees fully block the structure, or no building front is facing the camera.`;

function parseHouseVisible(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function alternateHeadings(baseHeading) {
  const base = ((Number(baseHeading) % 360) + 360) % 360;
  const offsets = [0, 90, -90, 180];
  const seen = new Set();
  return offsets
    .map((o) => Math.round((base + o + 360) % 360))
    .filter((h) => {
      if (seen.has(h)) return false;
      seen.add(h);
      return true;
    });
}

function footprintOk(building) {
  return Boolean(building?.sqft > 0 || building?.perimeterFt > 0);
}

/** Ask Gemini whether the Street View frame shows a usable building facade. */
async function streetViewShowsHouse(imageBuffer, mimeType) {
  if (!genai) return { ok: true, method: 'skipped' };

  try {
    const response = await genai.models.generateContent({
      model: VALIDATE_MODEL,
      contents: [
        { inlineData: { mimeType, data: imageBuffer.toString('base64') } },
        { text: VALIDATE_PROMPT },
      ],
      config: { temperature: 0.1 },
    });
    const text = response?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text)
      .filter(Boolean)
      .join('') || '';
    const parsed = parseHouseVisible(text);
    if (parsed?.houseVisible === false) {
      return { ok: false, reason: parsed.reason || 'no_building_visible', method: 'gemini' };
    }
    if (parsed?.houseVisible === true) {
      return { ok: true, method: 'gemini' };
    }
    return { ok: true, method: 'parse_fallback' };
  } catch (err) {
    console.warn('[streetviewValidate] Gemini check failed:', err.message);
    return { ok: true, method: 'error_fallback' };
  }
}

/**
 * Fetch Street View for an address, rotate through headings, and reject road-only views.
 * @param {{ lat: number, lng: number, address?: string }} target
 * @param {Function} fetchFn maps.fetchStreetViewImage
 * @param {{ skipVisualCheck?: boolean }} [options] When true (address preview), return the
 *   geocode-aimed frame only — no Gemini and no ±90°/180° heading retries.
 */
export async function resolveStreetViewForAddress(target, fetchFn, options = {}) {
  const skipVisualCheck = Boolean(options.skipVisualCheck);
  const primary = await fetchFn(target);
  if (!primary.ok) return { ok: false, status: primary.status };

  const building = await fetchBuildingSqft(target.lat, target.lng);

  if (skipVisualCheck) {
    return {
      ok: true,
      buffer: primary.buffer,
      mimeType: primary.mimeType,
      heading: primary.heading,
      panoId: primary.panoId,
      verifiedAddress: primary.verifiedAddress || null,
      building,
    };
  }

  const headings = alternateHeadings(primary.heading);

  for (const heading of headings) {
    const sv = heading === primary.heading
      ? primary
      : await fetchFn(target, { heading });
    if (!sv.ok) continue;

    const visual = await streetViewShowsHouse(sv.buffer, sv.mimeType);
    if (!visual.ok) continue;

    const hasFootprint = footprintOk(building);
    if (!hasFootprint && visual.method === 'skipped') {
      continue;
    }
    if (!hasFootprint && visual.method !== 'skipped') {
      // Gemini confirmed a building even without OSM footprint (e.g. rural).
      return {
        ok: true,
        buffer: sv.buffer,
        mimeType: sv.mimeType,
        heading: sv.heading ?? heading,
        panoId: sv.panoId,
        verifiedAddress: sv.verifiedAddress || null,
        building,
      };
    }

    return {
      ok: true,
      buffer: sv.buffer,
      mimeType: sv.mimeType,
      heading: sv.heading ?? heading,
      panoId: sv.panoId,
      verifiedAddress: sv.verifiedAddress || null,
      building,
    };
  }

  return { ok: false, status: 'NO_HOUSE_VISIBLE' };
}
