import { GOOGLE_MAPS_API_KEY } from '../config/env.js';
import { overpassQuery, USER_AGENT } from './overpass.js';

function distM(aLat, aLng, bLat, bLng) {
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((aLat * Math.PI) / 180);
  const dLat = (bLat - aLat) * mPerDegLat;
  const dLng = (bLng - aLng) * mPerDegLng;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function centroidFromElement(el) {
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  const geom = el.geometry;
  if (!geom || geom.length < 1) return null;
  const lat = geom.reduce((s, g) => s + g.lat, 0) / geom.length;
  const lng = geom.reduce((s, g) => s + g.lon, 0) / geom.length;
  return { lat, lng };
}

function polygonToOverpass(polygon) {
  return polygon.map((p) => `${p.lat} ${p.lng}`).join(' ');
}

function dedupeByLocation(points, minDistM = 8) {
  const out = [];
  for (const p of points) {
    const dup = out.some((q) => distM(p.lat, p.lng, q.lat, q.lng) < minDistM);
    if (!dup) out.push(p);
  }
  return out;
}

function normalizeAddressKey(address) {
  return String(address || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function dedupeByAddress(houses) {
  const seen = new Set();
  const out = [];
  for (const h of houses) {
    const key = normalizeAddressKey(h.address);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

function polygonBBox(polygon) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of polygon) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  return { minLat, maxLat, minLng, maxLng };
}

function pointInPolygon(lat, lng, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersect = ((yi > lat) !== (yj > lat))
      && (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function samplePointsInPolygon(polygon, { spacingM = 28, maxPoints = 350 } = {}) {
  const bbox = polygonBBox(polygon);
  const midLat = (bbox.minLat + bbox.maxLat) / 2;
  const latStep = spacingM / 111320;
  const lngStep = spacingM / (111320 * Math.cos((midLat * Math.PI) / 180));
  const points = [];
  for (let lat = bbox.minLat + latStep / 2; lat <= bbox.maxLat; lat += latStep) {
    for (let lng = bbox.minLng + lngStep / 2; lng <= bbox.maxLng; lng += lngStep) {
      if (pointInPolygon(lat, lng, polygon)) points.push({ lat, lng });
    }
  }
  if (points.length > maxPoints) {
    const scale = Math.sqrt(points.length / maxPoints);
    return samplePointsInPolygon(polygon, { spacingM: spacingM * scale, maxPoints });
  }
  return points;
}

function samplePointsInCircle(lat, lng, radiusM, { spacingM = 28, maxPoints = 350 } = {}) {
  const latStep = spacingM / 111320;
  const lngStep = spacingM / (111320 * Math.cos((lat * Math.PI) / 180));
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  const points = [];
  for (let la = lat - dLat; la <= lat + dLat; la += latStep) {
    for (let ln = lng - dLng; ln <= lng + dLng; ln += lngStep) {
      if (distM(lat, lng, la, ln) <= radiusM) points.push({ lat: la, lng: ln });
    }
  }
  if (points.length > maxPoints) {
    const scale = Math.sqrt(points.length / maxPoints);
    return samplePointsInCircle(lat, lng, radiusM, { spacingM: spacingM * scale, maxPoints });
  }
  return points;
}

async function googleReverseGeocodeResidential(lat, lng) {
  if (!GOOGLE_MAPS_API_KEY) return null;
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${lat},${lng}`);
    url.searchParams.set('key', GOOGLE_MAPS_API_KEY);
    url.searchParams.set('result_type', 'street_address|premise|subpremise');
    const data = await fetch(url).then((r) => r.json());
    for (const r of data.results || []) {
      const hasNumber = (r.address_components || []).some((c) => c.types?.includes('street_number'));
      if (!hasNumber || !r.formatted_address) continue;
      return { lat, lng, address: r.formatted_address };
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function discoverFromGoogleSamples(points, limit) {
  if (!GOOGLE_MAPS_API_KEY || !points.length) return [];
  const hits = [];
  let idx = 0;
  const concurrency = 4;
  async function worker() {
    while (idx < points.length) {
      const i = idx++;
      const p = points[i];
      const hit = await googleReverseGeocodeResidential(p.lat, p.lng);
      if (hit) hits.push(hit);
      if (i % concurrency === 0) await new Promise((r) => setTimeout(r, 120));
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return dedupeByLocation(dedupeByAddress(hits)).slice(0, limit);
}

function closePolygonRing(polygon) {
  if (!polygon?.length) return polygon;
  return polygon[0].lat === polygon[polygon.length - 1].lat
    && polygon[0].lng === polygon[polygon.length - 1].lng
    ? polygon
    : [...polygon, polygon[0]];
}

async function discoverFromOsmPolygon(ring, limit) {
  const polyStr = polygonToOverpass(ring);
  const query = `[out:json][timeout:120];
(
  way["building"](poly:"${polyStr}");
  node["building"](poly:"${polyStr}");
  relation["building"](poly:"${polyStr}");
);
out center;`;

  const data = await overpassQuery(query);
  const elements = data.elements || [];
  const centroids = [];
  for (const el of elements) {
    const c = centroidFromElement(el);
    if (c) centroids.push(c);
  }
  const unique = dedupeByLocation(centroids).slice(0, limit);
  const houses = await geocodeWithConcurrency(unique);
  return { total: centroids.length, returned: houses.length, houses, source: 'osm' };
}

export async function reverseGeocode(lat, lng) {
  if (GOOGLE_MAPS_API_KEY) {
    try {
      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      url.searchParams.set('latlng', `${lat},${lng}`);
      url.searchParams.set('key', GOOGLE_MAPS_API_KEY);
      url.searchParams.set('result_type', 'street_address|premise|subpremise');
      const data = await fetch(url).then((r) => r.json());
      const addr = data.results?.[0]?.formatted_address;
      if (addr) return addr;
    } catch {
      /* fall through */
    }
  }
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const data = await fetch(url, { headers: { 'User-Agent': USER_AGENT } }).then((r) => r.json());
    const a = data?.address;
    if (a) {
      const line1 = [a.house_number, a.road].filter(Boolean).join(' ');
      const city = a.city || a.town || a.village || a.hamlet;
      const state = a.state;
      const zip = a.postcode;
      if (line1 && city && state && zip) {
        const st = state.length === 2 ? state.toUpperCase() : state;
        return `${line1}, ${city}, ${st} ${zip}`;
      }
    }
    if (data?.display_name) return data.display_name;
  } catch {
    /* ignore */
  }
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

async function geocodeWithConcurrency(points, concurrency = 4) {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < points.length) {
      const i = idx++;
      const p = points[i];
      const address = await reverseGeocode(p.lat, p.lng);
      results[i] = { lat: p.lat, lng: p.lng, address };
      if (i % concurrency === 0) await new Promise((r) => setTimeout(r, 120));
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

/**
 * Find residential/commercial buildings inside a polygon.
 * @param {{ lat: number, lng: number }[]} polygon - closed ring (first point may repeat last)
 * @param {number} limit
 */
export async function discoverInPolygon(polygon, limit = 500) {
  if (!polygon || polygon.length < 3) {
    throw Object.assign(new Error('invalid_polygon'), { code: 'invalid_polygon' });
  }
  const ring = closePolygonRing(polygon);

  const osm = await discoverFromOsmPolygon(ring, limit);
  if (osm.returned > 0) return osm;

  const samplePoints = samplePointsInPolygon(ring.slice(0, -1));
  const houses = await discoverFromGoogleSamples(samplePoints, limit);
  return {
    total: houses.length,
    returned: houses.length,
    houses,
    source: houses.length ? 'google' : 'none',
  };
}

/**
 * Find nearest buildings around a point (neighbor outreach).
 */
export async function discoverNeighbors(lat, lng, count = 250) {
  if (lat == null || lng == null) {
    throw Object.assign(new Error('missing_location'), { code: 'missing_location' });
  }
  const radius = count >= 1000 ? 1200 : count >= 500 ? 800 : 500;
  const query = `[out:json][timeout:120];
(
  way["building"](around:${radius},${lat},${lng});
  node["building"](around:${radius},${lat},${lng});
  relation["building"](around:${radius},${lat},${lng});
);
out center;`;

  const data = await overpassQuery(query);
  const elements = data.elements || [];
  const withDist = [];
  for (const el of elements) {
    const c = centroidFromElement(el);
    if (!c) continue;
    withDist.push({ ...c, d: distM(lat, lng, c.lat, c.lng) });
  }
  withDist.sort((a, b) => a.d - b.d);
  const unique = dedupeByLocation(withDist).slice(0, count);
  const osmHouses = await geocodeWithConcurrency(unique);
  if (osmHouses.length > 0) {
    return {
      total: withDist.length,
      returned: osmHouses.length,
      houses: osmHouses,
      source: 'osm',
    };
  }

  const samplePoints = samplePointsInCircle(lat, lng, radius);
  const houses = await discoverFromGoogleSamples(samplePoints, count);
  return {
    total: houses.length,
    returned: houses.length,
    houses,
    source: houses.length ? 'google' : 'none',
  };
}
