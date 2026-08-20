import {
  LOB_API_KEY,
  LOB_MAIL_MODE,
  LOB_MAIL_ALLOW_WARNINGS,
  PUBLIC_BASE_URL,
  MAIL_FROM,
} from '../config/env.js';
import {
  parseMailingAddress,
  validateParsedAddress,
  parsedToLobTo,
  enrichAddressString,
  resolveMailingAddress,
} from './postcardMerge.js';

const LOB_API = 'https://api.lob.com/v1';

export const DELIVERABLE_OK = new Set(['deliverable', 'deliverable_unnecessary_unit']);
export const DELIVERABLE_WARN = new Set(['deliverable_missing_unit', 'deliverable_incorrect_unit']);

export const MAIL_COST_ESTIMATE = { min: 0.7, max: 1.5, default: 1.0 };

export function lobEnabled() {
  return Boolean(LOB_API_KEY);
}

export function shouldVerifyWithLob() {
  return lobEnabled() && LOB_MAIL_MODE === 'live';
}

export function deliverabilityMessage(deliverability) {
  switch (deliverability) {
    case 'deliverable':
      return 'USPS deliverable';
    case 'deliverable_unnecessary_unit':
      return 'Deliverable (unit number not needed)';
    case 'deliverable_missing_unit':
      return 'Missing apartment or suite number — mail may not reach the resident';
    case 'deliverable_incorrect_unit':
      return 'Suite or unit number may be wrong — mail may not reach the resident';
    case 'undeliverable':
      return 'USPS does not deliver to this address';
    case 'unchecked':
      return 'Format valid — enable live Lob mail for USPS verification';
    case 'verification_failed':
      return 'Address verification service unavailable';
    default:
      return deliverability ? `Not mailable (${deliverability})` : 'Address could not be verified';
  }
}

export function isMailableDeliverability(deliverability, { allowWarnings = LOB_MAIL_ALLOW_WARNINGS } = {}) {
  if (DELIVERABLE_OK.has(deliverability)) return true;
  if (allowWarnings && DELIVERABLE_WARN.has(deliverability)) return true;
  return false;
}

/** Lob account/setup errors — not a problem with the recipient street address. */
export function isLobAccountError(message = '') {
  return /billing address|payment method|live mail piece|payment on file|account needs/i.test(String(message || ''));
}

export function isLobVerifyServiceFailure(verification) {
  return verification?.source === 'lob_error'
    || verification?.deliverability === 'verification_failed';
}

function lobToFromVerification(data, parsed) {
  const to = parsedToLobTo(parsed);
  to.name = parsed.name || 'Homeowner';
  if (data.primary_line) to.address_line1 = data.primary_line;
  if (data.secondary_line) to.address_line2 = data.secondary_line;
  if (data.components?.city) to.address_city = data.components.city;
  if (data.components?.state) to.address_state = data.components.state;
  if (data.components?.zip_code) to.address_zip = data.components.zip_code;
  if (!to.address_line2) delete to.address_line2;
  return to;
}

export async function verifyUsAddressWithLob(parsed) {
  const body = {
    primary_line: parsed.address_line1,
    city: parsed.address_city,
    state: parsed.address_state,
    zip_code: String(parsed.address_zip || '').slice(0, 5),
  };
  const data = await lobFetch('/us_verifications', body);
  const deliverability = data.deliverability || 'undeliverable';
  return {
    deliverability,
    validAddress: Boolean(data.valid_address),
    warning: DELIVERABLE_WARN.has(deliverability),
    to: lobToFromVerification(data, parsed),
    standardized: {
      primary_line: data.primary_line,
      last_line: data.last_line,
      components: data.components,
    },
    raw: data,
  };
}

