const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const USER_AGENT = 'FestiveLightingPros/1.0';

function parseOverpassBody(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('overpass_empty_response');
  if (trimmed.startsWith('<')) {
    throw new Error('overpass_busy');
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error('overpass_invalid_json');
  }
}

/**
 * POST an Overpass QL query. Tries public mirrors when one is busy or returns
 * non-JSON (XML/HTML gateway errors like <?xml version=...>).
 */
export async function overpassQuery(query, { timeoutMs = 90000 } = {}) {
  let lastErr = null;
  for (const url of OVERPASS_URLS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', 'User-Agent': USER_AGENT },
        body: query,
        signal: controller.signal,
      });
      const text = await resp.text();
      const data = parseOverpassBody(text);
      if (!resp.ok) {
        throw new Error(data?.remark || data?.error || `overpass_http_${resp.status}`);
      }
      return data;
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      // Retry next mirror for gateway / busy / abort cases.
      if (
        msg === 'overpass_busy'
        || msg === 'overpass_invalid_json'
        || msg === 'overpass_empty_response'
        || err?.name === 'AbortError'
        || /overpass_http_(429|502|503|504)/.test(msg)
      ) {
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw Object.assign(
    new Error(
      lastErr?.message === 'overpass_busy'
        || lastErr?.name === 'AbortError'
        ? 'Map building lookup is busy right now. Wait a few seconds and draw the area again.'
        : String(lastErr?.message || 'overpass_failed'),
    ),
    { code: 'overpass_unavailable' },
  );
}

export { OVERPASS_URLS, USER_AGENT };
