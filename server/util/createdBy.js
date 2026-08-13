/** Resolve installer identity from the same X-Account-Email header used for credits. */
export function accountKeyFromReq(req) {
  return req?.headers?.['x-account-email'] || req?.body?.accountEmail || 'default';
}

/**
 * Email (or account key) to store as created_by.
 * Returns null for anonymous / default so public widget leads stay unattributed.
 */
export function createdByFromReq(req) {
  const key = String(accountKeyFromReq(req) || '').trim().toLowerCase();
  if (!key || key === 'default') return null;
  return key;
}
