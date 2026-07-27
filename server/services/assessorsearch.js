import { ASSESSORSEARCH_API_KEY } from '../config/env.js';
import { pickString } from './ownerNames.js';

const API_BASE = 'https://api.assessorsearch.com/v1';
const REQUEST_GAP_MS = 120;

export function assessorsearchEnabled() {
  return Boolean(ASSESSORSEARCH_API_KEY);
}

export function assessorsearchStatus() {
  return {
    provider: 'assessorsearch',
    enabled: assessorsearchEnabled(),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Pull owner name from AssessorSearch property record fields. */
export function extractOwnerFromRecord(record = {}) {
  const owner1 = pickString(
    record.owner_1_full_name,
    record.owner1_full_name,
    record.owner_name,
    record.ownerName,
  );
  const owner2 = pickString(record.owner_2_full_name, record.owner2_full_name);
  const name = owner2 ? `${owner1} & ${owner2}` : owner1;
  return { owner_name: name || null };
}

function isMatchedRecord(data = {}) {
  const status = String(data.match_status || data.status || data.matchStatus || '').toLowerCase();
  if (status && ['no_match', 'not_found', 'unmatched', 'miss'].includes(status)) return false;
  if (status && ['matched', 'match', 'ok', 'success'].includes(status)) return true;
  return Boolean(
    data.property_id
    || data.owner_1_full_name
    || data.owner1_full_name
    || extractOwnerFromRecord(data).owner_name,
  );
}

async function assessorsearchFetch(path, { retries = 2 } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: 'application/json',
      'X-API-Key': ASSESSORSEARCH_API_KEY,
    },
  });
  const data = await res.json().catch(() => ({}));

  if (res.status === 429 && retries > 0) {
    const waitMs = Number(res.headers.get('Retry-After') || 2) * 1000;
    await sleep(waitMs);
    return assessorsearchFetch(path, { retries: retries - 1 });
  }

  if (!res.ok) {
    const err = new Error(data.detail || data.message || data.error || `assessorsearch_${res.status}`);
    err.code = res.status === 401 ? 'assessorsearch_unauthorized' : 'assessorsearch_failed';
    err.status = res.status;
    err.detail = data;
    throw err;
  }

  return data;
}

/** Lookup owner name for one address (1 API credit when matched). */
export async function lookupOwnerByAddress(address) {
  const q = encodeURIComponent(String(address || '').trim());
  if (!q) {
    return { matched: false, owner_name: null, rawError: 'missing_address' };
  }
  const data = await assessorsearchFetch(`/properties?address=${q}`);
  if (!isMatchedRecord(data)) {
    return {
      matched: false,
      owner_name: null,
      rawError: data.match_status || data.status || 'no_match',
      property_id: data.property_id || null,
    };
  }
  const owner = extractOwnerFromRecord(data);
  return {
    matched: Boolean(owner.owner_name),
    owner_name: owner.owner_name,
    property_id: data.property_id || null,
    apn: data.apn || null,
    property_address: data.property_address || null,
    rawError: owner.owner_name ? null : 'owner_name_missing',
  };
}

/**
 * Lookup owner names for campaign homes via AssessorSearch.
 * @param {Array<{ id?: string, address?: string }>} homes
 */
export async function lookupOwnersByAddress(homes = []) {
  if (!assessorsearchEnabled()) {
    const err = new Error('assessorsearch_not_configured');
    err.code = 'assessorsearch_not_configured';
    throw err;
  }

  const results = [];
  for (let i = 0; i < homes.length; i += 1) {
    const home = homes[i];
    const address = String(home?.address || '').trim();
    try {
      const row = await lookupOwnerByAddress(address);
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
