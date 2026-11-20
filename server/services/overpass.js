const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
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

function isRetryableOverpassError(err) {
  const msg = String(err?.message || err);
  if (err?.name === 'AbortError') return true;
  if ([429, 502, 503, 504].includes(Number(err?.status))) return true;
  if (
    msg === 'overpass_busy'
    || msg === 'overpass_invalid_json'
    || msg === 'overpass_empty_response'
  ) return true;
  if (/overpass_http_(429|502|503|504)/.test(msg)) return true;
  if (/too many|rate limit|timed out|timeout|busy/i.test(msg)) return true;
  // One dead mirror (DNS, reset, blocked) should not fail the lookup.
  if (err?.name === 'TypeError' || /fetch failed|ECONN|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|socket/i.test(msg)) {
    return true;
  }
  return false;
}

/**
 * POST an Overpass QL query. Tries public mirrors when one is busy, rate-limits
 * this server's IP, times out, or returns non-JSON (XML/HTML gateway pages).
 * `totalBudgetMs` caps the whole mirror chain so a hung host cannot stall the request.
 */
export async function overpassQuery(query, { timeoutMs = 90000, totalBudgetMs = 0 } = {}) {
  let lastErr = null;
  const started = Date.now();
  for (const url of OVERPASS_URLS) {
    const budgetLeft = totalBudgetMs ? totalBudgetMs - (Date.now() - started) : timeoutMs;
    if (budgetLeft < 1500) break;
    const waitMs = Math.min(timeoutMs, budgetLeft);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), waitMs);
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
        throw Object.assign(
          new Error(data?.remark || data?.error || `overpass_http_${resp.status}`),
          { status: resp.status },
        );
      }
      return data;
    } catch (err) {
      lastErr = err;
      if (isRetryableOverpassError(err)) continue;
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw Object.assign(
    new Error(
      lastErr?.message === 'overpass_busy'
        || lastErr?.name === 'AbortError'
        || isRetryableOverpassError(lastErr)
        ? 'Map building lookup is busy right now. Wait a few seconds and draw the area again.'
        : String(lastErr?.message || 'overpass_failed'),
    ),
    { code: 'overpass_unavailable' },
  );
}

export { OVERPASS_URLS, USER_AGENT };
