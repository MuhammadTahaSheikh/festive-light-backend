import crypto from 'node:crypto';

/**
 * Estimated front roofline linear feet — unique per address/building.
 * Priority: OSM footprint perimeter → building sqft → address hash fallback.
 */
export function estimateRooflineFeet(seedText, building = null) {
  const metrics = building && typeof building === 'object' ? building : { sqft: building };
  const hash = crypto.createHash('sha256').update(String(seedText || '')).digest();
  const jitter = (hash.readUInt16BE(2) % 17) - 8; // -8..+8 ft per address

  const perimeterFt = Number(metrics.perimeterFt);
  const sqft = Number(metrics.sqft);
  const maxEdgeFt = Number(metrics.maxEdgeFt);

  let base = null;
  if (perimeterFt > 80) {
    // Light Launch: front roofline ≈ 38% of building footprint perimeter.
    base = perimeterFt * 0.38;
    // Only boost from facade width when perimeter looks too small (wrong OSM match).
    if (maxEdgeFt > 50 && base < maxEdgeFt) {
      base = Math.max(base, maxEdgeFt * 2);
    }
  } else if (maxEdgeFt > 50) {
    base = maxEdgeFt * 2;
  } else if (sqft > 500) {
    base = Math.sqrt(sqft) * 2.55;
  }

  if (base != null) {
    const feet = base + jitter;
    return Math.max(80, Math.round(feet / 5) * 5);
  }

  const n = hash.readUInt32BE(0);
  const feet = 95 + (n % 96);
  return Math.round(feet / 5) * 5;
}

export function campaignStats(homes) {
  const done = new Set(['rendered', 'quote_sent', 'viewed', 'interested', 'closed']);
  return {
    homes: homes.length,
    rendered: homes.filter((h) => done.has(h.status)).length,
    interested: homes.filter((h) => h.status === 'interested').length,
    closed: homes.filter((h) => h.status === 'closed').length,
    closedValue: homes.filter((h) => h.status === 'closed').reduce((s, h) => s + (Number(h.estimated_total) || 0), 0),
    pipelineValue: homes.reduce((s, h) => s + (Number(h.estimated_total) || 0), 0),
  };
}

export function priceFromFeet(feet, rate) {
  if (!rate || !feet) return null;
  return Math.round((feet * rate) / 10) * 10;
}

export function wholeHouseFeet(frontFeet) {
  return Math.round((frontFeet * 1.85) / 5) * 5;
}

/** Resolve display pricing from a stored render row (handles missing $/ft). */
export function resolveQuotePricing(render = {}) {
  const frontFeet = Number(render.roofline_feet) || 0;
  const wholeFeet = frontFeet ? wholeHouseFeet(frontFeet) : 0;
  const rate = Number(render.price_per_foot) || 0;
  const stored = Number(render.estimated_total) || 0;

  let frontPrice = null;
  let wholePrice = null;

  if (rate > 0 && frontFeet > 0) {
    frontPrice = priceFromFeet(frontFeet, rate);
    wholePrice = priceFromFeet(wholeFeet, rate);
  } else if (stored > 0) {
    frontPrice = stored;
    if (frontFeet > 0 && wholeFeet > 0) {
      wholePrice = Math.round((stored / frontFeet) * wholeFeet / 10) * 10;
    } else {
      wholePrice = Math.round((stored * 1.85) / 10) * 10;
    }
  }

  return {
    frontFeet: frontFeet || null,
    wholeFeet: wholeFeet || null,
    pricePerFoot: rate || null,
    frontPrice,
    wholePrice,
  };
}
