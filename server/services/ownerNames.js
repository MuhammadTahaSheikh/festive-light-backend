/** First name for postcard greetings. Empty when no owner is on file — never “neighbor”. */
export function ownerFirstName(fullName = '', fallback = '') {
  const cleaned = String(fullName || '')
    .replace(/\s+/g, ' ')
    .replace(/,?\s*(jr\.?|sr\.?|ii|iii|iv)\s*$/i, '')
    .trim();
  if (!cleaned) return fallback;
  if (/\b(llc|inc|corp|trust|estate|lp|ltd)\b/i.test(cleaned)) return cleaned;
  const first = cleaned.split(/\s+/)[0];
  return titleCaseShouty(first) || fallback;
}

/** Assessor files often store DOROTHY. Show Dorothy. Leave mixed-case and initials alone. */
function titleCaseShouty(token) {
  if (!token) return token;
  const letters = token.replace(/[^A-Za-z]/g, '');
  if (!letters || letters.length <= 2 || letters !== letters.toUpperCase()) return token;
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

export function pickString(...vals) {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (v != null && typeof v !== 'object' && String(v).trim()) return String(v).trim();
  }
  return '';
}
