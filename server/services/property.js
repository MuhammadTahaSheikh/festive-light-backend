import { GOOGLE_MAPS_API_KEY } from '../config/env.js';
import { overpassQuery } from './overpass.js';

const SQFT_PER_SQM = 10.7639104167;

function polygonAreaSqM(coords) {
  if (!coords || coords.length < 3) return 0;
  const lat0 = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const pts = coords.map((c) => ({ x: c.lon * mPerDegLng, y: c.lat * mPerDegLat }));
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    sum += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(sum) / 2;
}

function distM(aLat, aLng, bLat, bLng) {
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((aLat * Math.PI) / 180);
  const dLat = (bLat - aLat) * mPerDegLat;
  const dLng = (bLng - aLng) * mPerDegLng;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

async function solarBuildingSqft(lat, lng) {
  const url = new URL('https://solar.googleapis.com/v1/buildingInsights:findClosest');
  url.searchParams.set('location.latitude', String(lat));
  url.searchParams.set('location.longitude', String(lng));
  url.searchParams.set('requiredQuality', 'MEDIUM');
  const resp = await fetch(url, { headers: { 'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY } });
  const data = await resp.json();
  if (!resp.ok) return null;
  const groundM2 = data.solarPotential?.buildingStats?.groundAreaMeters2;
  const roofM2 = data.solarPotential?.wholeRoofStats?.areaMeters2;
  if (!groundM2 || groundM2 <= 0) return null;
  return {
    sqft: Math.round(groundM2 * SQFT_PER_SQM),
    roofSqft: roofM2 > 0 ? Math.round(roofM2 * SQFT_PER_SQM) : null,
    source: 'google_solar',
  };
}

function perimeterM(coords) {
  let p = 0;
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    p += distM(coords[i].lat, coords[i].lon, coords[j].lat, coords[j].lon);
  }
  return p;
}

function edgeLensM(coords) {
  const out = [];
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    out.push(distM(coords[i].lat, coords[i].lon, coords[j].lat, coords[j].lon));
  }
  return out.sort((a, b) => b - a);
}

async function osmBuildingSqft(lat, lng) {
  const query = `[out:json][timeout:25];way(around:35,${lat},${lng})["building"];out geom;`;
  let data;
  try {
    data = await overpassQuery(query, { timeoutMs: 35000 });
  } catch {
    return null;
  }
  if (!Array.isArray(data.elements) || !data.elements.length) return null;

  let best = null;
  for (const el of data.elements) {
    const geom = el.geometry;
    if (!geom || geom.length < 3) continue;
    const coords = geom.map((g) => ({ lat: g.lat, lon: g.lon }));
    const cx = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
    const cy = coords.reduce((s, c) => s + c.lon, 0) / coords.length;
    const d = distM(lat, lng, cx, cy);
    const areaM2 = polygonAreaSqM(coords);
    if (areaM2 < 20 || d > 28) continue;
    if (!best || d < best.d) {
      const edges = edgeLensM(coords);
      best = {
        d,
        areaM2,
        perimeterFt: Math.round(perimeterM(coords) * 3.28084),
        maxEdgeFt: Math.round(edges[0] * 3.28084),
      };
    }
  }
  if (!best) return null;
  return {
    sqft: Math.round(best.areaM2 * SQFT_PER_SQM),
    roofSqft: null,
    perimeterFt: best.perimeterFt,
    maxEdgeFt: best.maxEdgeFt,
    source: 'osm_footprint',
  };
}

/** Building footprint sqft for a lat/lng (not interior living area). */
export async function fetchBuildingSqft(lat, lng) {
  if (lat == null || lng == null) return null;

  let solar = null;
  let osm = null;

  if (GOOGLE_MAPS_API_KEY) {
    try {
      solar = await solarBuildingSqft(lat, lng);
    } catch {
      /* try OSM fallback */
    }
  }
  try {
    osm = await osmBuildingSqft(lat, lng);
  } catch {
    /* optional */
  }

  if (solar && osm) {
    return {
      sqft: Math.max(solar.sqft, osm.sqft),
      roofSqft: solar.roofSqft ?? osm.roofSqft ?? null,
      perimeterFt: osm.perimeterFt,
      maxEdgeFt: osm.maxEdgeFt,
      source: 'google_solar+osm_footprint',
    };
  }
  return solar || osm;
}