/** Parse + verify (Lob USPS in live mode, local format check otherwise). */
export async function verifyAddressForMail(addressString, options = {}) {
  const { lat = null, lng = null } = options;
  const resolved = await resolveMailingAddress({ address: addressString, lat, lng });
  let address = resolved.address;
  let parsed = parseMailingAddress(address);
  let local = validateParsedAddress(parsed);

  if (!local.ok) {
    return { ...local, source: 'local', parsed, address, resolveSource: resolved.source };
  }

  if (!shouldVerifyWithLob()) {
    return { ...local, source: 'local', parsed };
  }

  try {
    const lob = await verifyUsAddressWithLob(parsed);
    const allowWarnings = options.allowWarnings ?? LOB_MAIL_ALLOW_WARNINGS;
    const ok = isMailableDeliverability(lob.deliverability, { allowWarnings });
    return {
      ok,
      deliverability: lob.deliverability,
      message: deliverabilityMessage(lob.deliverability),
      to: lob.to,
      warning: lob.warning,
      validAddress: lob.validAddress,
      standardized: lob.standardized,
      local: false,
      source: 'lob',
      parsed,
    };
  } catch (e) {
    return {
      ok: false,
      deliverability: 'verification_failed',
      message: e.message || deliverabilityMessage('verification_failed'),
      to: parsedToLobTo(parsed),
      warning: false,
      local: false,
      source: 'lob_error',
      parsed,
    };
  }
}

export function mailFromAddress() {
  return {
    name: MAIL_FROM.name,
    address_line1: MAIL_FROM.line1,
    address_city: MAIL_FROM.city,
    address_state: MAIL_FROM.state,
    address_zip: MAIL_FROM.zip,
  };
}

async function lobFetch(path, body) {
  const auth = Buffer.from(`${LOB_API_KEY}:`).toString('base64');
  const res = await fetch(`${LOB_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error?.message || data.message || 'lob_failed');
    err.code = 'lob_failed';
    err.detail = data;
    throw err;
  }
  return data;
}

export async function sendPostcardViaLob({ to, frontUrl, backUrl, description }) {
  if (!LOB_API_KEY) {
    throw new Error('lob_not_configured');
  }
  if (!PUBLIC_BASE_URL || PUBLIC_BASE_URL.includes('localhost')) {
    throw new Error('public_base_url_required');
  }
  const base = PUBLIC_BASE_URL.replace(/\/$/, '');
  const front = frontUrl.startsWith('http') ? frontUrl : `${base}${frontUrl}`;
  const back = backUrl.startsWith('http') ? backUrl : `${base}${backUrl}`;

  return lobFetch('/postcards', {
    description: description || 'Festive Lighting Pros outreach',
    to,
    from: mailFromAddress(),
    front,
    back,
    size: '6x9',
    mail_type: 'usps_first_class',
  });
}

export async function sendPostcardDemo({ homeId }) {
  return {
    id: `demo_${homeId}_${Date.now()}`,
    object: 'postcard',
    url: null,
    expected_delivery_date: null,
    demo: true,
  };
}

export function estimateMailCost(count) {
  const n = Number(count) || 0;
  return {
    count: n,
    min: Math.round(n * MAIL_COST_ESTIMATE.min * 100) / 100,
    max: Math.round(n * MAIL_COST_ESTIMATE.max * 100) / 100,
    estimate: Math.round(n * MAIL_COST_ESTIMATE.default * 100) / 100,
    perPiece: MAIL_COST_ESTIMATE,
    mode: LOB_MAIL_MODE,
    lobEnabled: lobEnabled(),
  };
}

/** What the UI needs to know before offering live Lob mail. */
export function mailConfigStatus() {
  const hasKey = lobEnabled();
  const isLive = LOB_MAIL_MODE === 'live';
  const publicBaseUrl = PUBLIC_BASE_URL || '';
  const hasPublicUrl = Boolean(publicBaseUrl) && !publicBaseUrl.includes('localhost');
  const hints = [];
  if (!hasKey) hints.push('Add LOB_API_KEY to .env');
  if (!isLive) hints.push('Set LOB_MAIL_MODE=live for physical mail (test_ keys simulate only)');
  if (!hasPublicUrl) hints.push('Set PUBLIC_BASE_URL to a public HTTPS URL (e.g. ngrok) so Lob can fetch postcard PDFs');
  return {
    lobEnabled: hasKey,
    mode: LOB_MAIL_MODE,
    publicBaseUrl: publicBaseUrl || null,
    readyForLive: hasKey && isLive && hasPublicUrl,
    lobVerify: shouldVerifyWithLob(),
    from: mailFromAddress(),
    hints,
  };
}
