import { GOOGLE_MAPS_API_KEY } from '../config/env.js';

/** Compass bearing from panorama capture point to a target point. */
function computeHeading(fromLat, fromLng, toLat, toLng) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const dLng = toRad(toLng - fromLng);
  const fromLatRad = toRad(fromLat);
  const toLatRad = toRad(toLat);
  const y = Math.sin(dLng) * Math.cos(toLatRad);
  const x = Math.cos(fromLatRad) * Math.sin(toLatRad)
    - Math.sin(fromLatRad) * Math.cos(toLatRad) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Move `distM` meters from lat/lng along compass bearing (degrees). */
function destinationPoint(lat, lng, bearingDeg, distM) {
  const R = 6371000;
  const br = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distM / R)
      + Math.cos(lat1) * Math.sin(distM / R) * Math.cos(br),
  );
  const lng2 = lng1 + Math.atan2(
    Math.sin(br) * Math.sin(distM / R) * Math.cos(lat1),
    Math.cos(distM / R) - Math.sin(lat1) * Math.sin(lat2),
  );
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

function houseNumberFromAddress(address) {
  const m = String(address || '').trim().match(/^(\d+[A-Za-z]?)\b/);
  return m ? m[1].toUpperCase() : '';
}

async function reverseGeocodeStreetNumber(lat, lng) {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('latlng', `${lat},${lng}`);
  url.searchParams.set('result_type', 'street_address|premise');
  url.searchParams.set('key', GOOGLE_MAPS_API_KEY);
  const data = await fetch(url).then((r) => r.json()).catch(() => null);
  const results = data?.results || [];
  for (const r of results) {
    const comp = (r.address_components || []).find((c) => c.types?.includes('street_number'));
    if (comp?.short_name) {
      return {
        number: String(comp.short_name).toUpperCase(),
        formatted: r.formatted_address || '',
      };
    }
    const fromFormatted = houseNumberFromAddress(r.formatted_address);
    if (fromFormatted) {
      return { number: fromFormatted, formatted: r.formatted_address || '' };
    }
  }
  return null;
}

/**
 * Aim at the curb that reverse-geocodes to this house number.
 * Google Maps' pegman often opens looking along the car's capture direction
 * (or at the opposite curb — e.g. Water Lily Way) which is NOT the lot pin.
 */
async function facadeHeading(panoLat, panoLng, targetLat, targetLng, address) {
  const direct = Math.round(computeHeading(panoLat, panoLng, targetLat, targetLng));
  const want = houseNumberFromAddress(address);
  if (!want) return { heading: direct, verifiedAddress: null };

  const opposite = Math.round((direct + 180) % 360);
  const candidates = [direct, opposite];
  let best = { heading: direct, verifiedAddress: null, score: -1 };

  for (const heading of candidates) {
    const sample = destinationPoint(panoLat, panoLng, heading, 22);
    const hit = await reverseGeocodeStreetNumber(sample.lat, sample.lng);
    if (!hit) continue;
    const score = hit.number === want ? 2 : 0;
    if (score > best.score) {
      best = { heading, verifiedAddress: hit.formatted, score };
    }
  }

  return { heading: best.heading, verifiedAddress: best.verifiedAddress };
}

/**
 * Prefer precise geocode coords for panorama lookup. Address-string lookup
 * can snap to a neighboring street name (e.g. Water Lily Way ↔ Arrowhead Run).
 */
function streetViewLocationParam(target) {
  if (Number.isFinite(target.lat) && Number.isFinite(target.lng)) {
    return `${target.lat},${target.lng}`;
  }
  return target.address?.trim() || '';
}

async function fetchStreetViewMetadata(locParam, radiusMeters) {
  const metaUrl = new URL('https://maps.googleapis.com/maps/api/streetview/metadata');
  metaUrl.searchParams.set('location', locParam);
  if (radiusMeters != null) metaUrl.searchParams.set('radius', String(radiusMeters));
  metaUrl.searchParams.set('source', 'outdoor');
  metaUrl.searchParams.set('key', GOOGLE_MAPS_API_KEY);
  const metaResp = await fetch(metaUrl);
  return metaResp.json();
}

/**
 * Fetch a Street View image aimed at the target home.
 * @param {{ lat: number, lng: number, address?: string }} target
 * @param {{ heading?: number }} [options]
 */
