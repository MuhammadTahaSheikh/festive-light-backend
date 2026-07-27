import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveQuotePricing, priceFromFeet } from '../services/pricing.js';

test('resolveQuotePricing uses rate when set', () => {
  const q = resolveQuotePricing({ roofline_feet: 100, price_per_foot: 40, estimated_total: 4000 });
  assert.equal(q.frontPrice, priceFromFeet(100, 40));
  assert.equal(q.wholePrice, priceFromFeet(185, 40));
});

test('resolveQuotePricing falls back to estimated_total', () => {
  const q = resolveQuotePricing({ roofline_feet: 95, price_per_foot: null, estimated_total: 3800 });
  assert.equal(q.frontPrice, 3800);
  assert.ok(q.wholePrice > 3800);
});
