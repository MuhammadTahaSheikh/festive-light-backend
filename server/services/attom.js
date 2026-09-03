import { ATTOM_API_KEY } from '../config/env.js';
import { parseMailingAddress } from './postcardMerge.js';
import { pickString } from './ownerNames.js';

const API_BASE = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';
const REQUEST_GAP_MS = 400;

export function attomEnabled() {
  return Boolean(ATTOM_API_KEY);
}

export function attomStatus() {
  return {
    provider: 'attom',
    enabled: attomEnabled(),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatAttomOwnerPerson(person = {}) {
  if (!person || typeof person !== 'object') return '';
  const first = pickString(
    person.firstNameAndMi,
    person.firstnameandmi,
    person.firstName,
    person.firstname,
  );
  const last = pickString(person.lastName, person.lastname);
  return [first, last].filter(Boolean).join(' ').trim();
}

/** Pull owner name(s) from ATTOM property/detailowner response. */
export function extractOwnerFromProperty(property = {}) {
  const owner = property.owner || property.assessment?.owner || {};
  const names = [];

  for (const key of ['owner1', 'owner2', 'owner3', 'owner4']) {
    const person = owner[key];
    const formatted = formatAttomOwnerPerson(person);
    if (formatted) names.push(formatted);
  }

  const combined = names.length ? names.join(' & ') : '';
  const fallback = pickString(
    owner.ownername,
    owner.ownerName,
    owner.careofname,
    owner.careOfName,
  );

  return { owner_name: combined || fallback || null };
}

/** ATTOM address2 is "City, ST ZIP" (no comma between state and zip). */
export function addressQueryFromHome(home) {
  const full = String(home?.address || '').trim();
  const parsed = parseMailingAddress(full);
  const line1 = parsed.address_line1;
  const city = parsed.address_city !== 'Unknown' ? parsed.address_city : '';
  const state = parsed.address_state || '';
  const zip = parsed.address_zip !== '00000' ? String(parsed.address_zip).slice(0, 5) : '';
  const cityStateZip = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  if (line1 && city && cityStateZip) {
    return { address1: line1, address2: cityStateZip, address: `${line1}, ${cityStateZip}` };
  }
  return { address: full };
}

/** Normalize ATTOM JSON (some errors wrap status under `Response`). */
export function interpretAttomResponse(httpStatus, body = {}) {
  const data = body?.Response && typeof body.Response === 'object' ? body.Response : body;
  const status = data.status || {};
  const msg = String(status.msg || status.message || body.message || '');
  const code = String(status.code ?? '');
  const properties = Array.isArray(data.property) ? data.property : [];

  if (
    httpStatus === 401
    || httpStatus === 403
    || /unauthorized|forbidden|invalid.*key|not authorized/i.test(msg)
  ) {
    return { kind: 'unauthorized', data, status, message: msg || 'Unauthorized' };
  }
  if (httpStatus === 429 || /over.*qps|rate limit|too many/i.test(msg)) {
    return { kind: 'rate_limit', data, status, message: msg || 'Rate limited' };
  }
  if (
    httpStatus === 400
    || msg === 'SuccessWithoutResult'
    || code === '400'
    || (httpStatus === 200 && properties.length === 0)
  ) {
    return { kind: 'no_match', data, status, message: msg || 'SuccessWithoutResult' };
  }
  if (httpStatus && httpStatus >= 400) {
    return { kind: 'error', data, status, message: msg || `attom_${httpStatus}` };
  }
  return { kind: 'ok', data, status, message: msg || 'Success' };
}

function attomUnauthorizedError() {
  const err = new Error(
    'ATTOM API key was rejected (401). The 30-day trial may have expired or the key was revoked. Get a new key at https://api.developer.attomdata.com, set ATTOM_API_KEY in .env, and restart the server.',
  );
  err.code = 'attom_unauthorized';
  err.status = 401;
  return err;
}

async function attomFetch(path, { retries = 2 } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: 'application/json',
      apikey: ATTOM_API_KEY,
    },
  });
  const raw = await res.json().catch(() => ({}));
  const interpreted = interpretAttomResponse(res.status, raw);

  if (interpreted.kind === 'rate_limit' && retries > 0) {
    await sleep(2000);
    return attomFetch(path, { retries: retries - 1 });
  }

  if (interpreted.kind === 'unauthorized') {
    const err = attomUnauthorizedError();
    err.detail = interpreted.data;
    throw err;
  }

  if (interpreted.kind === 'no_match') {
    return { ...interpreted.data, _noMatch: true };
  }

  if (interpreted.kind === 'error' || interpreted.kind === 'rate_limit') {
    const err = new Error(interpreted.message || `attom_${res.status}`);
    err.code = 'attom_failed';
    err.status = res.status;
    err.detail = interpreted.data;
    throw err;
  }

  return interpreted.data;
}

