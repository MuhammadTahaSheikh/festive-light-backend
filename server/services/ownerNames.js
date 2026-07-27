/** First name for “Hey {{owner_first}}” — falls back to full name / neighbor. */
export function ownerFirstName(fullName = '', fallback = 'neighbor') {
  const cleaned = String(fullName || '')
    .replace(/\s+/g, ' ')
    .replace(/,?\s*(jr\.?|sr\.?|ii|iii|iv)\s*$/i, '')
    .trim();
  if (!cleaned) return fallback;
  if (/\b(llc|inc|corp|trust|estate|lp|ltd)\b/i.test(cleaned)) return cleaned;
  const first = cleaned.split(/\s+/)[0];
  return first || fallback;
}

export function pickString(...vals) {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (v != null && typeof v !== 'object' && String(v).trim()) return String(v).trim();
  }
  return '';
}
