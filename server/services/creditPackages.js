/** Light Launch–style credit packs and pricing. 1 credit ≈ 1 AI render quote. */

export const PACKAGE_CARDS = [
  { credits: 500, label: null },
  { credits: 1000, label: null },
  { credits: 2500, label: 'MOST POPULAR', featured: true },
  { credits: 5000, label: null },
  { credits: 10000, label: null },
  { credits: 25000, label: 'BEST VALUE', featured: true },
];

export const SLIDER_MIN = 500;
export const SLIDER_MAX = 25000;
export const SLIDER_STEP = 500;
export const LOW_BALANCE_THRESHOLD = 10;

export function pricePerCredit(credits) {
  const n = Number(credits) || 0;
  if (n >= 10000) return 0.9;
  if (n >= 5000) return 0.92;
  if (n >= 2500) return 0.95;
  return 1.0;
}

export function quotePurchase(credits, promoPercent = 0) {
  const n = Math.max(SLIDER_MIN, Math.min(SLIDER_MAX, Math.round(Number(credits) || SLIDER_MIN)));
  const per = pricePerCredit(n);
  const list = n * 1.0;
  const subtotal = Math.round(n * per * 100) / 100;
  const promo = Math.min(100, Math.max(0, Number(promoPercent) || 0));
  const discount = Math.round(subtotal * (promo / 100) * 100) / 100;
  const total = Math.round((subtotal - discount) * 100) / 100;
  const savings = Math.round((list - subtotal + discount) * 100) / 100;
  return {
    credits: n,
    pricePerCredit: per,
    listPrice: list,
    subtotal,
    promoPercent: promo,
    discount,
    total,
    savings: Math.max(0, savings),
  };
}

export function validatePromoCode(code) {
  const key = String(code || '').trim().toUpperCase();
  const promos = {
    WELCOME10: 10,
    SAVE10: 10,
  };
  if (!key || !(key in promos)) return null;
  return { code: key, percentOff: promos[key] };
}