function pickBestProperty(data, query) {
  const rows = Array.isArray(data.property) ? data.property : [];
  if (!rows.length) return null;
  if (rows.length === 1) return rows[0];

  const wantZip = query.address2?.match(/\b(\d{5})\b/)?.[1];
  const wantCity = query.address2?.split(',')[0]?.trim()?.toLowerCase();

  let best = rows[0];
  let bestScore = 0;
  for (const row of rows) {
    const addr = row.address || {};
    const line1 = String(addr.line1 || '').toLowerCase();
    const postal = String(addr.postal1 || addr.postal || '').slice(0, 5);
    const city = String(addr.locality || '').toLowerCase();
    let score = 0;
    if (query.address1 && line1.includes(String(query.address1).toLowerCase().split(' ')[0])) score += 2;
    if (wantZip && postal === wantZip) score += 3;
    if (wantCity && city === wantCity) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }
  return best;
}

function lookupRow(home, extra = {}) {
  return {
    homeId: home?.id || null,
    address: String(home?.address || '').trim(),
    matched: false,
    owner_name: null,
    owner_phone: null,
    owner_email: null,
    rawError: null,
    fatal: false,
    ...extra,
  };
}

/** Lookup owner name for one address via ATTOM property/detailowner. */
export async function lookupOwnerByAddress(addressOrHome) {
  const home = typeof addressOrHome === 'string'
    ? { address: addressOrHome }
    : addressOrHome;
  const query = addressQueryFromHome(home);
  if (!query.address && !query.address1) {
    return { matched: false, owner_name: null, rawError: 'missing_address' };
  }

  const params = new URLSearchParams();
  if (query.address1 && query.address2) {
    params.set('address1', query.address1);
    params.set('address2', query.address2);
  } else {
    params.set('address', query.address);
  }

  const data = await attomFetch(`/property/detailowner?${params.toString()}`);
  if (data._noMatch || data.status?.msg === 'SuccessWithoutResult') {
    return { matched: false, owner_name: null, rawError: 'no_match' };
  }

  const property = pickBestProperty(data, query);
  if (!property) {
    return { matched: false, owner_name: null, rawError: 'no_property' };
  }

  const owner = extractOwnerFromProperty(property);
  return {
    matched: Boolean(owner.owner_name),
    owner_name: owner.owner_name,
    attomId: property.identifier?.attomId || null,
    apn: property.identifier?.apn || null,
    rawError: owner.owner_name ? null : 'owner_name_missing',
  };
}

/** Lookup owner names for campaign homes. */
export async function lookupOwnersByAddress(homes = []) {
  if (!attomEnabled()) {
    const err = new Error('attom_not_configured');
    err.code = 'attom_not_configured';
    throw err;
  }

  const results = [];
  for (let i = 0; i < homes.length; i += 1) {
    const home = homes[i];
    try {
      const row = await lookupOwnerByAddress(home);
      results.push(lookupRow(home, {
        matched: row.matched,
        owner_name: row.owner_name,
        rawError: row.rawError,
      }));
    } catch (e) {
      const fatal = e.code === 'attom_unauthorized' || e.status === 401 || e.status === 403;
      results.push(lookupRow(home, {
        rawError: e.message,
        code: e.code || null,
        fatal,
      }));
      if (fatal) {
        console.warn('[attom] provider rejected the API key; remaining lookups skipped');
        for (let j = i + 1; j < homes.length; j += 1) {
          results.push(lookupRow(homes[j], {
            rawError: e.message,
            code: e.code || null,
            fatal: true,
          }));
        }
        break;
      }
    }
    if (i < homes.length - 1 && results.length < homes.length) await sleep(REQUEST_GAP_MS);
  }
  return results;
}
