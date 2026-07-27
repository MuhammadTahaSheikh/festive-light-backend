import { OWNER_LOOKUP_PROVIDER } from '../config/env.js';
import { attomEnabled, attomStatus, lookupOwnersByAddress as lookupViaAttom } from './attom.js';
import { assessorsearchEnabled, assessorsearchStatus, lookupOwnersByAddress as lookupViaAssessorsearch } from './assessorsearch.js';
import { batchdataEnabled, batchdataStatus, lookupOwnersByAddress as lookupViaBatchdata } from './batchdata.js';

export { ownerFirstName } from './ownerNames.js';

export function ownerLookupStatus() {
  const provider = resolveProvider();
  if (provider === 'attom') return attomStatus();
  if (provider === 'assessorsearch') return assessorsearchStatus();
  if (provider === 'batchdata') return { ...batchdataStatus(), provider: 'batchdata' };
  return {
    provider: 'none',
    enabled: false,
    attom: attomEnabled(),
    assessorsearch: assessorsearchEnabled(),
    batchdata: batchdataEnabled(),
  };
}

export function ownerLookupEnabled() {
  return Boolean(resolveProvider());
}

function resolveProvider() {
  const pref = (OWNER_LOOKUP_PROVIDER || 'attom').toLowerCase();
  if (pref === 'attom' && attomEnabled()) return 'attom';
  if (pref === 'assessorsearch' && assessorsearchEnabled()) return 'assessorsearch';
  if (pref === 'batchdata' && batchdataEnabled()) return 'batchdata';
  if (pref === 'auto') {
    if (attomEnabled()) return 'attom';
    if (assessorsearchEnabled()) return 'assessorsearch';
    if (batchdataEnabled()) return 'batchdata';
  }
  if (attomEnabled()) return 'attom';
  if (assessorsearchEnabled()) return 'assessorsearch';
  if (batchdataEnabled()) return 'batchdata';
  return null;
}

export async function lookupOwnersByAddress(homes = [], options = {}) {
  const provider = resolveProvider();
  if (!provider) {
    const err = new Error('owner_lookup_not_configured');
    err.code = 'owner_lookup_not_configured';
    throw err;
  }
  if (provider === 'batchdata') {
    return lookupViaBatchdata(homes, options);
  }
  if (provider === 'assessorsearch') {
    return lookupViaAssessorsearch(homes);
  }
  return lookupViaAttom(homes);
}
