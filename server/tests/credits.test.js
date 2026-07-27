import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const accountKey = `test-${crypto.randomUUID()}@example.com`;

let credits;

before(async () => {
  credits = await import('../db/credits.js');
});

describe('credits db (json mode)', () => {
  test('creates account with starting balance', async () => {
    const acct = await credits.getCreditBalance(accountKey, 5);
    assert.equal(acct.balance, 5);
  });

  test('addCredits increases balance', async () => {
    const before = await credits.getCreditBalance(accountKey);
    const res = await credits.addCredits(accountKey, 500, 'purchase', { demo: true });
    assert.equal(res.balance, before.balance + 500);
  });

  test('deductCredits decreases balance', async () => {
    const before = await credits.getCreditBalance(accountKey);
    const res = await credits.deductCredits(accountKey, 1, 'render', { address: '123 Main St' });
    assert.equal(res.balance, before.balance - 1);
  });

  test('deductCredits throws when insufficient', async () => {
    const acct = await credits.getCreditBalance(accountKey);
    await assert.rejects(
      () => credits.deductCredits(accountKey, acct.balance + 9999, 'render'),
      (err) => err.code === 'insufficient_credits',
    );
  });

  test('listCreditTransactions returns recent activity', async () => {
    const txs = await credits.listCreditTransactions(accountKey);
    assert.ok(Array.isArray(txs));
    assert.ok(txs.length >= 2);
    assert.ok(txs.some((t) => t.reason === 'purchase'));
    assert.ok(txs.some((t) => t.reason === 'render'));
  });
});
