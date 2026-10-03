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

function houseNumber(address) {
  const match = String(address || '').trim().match(/^(\d+[A-Za-z]?)/);
  return match ? match[1].toLowerCase() : '';
}

function zipCode(address) {
  const match = String(address || '').match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : '';
}

/** Reject a high-confidence hit that is a different house or ZIP. */
export function addressAgrees(requested, returned) {
  const wantNum = houseNumber(requested);
  const gotNum = houseNumber(returned);
  if (wantNum && gotNum && wantNum !== gotNum) return false;
  const wantZip = zipCode(requested);
  const gotZip = zipCode(returned);
  if (wantZip && gotZip && wantZip !== gotZip) return false;
  return true;
}

/** Owner fields live on `property` inside the lookup envelope. */
export function parseLookupResponse(data = {}, requestedAddress = '') {
  const status = String(data.status || data.match_status || data.matchStatus || '').toLowerCase();
  const record = data.property && typeof data.property === 'object' ? data.property : data;
  const owner = extractOwnerFromRecord(record);
  const propertyId = record.property_id || data.match?.property_id || null;
  const propertyAddress = record.property_address || data.match?.address || null;

  if (status && status !== 'matched') {
    return {
      matched: false,
      owner_name: null,
      property_id: propertyId,
      apn: record.apn || data.match?.apn || null,
      property_address: propertyAddress,
      rawError: status,
    };
  }

  if (propertyAddress && requestedAddress && !addressAgrees(requestedAddress, propertyAddress)) {
    return {
      matched: false,
      owner_name: null,
      property_id: propertyId,
      apn: record.apn || null,
      property_address: propertyAddress,
      rawError: 'address_mismatch',
    };
  }

  return {
    matched: Boolean(owner.owner_name),
    owner_name: owner.owner_name,
    property_id: propertyId,
    apn: record.apn || null,
    property_address: propertyAddress,
    rawError: owner.owner_name ? null : (status || 'no_match'),
  };
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

/**
 * The lookup endpoint takes one free-form address. City and state are not
 * separate query fields, so the street, city, state, and ZIP must stay together.
 * @see https://assessorsearch.com/property-data-api/docs
 */
export function buildPropertySearchPath(address) {
  const raw = String(address || '')
    .trim()
    .replace(/,?\s*(USA|United States|U\.S\.A\.?)\s*$/i, '')
    .trim();
  if (!raw) return null;
  const params = new URLSearchParams();
  params.set('address', raw);
  return `/properties?${params.toString()}`;
}

/** Lookup owner name for one address (1 API credit when matched). */
export async function lookupOwnerByAddress(address) {
  const path = buildPropertySearchPath(address);
  if (!path) {
    return { matched: false, owner_name: null, rawError: 'missing_address' };
  }
  const data = await assessorsearchFetch(path);
  return parseLookupResponse(data, address);
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
