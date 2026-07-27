import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import crypto from 'node:crypto';

const accountKey = `routes-${crypto.randomUUID()}@example.com`;
let server;
let baseUrl;
let creditsRoutes;

before(async () => {
  creditsRoutes = (await import('../routes/credits.js')).default;
  const app = express();
  app.use(express.json());
  app.use('/api/credits', creditsRoutes);
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}/api/credits`;
});

after(() => {
  server?.close();
});

function hdrs() {
  return { 'Content-Type': 'application/json', 'X-Account-Email': accountKey };
}

describe('credits routes', () => {
  test('GET /packages', async () => {
    const res = await fetch(`${baseUrl}/packages`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.ok);
    assert.equal(data.cards.length, 6);
    assert.equal(data.slider.min, 500);
  });

  test('POST /quote with promo', async () => {
    const res = await fetch(`${baseUrl}/quote`, {
      method: 'POST',
      headers: hdrs(),
      body: JSON.stringify({ credits: 2500, promoCode: 'SAVE10' }),
    });
    const data = await res.json();
    assert.ok(data.ok);
    assert.equal(data.quote.promoPercent, 10);
  });

  test('GET /balance creates starter account', async () => {
    const res = await fetch(`${baseUrl}/balance`, { headers: hdrs() });
    const data = await res.json();
    assert.ok(data.ok);
    assert.equal(data.balance, 5);
    assert.equal(data.creditsPerRender, 1);
  });

  test('POST /purchase adds credits in demo mode', async () => {
    const res = await fetch(`${baseUrl}/purchase`, {
      method: 'POST',
      headers: hdrs(),
      body: JSON.stringify({ credits: 500, demoConfirm: true }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.ok);
    assert.equal(data.purchased, 500);
    assert.equal(data.balance, 505);
    assert.equal(data.demo, true);
  });

  test('GET /transactions after purchase', async () => {
    const res = await fetch(`${baseUrl}/transactions`, { headers: hdrs() });
    const data = await res.json();
    assert.ok(data.ok);
    assert.ok(data.transactions.some((t) => t.reason === 'purchase'));
  });
});
