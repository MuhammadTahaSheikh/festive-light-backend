import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  pricePerCredit,
  quotePurchase,
  validatePromoCode,
  PACKAGE_CARDS,
  SLIDER_MIN,
  SLIDER_MAX,
} from '../services/creditPackages.js';

describe('creditPackages', () => {
  test('pricePerCredit tiers', () => {
    assert.equal(pricePerCredit(500), 1.0);
    assert.equal(pricePerCredit(2500), 0.95);
    assert.equal(pricePerCredit(5000), 0.92);
    assert.equal(pricePerCredit(10000), 0.9);
  });

  test('quotePurchase clamps to slider range', () => {
    const low = quotePurchase(100);
    assert.equal(low.credits, SLIDER_MIN);
    const high = quotePurchase(99999);
    assert.equal(high.credits, SLIDER_MAX);
  });

  test('quotePurchase 2500 credits', () => {
    const q = quotePurchase(2500);
    assert.equal(q.credits, 2500);
    assert.equal(q.pricePerCredit, 0.95);
    assert.equal(q.subtotal, 2375);
    assert.equal(q.total, 2375);
    assert.equal(q.savings, 125);
  });

  test('quotePurchase with promo', () => {
    const q = quotePurchase(5000, 10);
    assert.equal(q.promoPercent, 10);
    assert.ok(q.discount > 0);
    assert.ok(q.total < q.subtotal);
  });

  test('validatePromoCode', () => {
    assert.deepEqual(validatePromoCode('welcome10'), { code: 'WELCOME10', percentOff: 10 });
    assert.equal(validatePromoCode('nope'), null);
  });

  test('package cards match slider bounds', () => {
    for (const card of PACKAGE_CARDS) {
      assert.ok(card.credits >= SLIDER_MIN && card.credits <= SLIDER_MAX);
    }
  });
});
