import { BATCHDATA_API_KEY, BATCHDATA_SKIP_TRACE } from '../config/env.js';
import { parseMailingAddress } from './postcardMerge.js';
import { ownerFirstName, pickString } from './ownerNames.js';

export { ownerFirstName };

const BATCHDATA_API = 'https://api.batchdata.com/api/v1';
const LOOKUP_PATH = '/property/lookup/all-attributes';
const BATCH_SIZE = 25;

export function batchdataEnabled() {
  return Boolean(BATCHDATA_API_KEY);
}

export function batchdataStatus() {
  return {
    enabled: batchdataEnabled(),
    skipTrace: BATCHDATA_SKIP_TRACE,
  };
}

function formatPersonName(person) {
  if (!person || typeof person !== 'object') return '';
  const full = pickString(
    person.fullName,
    person.full_name,
    person.full,
    person.name,
    person.ownerName,
    person.owner_name,
  );
  if (full) return full;
  const first = pickString(person.firstName, person.first_name, person.first, person.givenName);
  const last = pickString(person.lastName, person.last_name, person.last, person.surname, person.familyName);
  return [first, last].filter(Boolean).join(' ').trim();
}

/** Normalize BatchData list payloads (`results.properties`, `results`, etc.). */
export function normalizePropertyRows(data = {}) {
  if (Array.isArray(data.results?.properties)) return data.results.properties;
  if (Array.isArray(data.properties)) return data.properties;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function normalizeStreet(s = '') {
  return String(s || '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\broad\b/g, 'rd')
    .replace(/\bdrive\b/g, 'dr')
    .replace(/\s+/g, ' ')
    .trim();
}

function propertyAddressParts(property = {}) {
  const a = property.address || property.propertyAddress || {};
  return {
    street: a.street || a.formattedStreet || a.streetNoUnit || '',
    city: a.city || '',
    state: a.state || '',
    zip: String(a.zip || a.zipCode || '').slice(0, 5),
  };
}

function scorePropertyMatch(parts, property) {
  const pa = propertyAddressParts(property);
  let score = 0;
  if (parts.zip && pa.zip && parts.zip === pa.zip) score += 3;
  if (parts.state && pa.state && parts.state.toUpperCase() === String(pa.state).toUpperCase()) score += 1;
  if (parts.city && pa.city && parts.city.toLowerCase() === String(pa.city).toLowerCase()) score += 1;
  const want = normalizeStreet(parts.street);
  const got = normalizeStreet(pa.street);
  if (want && got && (want === got || got.includes(want) || want.includes(got))) score += 4;
  return score;
}

/** Prefer address-matched property; fall back to same index when sandbox/prod align 1:1. */
export function pickPropertyForRequest(parts, rows, idx) {
  let best = null;
  let bestScore = 0;
  for (const row of rows) {
    const property = row?.property || row?.result || row;
    if (!property) continue;
    const score = scorePropertyMatch(parts, property);
    if (score > bestScore) {
      bestScore = score;
      best = property;
    }
  }
  if (bestScore >= 3) return best;
  const fallback = rows[idx];
  return fallback?.property || fallback?.result || fallback || null;
}

/** Pull owner name / phone / email from varied BatchData response shapes. */
export function extractOwnerFromProperty(record = {}) {
  const ownerObj = record.owner || record.owners?.[0] || record.property?.owner || record.propertyOwner || {};
  const named = Array.isArray(ownerObj.names) ? ownerObj.names : [];
  const name = pickString(
    formatPersonName(ownerObj),
    formatPersonName(named[0]),
    formatPersonName(record.owners?.[0]),
    record.ownerName,
    record.owner_name,
    record.ownerNames?.[0],
    Array.isArray(record.ownerNames) ? record.ownerNames.filter(Boolean).join(' & ') : '',
  );

  const phones = [
    ...(Array.isArray(ownerObj.phoneNumbers) ? ownerObj.phoneNumbers : []),
    ...(Array.isArray(record.phoneNumbers) ? record.phoneNumbers : []),
    ...(Array.isArray(record.phones) ? record.phones : []),
  ];
  const emails = [
    ...(Array.isArray(ownerObj.emails) ? ownerObj.emails : []),
    ...(Array.isArray(ownerObj.enrichedEmails) ? ownerObj.enrichedEmails : []),
    ...(Array.isArray(record.emails) ? record.emails : []),
  ];

  const phone = pickString(
    ownerObj.phoneNumber,
    ownerObj.phone,
    ownerObj.mobilePhone,
    phones[0]?.number,
    phones[0]?.phoneNumber,
    phones[0],
    record.phone,
  );
  const email = pickString(
    ownerObj.email,
    emails[0]?.email,
    emails[0]?.address,
    typeof emails[0] === 'string' ? emails[0] : '',
    record.email,
  );

  return {
    owner_name: name || null,
    owner_phone: phone || null,
    owner_email: email || null,
  };
}

function addressPartsFromHome(home) {
  const parsed = parseMailingAddress(home?.address || '');
  return {
    street: parsed.address_line1,
    city: parsed.address_city !== 'Unknown' ? parsed.address_city : '',
    state: parsed.address_state,
    zip: parsed.address_zip !== '00000' ? String(parsed.address_zip).slice(0, 5) : '',
  };
}

async function batchdataFetch(path, body) {
  const res = await fetch(`${BATCHDATA_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${BATCHDATA_API_KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error?.message || `batchdata_${res.status}`);
    err.code = 'batchdata_failed';
    err.status = res.status;
    err.detail = data;
    throw err;
  }
  return data;
}

/**
 * Lookup owner data for one or more homes via BatchData property records.
 * @param {Array<{ id?: string, address?: string }>} homes
 * @param {{ skipTrace?: boolean }} [options]
 */
export async function lookupOwnersByAddress(homes = [], options = {}) {
  if (!batchdataEnabled()) {
    const err = new Error('batchdata_not_configured');
    err.code = 'batchdata_not_configured';
    throw err;
  }

  const skipTrace = options.skipTrace ?? BATCHDATA_SKIP_TRACE;
  const results = [];

  for (let i = 0; i < homes.length; i += BATCH_SIZE) {
    const chunk = homes.slice(i, i + BATCH_SIZE);
    const requests = chunk.map((home) => {
      const parts = addressPartsFromHome(home);
      return {
        address: {
          street: parts.street,
          city: parts.city,
          state: parts.state,
          zip: parts.zip,
        },
      };
    });

    const data = await batchdataFetch(LOOKUP_PATH, {
      requests,
      options: { skipTrace: Boolean(skipTrace) },
    });

    const rows = normalizePropertyRows(data);

    chunk.forEach((home, idx) => {
      const parts = addressPartsFromHome(home);
      const property = pickPropertyForRequest(parts, rows, idx);
      const owner = property
        ? extractOwnerFromProperty(property)
        : { owner_name: null, owner_phone: null, owner_email: null };
      results.push({
        homeId: home.id || null,
        address: home.address || '',
        matched: Boolean(owner.owner_name),
        ...owner,
        rawError: property?.error || property?.meta?.errorMessage || null,
      });
    });
  }

  return results;
}

/** Enrich a single address string (helper / tests). */
export async function lookupOwnerByAddressString(address, options = {}) {
  const [one] = await lookupOwnersByAddress([{ address }], options);
  return one;
}
