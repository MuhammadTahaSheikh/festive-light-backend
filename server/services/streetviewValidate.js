import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY } from '../config/env.js';
import { fetchBuildingSqft } from './property.js';
import { fetchFacadeCandidates } from './maps.js';

const genai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;
// gemini-2.0-flash was shut down June 2026; use a current Flash model for the vision check.
const VALIDATE_MODEL = process.env.GEMINI_VALIDATE_MODEL || 'gemini-3.5-flash';

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

const FACADE_PROMPT = `Each frame is a Street View photo aimed at the same house.
Classify every frame. Reply ONLY JSON:
{"best":0,"frames":[{"index":0,"kind":"front"},{"index":1,"kind":"angle"}]}
kind "front" = straight-on from the street, front door and facade centered, the way Google Maps opens the address.
kind "angle" = the same house seen from the side, down the driveway, or at a sharp corner angle.
kind "neighbor" = a different house or garage fills the frame.
kind "blocked" = trees, hedges, or road, with no clear house facade.
best must be a "front" frame when one exists. Never pick "angle" or "neighbor" when a "front" frame exists.`;

function parseFacadeIndex(text, count) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return 0;
  try {
    const parsed = JSON.parse(match[0]);
    const frames = Array.isArray(parsed.frames) ? parsed.frames : [];
    const fronts = frames
      .filter((f) => f?.kind === 'front')
      .map((f) => Number(f.index))
      .filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < count);
    const best = Number(parsed.best);
    if (fronts.includes(best)) return best;
    if (fronts.length) return fronts[0];
    return Number.isInteger(best) && best >= 0 && best < count ? best : 0;
  } catch {
    return 0;
  }
}

/** Pick the camera that faces this house, not the neighbor in the foreground. */
async function pickFrontFacade(frames) {
  if (!genai || frames.length < 2) return 0;
  try {
    const parts = [];
    frames.forEach((frame, i) => {
      parts.push({ text: `Frame ${i}` });
      parts.push({
        inlineData: {
          mimeType: frame.mimeType || 'image/jpeg',
          data: frame.buffer.toString('base64'),
        },
      });
    });
    parts.push({ text: FACADE_PROMPT });
    const response = await genai.models.generateContent({
      model: VALIDATE_MODEL,
      contents: [{ role: 'user', parts }],
      config: { temperature: 0 },
    });
    const text = response?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text)
      .filter(Boolean)
      .join('') || '';
    return parseFacadeIndex(text, frames.length);
  } catch (err) {
    console.warn('[streetviewValidate] facade pick failed:', err.message);
    return 0;
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
function frameResult(sv, building) {
  return {
    ok: true,
    buffer: sv.buffer,
    mimeType: sv.mimeType,
    heading: sv.heading ?? null,
    panoId: sv.panoId,
    verifiedAddress: sv.verifiedAddress || null,
    building,
  };
}

export async function resolveStreetViewForAddress(target, fetchFn, options = {}) {
  const skipVisualCheck = Boolean(options.skipVisualCheck);
  const building = await fetchBuildingSqft(target.lat, target.lng);

  let frames = [];
  try {
    frames = await fetchFacadeCandidates(target);
  } catch (err) {
    console.warn('[streetview] facade search failed:', err.message);
  }
  if (!frames.length) {
    const primary = await fetchFn(target);
    if (!primary.ok) return { ok: false, status: primary.status };
    frames = [primary];
  }

  // Google Maps' own front camera already faces this house number. Keep it.
  const matchedFront = frames.find((frame) => frame.facesTarget);
  if (matchedFront) {
    if (skipVisualCheck) return frameResult(matchedFront, building);
    const visual = await streetViewShowsHouse(matchedFront.buffer, matchedFront.mimeType);
    if (visual.ok) return frameResult(matchedFront, building);
  }

  const best = frames.length > 1 ? await pickFrontFacade(frames) : 0;
  const ordered = [frames[best], ...frames.filter((_, i) => i !== best)];

  if (skipVisualCheck) return frameResult(ordered[0], building);

  for (const sv of ordered) {
    const visual = await streetViewShowsHouse(sv.buffer, sv.mimeType);
    if (!visual.ok) continue;
    const hasFootprint = footprintOk(building);
    if (!hasFootprint && visual.method === 'skipped') continue;
    return frameResult(sv, building);
  }

  // Same camera, other compass directions, when every aimed frame was trees or road.
  const fallback = ordered[0];
  for (const heading of alternateHeadings(fallback.heading)) {
    const sv = heading === fallback.heading
      ? fallback
      : await fetchFn(target, {
        heading,
        panoId: fallback.panoId,
        panoLat: fallback.panoLat,
        panoLng: fallback.panoLng,
      });
    if (!sv?.ok) continue;
    const visual = await streetViewShowsHouse(sv.buffer, sv.mimeType);
    if (!visual.ok) continue;
    return frameResult(sv, building);
  }

  return { ok: false, status: 'NO_HOUSE_VISIBLE' };
}