export async function fetchStreetViewImage(target, options = {}) {
  const locParam = streetViewLocationParam(target);
  if (!locParam) return { ok: false, status: 'ZERO_RESULTS' };

  // Prefer a tight radius so dense suburbs don't pick a neighbor's camera;
  // widen once if nothing is found.
  let meta = await fetchStreetViewMetadata(locParam, 40);
  if (meta.status !== 'OK' || !meta.location) {
    meta = await fetchStreetViewMetadata(locParam, 80);
  }
  if (meta.status !== 'OK' || !meta.location) {
    return { ok: false, status: meta.status };
  }

  const panoLat = meta.location.lat;
  const panoLng = meta.location.lng;
  let heading;
  let verifiedAddress = null;
  if (options.heading != null) {
    heading = Math.round(Number(options.heading));
  } else {
    const aimed = await facadeHeading(panoLat, panoLng, target.lat, target.lng, target.address);
    heading = aimed.heading;
    verifiedAddress = aimed.verifiedAddress;
  }

  const imgUrl = new URL('https://maps.googleapis.com/maps/api/streetview');
  imgUrl.searchParams.set('size', '640x640');
  if (meta.pano_id) imgUrl.searchParams.set('pano', meta.pano_id);
  else imgUrl.searchParams.set('location', locParam);
  imgUrl.searchParams.set('heading', String(heading));
  // Narrower FOV so one suburban lot usually dominates the frame.
  imgUrl.searchParams.set('fov', '55');
  // Slight upward pitch helps capture full roofline on taller buildings.
  imgUrl.searchParams.set('pitch', '5');
  imgUrl.searchParams.set('source', 'outdoor');
  imgUrl.searchParams.set('key', GOOGLE_MAPS_API_KEY);
  const imgResp = await fetch(imgUrl);
  if (!imgResp.ok) return { ok: false, status: 'IMAGE_FETCH_FAILED' };
  const buf = Buffer.from(await imgResp.arrayBuffer());
  return {
    ok: true,
    buffer: buf,
    mimeType: 'image/jpeg',
    heading,
    panoId: meta.pano_id,
    verifiedAddress,
  };
}

export async function geocodeAddress(address) {
  const g = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`,
  ).then((r) => r.json());
  const first = g.results?.[0];
  if (!first?.geometry?.location) return null;
  return {
    lat: first.geometry.location.lat,
    lng: first.geometry.location.lng,
    formattedAddress: first.formatted_address || address,
  };
}

/** Google Places API (New) autocomplete — requires GOOGLE_MAPS_API_KEY. */
async function googleAutocompleteAddress(input) {
  const resp = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
    },
    body: JSON.stringify({
      input,
      includedRegionCodes: ['us'],
      languageCode: 'en',
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw Object.assign(new Error('places_error'), { detail: data });
  return (data.suggestions || [])
    .filter((s) => s.placePrediction)
    .map((s) => {
      const p = s.placePrediction;
      const full = p.text?.text || '';
      const main = p.structuredFormat?.mainText?.text || full.split(',')[0] || full;
      const secondary = p.structuredFormat?.secondaryText?.text || '';
      const placeId = p.placeId || String(p.place || '').replace(/^places\//, '');
      return { placeId, main, secondary, full };
    })
    .filter((s) => s.full);
}

/** Address autocomplete via Photon (OpenStreetMap) — free fallback when Google is unavailable. */
async function osmAutocompleteAddress(input) {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', input);
  url.searchParams.set('limit', '5');
  url.searchParams.set('lang', 'en');
  const resp = await fetch(url, { headers: { 'User-Agent': 'FestiveLightingPros/1.0' } });
  const data = await resp.json();
  if (!resp.ok) throw Object.assign(new Error('places_error'), { detail: data });
  return (data.features || []).map((f) => {
    const p = f.properties || {};    const line1 = [p.housenumber, p.street || p.name].filter(Boolean).join(' ') || p.name || '';
    const line2 = [p.city || p.town || p.village, p.state, p.postcode, p.country]
      .filter(Boolean).join(', ');
    return {
      placeId: '',
      main: line1 || line2,
      secondary: line1 ? line2 : '',
      full: [line1, line2].filter(Boolean).join(', '),
    };
  }).filter((s) => s.full);
}

export async function autocompleteAddress(input) {
  if (GOOGLE_MAPS_API_KEY) {
    try {
      return await googleAutocompleteAddress(input);
    } catch (err) {
      console.warn('[maps] Google autocomplete failed, falling back to OSM:', err.detail || err.message);
    }
  }
  return osmAutocompleteAddress(input);
}

export async function placeDetails(placeId) {
  const id = String(placeId).replace(/^places\//, '');
  const resp = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, {
    headers: {
      'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask': 'location,formattedAddress',
    },
  });
  const data = await resp.json();
  if (!resp.ok) throw Object.assign(new Error('places_error'), { detail: data });
  const loc = data.location;
  return {
    formattedAddress: data.formattedAddress || '',
    location: loc ? { lat: loc.latitude, lng: loc.longitude } : null,
  };
}
