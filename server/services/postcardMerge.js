import { GOOGLE_MAPS_API_KEY } from '../config/env.js';
import { reverseGeocode } from './discovery.js';

function stripCountrySuffix(raw = '') {
  return String(raw || '')
    .trim()
    .replace(/,?\s*(USA|United States|U\.S\.A\.?)\s*$/i, '')
    .trim();
}

/** Parse a US mailing address string into Lob-compatible fields (best-effort). */
export function parseMailingAddress(full = '') {
  let raw = stripCountrySuffix(full);
  if (!raw) {
    return { name: 'Resident', address_line1: 'Unknown', address_city: 'Unknown', address_state: 'TX', address_zip: '00000' };
  }

  let parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  while (parts.length > 3 && /^(USA|United States|U\.S\.A\.?)$/i.test(parts[parts.length - 1])) {
    parts = parts.slice(0, -1);
  }
  if (parts.length >= 3) {
    const line1 = parts[0];
    const city = parts[parts.length - 2];
    const stateZip = parts[parts.length - 1];
    const m = stateZip.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
    if (m) {
      return {
        name: 'Homeowner',
        address_line1: line1,
        address_city: city,
        address_state: m[1].toUpperCase(),
        address_zip: m[2],
      };
    }
    const m2 = stateZip.match(/(.+?)\s+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)/);
    if (m2) {
      return {
        name: 'Homeowner',
        address_line1: line1,
        address_city: m2[1].trim() || city,
        address_state: m2[2].toUpperCase(),
        address_zip: m2[3],
      };
    }
    const mState = stateZip.match(/^([A-Za-z]{2})$/);
    if (mState) {
      return {
        name: 'Homeowner',
        address_line1: line1,
        address_city: city,
        address_state: mState[1].toUpperCase(),
        address_zip: '00000',
      };
    }
  }

  if (parts.length === 2) {
    const line1 = parts[0];
    const m = parts[1].match(/^(.+?)\s+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
    if (m) {
      return {
        name: 'Homeowner',
        address_line1: line1,
        address_city: m[1].trim(),
        address_state: m[2].toUpperCase(),
        address_zip: m[3],
      };
    }
  }

  return {
    name: 'Homeowner',
    address_line1: raw,
    address_city: 'Unknown',
    address_state: 'TX',
    address_zip: '00000',
  };
}

/** Lob postcard `to` object from parsed address fields. */
export function parsedToLobTo(parsed) {
  return {
    name: parsed?.name || 'Homeowner',
    address_line1: parsed?.address_line1 || '',
    address_city: parsed?.address_city || '',
    address_state: parsed?.address_state || '',
    address_zip: String(parsed?.address_zip || '').slice(0, 10),
  };
}

/** Local format check when Lob verification is unavailable (demo / no API key). */
export function validateParsedAddress(parsed) {
  const line1 = String(parsed?.address_line1 || '').trim();
  const city = String(parsed?.address_city || '').trim();
  const state = String(parsed?.address_state || '').trim().toUpperCase();
  const zip = String(parsed?.address_zip || '').trim();
  const zipOk = /^\d{5}(-\d{4})?$/.test(zip) && zip !== '00000';
  const stateOk = /^[A-Z]{2}$/.test(state);
  const cityOk = city && city !== 'Unknown';
  const lineOk = line1 && line1 !== 'Unknown';

  if (!lineOk || !cityOk || !stateOk || !zipOk) {
    return {
      ok: false,
      deliverability: 'undeliverable',
      message: 'Address could not be parsed. Use format: 123 Main St, City, ST 12345',
      to: parsedToLobTo(parsed),
      warning: false,
      local: true,
    };
  }

  return {
    ok: true,
    deliverability: 'unchecked',
    message: 'Format looks valid. Lob USPS verification runs when live mail is enabled.',
    to: parsedToLobTo(parsed),
    warning: false,
    local: true,
  };
}

/** Try Google Geocoding when map addresses lack a ZIP. */
export async function enrichAddressString(full = '') {
  const raw = String(full || '').trim();
  if (!raw) return raw;
  if (validateParsedAddress(parseMailingAddress(raw)).ok) return raw;
  if (!GOOGLE_MAPS_API_KEY) return raw;

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', raw);
    url.searchParams.set('key', GOOGLE_MAPS_API_KEY);
    const data = await fetch(url).then((r) => r.json());
    const formatted = data.results?.[0]?.formatted_address;
    if (formatted) {
      const cleaned = stripCountrySuffix(formatted);
      if (validateParsedAddress(parseMailingAddress(cleaned)).ok) {
        return cleaned;
      }
    }
  } catch {
    /* ignore */
  }
  return raw;
}

/** Resolve a mailable address from stored text and optional lat/lng. */
export async function resolveMailingAddress({ address = '', lat = null, lng = null } = {}) {
  let candidate = String(address || '').trim();

  if (candidate) {
    candidate = await enrichAddressString(candidate);
    if (validateParsedAddress(parseMailingAddress(candidate)).ok) {
      return { address: candidate, source: 'address' };
    }
  }

  if (lat != null && lng != null) {
    const fromGeo = await reverseGeocode(Number(lat), Number(lng));
    const enriched = await enrichAddressString(fromGeo);
    if (validateParsedAddress(parseMailingAddress(enriched)).ok) {
      return { address: enriched, source: 'geocode' };
    }
    candidate = enriched || candidate;
  }

  return { address: candidate, source: 'unresolved' };
}

export function formatPrice(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 'Call for quote';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function buildQuoteUrl(renderId, baseUrl) {
  const base = (baseUrl || '').replace(/\/$/, '');
  return `${base}/app/quote/${renderId}`;
}

export function mergeTemplateText(text, ctx) {
  const owner = ctx.ownerName || ctx.owner || '';
  const ownerFirst = ctx.ownerFirst || owner || 'neighbor';
  return String(text || '')
    .replace(/\{\{price\}\}/g, ctx.priceFormatted || '')
    .replace(/\{\{feet\}\}/g, ctx.rooflineFeet != null ? String(ctx.rooflineFeet) : '')
    .replace(/\{\{address\}\}/g, ctx.address || '')
    .replace(/\{\{owner\}\}/g, owner || 'Homeowner')
    .replace(/\{\{owner_first\}\}/g, ownerFirst)
    .replace(/\{\{name\}\}/g, owner || 'Homeowner');
}

export function resolveElementContent(el, ctx) {
  switch (el.type) {
    case 'text':
      return mergeTemplateText(el.text || '', ctx);
    case 'price':
      return el.text ? mergeTemplateText(el.text, ctx) : ctx.priceFormatted;
    case 'address':
      return ctx.address || '';
    case 'render':
      return ctx.renderImagePath || null;
    case 'qr':
      return ctx.quoteUrl || '';
    default:
      return el.text || '';
  }
}
