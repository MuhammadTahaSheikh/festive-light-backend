import { ATTOM_API_KEY } from '../config/env.js';
import { parseMailingAddress } from './postcardMerge.js';
import { pickString } from './ownerNames.js';

const API_BASE = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';
const REQUEST_GAP_MS = 150;

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

function addressQueryFromHome(home) {
  const full = String(home?.address || '').trim();
  const parsed = parseMailingAddress(full);
  const line1 = parsed.address_line1;
  const line2 = [
    parsed.address_city !== 'Unknown' ? parsed.address_city : '',
    parsed.address_state,
    parsed.address_zip !== '00000' ? parsed.address_zip : '',
  ].filter(Boolean).join(', ');

  if (line1 && line2) {
    return { address1: line1, address2: line2, address: `${line1}, ${line2}` };
  }
  return { address: full };
}

async function attomFetch(path, { retries = 2 } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: 'application/json',
      apikey: ATTOM_API_KEY,
    },
  });
  const data = await res.json().catch(() => ({}));

  if (res.status === 429 && retries > 0) {
    await sleep(2000);
    return attomFetch(path, { retries: retries - 1 });
  }

  if (!res.ok) {
    const err = new Error(data.status?.msg || data.message || `attom_${res.status}`);
    err.code = res.status === 401 || res.status === 403 ? 'attom_unauthorized' : 'attom_failed';
    err.status = res.status;
    err.detail = data;
    throw err;
  }

  return data;
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
  const statusCode = data.status?.code;
  if (statusCode === 400 || data.status?.msg === 'SuccessWithoutResult') {
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
    attomId: property.identifier?.attomId || property.identifier?.attomId || null,
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
    const address = String(home?.address || '').trim();
    try {
      const row = await lookupOwnerByAddress(home);
      results.push({
        homeId: home.id || null,
        address,
        matched: row.matched,
        owner_name: row.owner_name,
        owner_phone: null,
        owner_email: null,
        rawError: row.rawError,
      });
    } catch (e) {
      results.push({
        homeId: home.id || null,
        address,
        matched: false,
        owner_name: null,
        owner_phone: null,
        owner_email: null,
        rawError: e.message,
      });
    }
    if (i < homes.length - 1) await sleep(REQUEST_GAP_MS);
  }
  return results;
}
