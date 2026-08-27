import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBookConsultationPayload,
  buildConsultationHtmlEmail,
  sendBookConsultationWebhook,
} from '../services/leadconnector.js';

test('buildBookConsultationPayload matches the GHL field set', () => {
  const payload = buildBookConsultationPayload({
    name: 'Muhammad Taha',
    email: 'tahasheikh682@gmail.com',
    phone: '',
    address: '217 Bloomfield St, Johnstown, PA 15904, USA',
    footage: 180,
    estimate: 1800,
    extraFootage: 5,
    extraPrice: 50,
    pricePerFoot: 10,
    imageUrl: 'http://example.com/renders/home.jpg',
    image: 'data:image/jpeg;base64,abc',
  });

  assert.equal(payload.event, 'book_consultation');
  assert.equal(payload.name, 'Muhammad Taha');
  assert.equal(payload.email, 'tahasheikh682@gmail.com');
  assert.equal(payload.phone, '');
  assert.equal(payload.address, '217 Bloomfield St, Johnstown, PA 15904, USA');
  assert.equal(payload.footage, 180);
  assert.equal(payload.estimate, 1800);
  assert.equal(payload.extraFootage, 5);
  assert.equal(payload.extraPrice, 50);
  assert.equal(payload.pricePerFoot, 10);
  assert.equal(payload.imageUrl, 'http://example.com/renders/home.jpg');
  assert.equal(payload.image, 'data:image/jpeg;base64,abc');
  assert.match(payload.htmlEmail, /^<!DOCTYPE html>/);
  assert.match(payload.htmlEmail, /217 Bloomfield St/);
  assert.match(payload.htmlEmail, /180 ft/);
});

test('buildConsultationHtmlEmail includes the render image URL', () => {
  const html = buildConsultationHtmlEmail({
    name: 'Taha',
    address: '1 Main St',
    imageUrl: '/renders/abc.jpg',
    footage: 110,
    estimate: 2200,
    pricePerFoot: 20,
  });
  assert.match(html, /Hi Taha/);
  assert.match(html, /\/renders\/abc\.jpg/);
  assert.match(html, /110 ft/);
});

test('sendBookConsultationWebhook POSTs JSON to the configured hook', async () => {
  const originalFetch = globalThis.fetch;
  let posted = null;
  globalThis.fetch = async (url, opts) => {
    posted = { url: String(url), ...opts };
    return { ok: true, status: 200, text: async () => '{}' };
  };
  try {
    const result = await sendBookConsultationWebhook({
      name: 'Taha',
      email: 'taha@example.com',
      phone: '9415550100',
      address: '1 Main St',
      footage: 180,
      estimate: 1800,
      extraFootage: 5,
      extraPrice: 50,
      pricePerFoot: 10,
      imageUrl: 'http://example.com/renders/home.jpg',
      image: 'data:image/jpeg;base64,abc',
    });
    assert.equal(result.ok, true);
    assert.equal(posted.url, 'https://example.test/ghl-webhook');
    assert.equal(posted.method, 'POST');
    const body = JSON.parse(posted.body);
    assert.equal(body.event, 'book_consultation');
    assert.equal(body.email, 'taha@example.com');
    assert.equal(body.footage, 180);
    assert.equal(body.image, 'data:image/jpeg;base64,abc');
    assert.ok(body.htmlEmail.includes('<!DOCTYPE html>'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
