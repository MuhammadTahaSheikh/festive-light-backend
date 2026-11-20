import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.GOOGLE_MAPS_API_KEY = 'test-key';

const { discoverInPolygon } = await import('../services/discovery.js');
const { overpassQuery } = await import('../services/overpass.js');

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

function rect(lat, lng, dLat = 0.00004, dLng = 0.00004) {
  return [
    { lat, lng },
    { lat: lat + dLat, lng },
    { lat: lat + dLat, lng: lng + dLng },
    { lat, lng: lng + dLng },
  ];
}

function googleHit(url) {
  const parsed = new URL(String(url));
  const [lat, lng] = parsed.searchParams.get('latlng').split(',').map(Number);
  return new Response(JSON.stringify({
    results: [{
      formatted_address: '137 Old Tram Rd SW, Moultrie, GA 31768, USA',
      address_components: [{ long_name: '137', types: ['street_number'] }],
      geometry: { location: { lat, lng } },
    }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

describe('map building lookup fallback', () => {
  test('a busy Overpass mirror chain still returns the house from Google', async () => {
    const calls = [];
    global.fetch = async (url) => {
      const href = String(url);
      calls.push(href);
      if (href.includes('interpreter')) {
        return new Response('<?xml version="1.0"?><remark>Too many requests</remark>', { status: 429 });
      }
      if (href.includes('geocode')) return googleHit(url);
      throw new Error(`unexpected ${href}`);
    };

    const result = await discoverInPolygon(rect(31.19, -83.78), 10);
    assert.equal(result.source, 'google');
    assert.equal(result.returned, 1);
    assert.match(result.houses[0].address, /137 Old Tram Rd SW/);
    assert.ok(calls.some((href) => href.includes('interpreter')));
    assert.ok(calls.some((href) => href.includes('geocode')));
  });

  test('Overpass success is used and Google is not called', async () => {
    global.fetch = async (url, init) => {
      const href = String(url);
      if (href.includes('geocode') || href.includes('nominatim')) {
        throw new Error('google should not run when buildings come back');
      }
      if (!href.includes('interpreter')) throw new Error(`unexpected ${href}`);
      const body = String(init?.body || '');
      assert.match(body, /way\["building"\]/);
      return new Response(JSON.stringify({
        elements: [{
          type: 'way',
          id: 1,
          center: { lat: 31.2005, lon: -83.6995 },
          tags: {
            building: 'yes',
            'addr:housenumber': '137',
            'addr:street': 'Old Tram Road Southwest',
            'addr:city': 'Moultrie',
            'addr:state': 'GA',
            'addr:postcode': '31768',
          },
        }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const result = await discoverInPolygon(rect(31.2, -83.7, 0.001, 0.001), 10);
    assert.equal(result.source, 'osm');
    assert.equal(result.returned, 1);
    assert.match(result.houses[0].address, /137 Old Tram Road Southwest/);
  });

  test('a dead first mirror is skipped when the next one answers', async () => {
    let interpreters = 0;
    global.fetch = async (url) => {
      const href = String(url);
      if (!href.includes('interpreter')) throw new Error(`unexpected ${href}`);
      interpreters += 1;
      if (interpreters === 1) throw new TypeError('fetch failed');
      return new Response(JSON.stringify({ elements: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const data = await overpassQuery('[out:json];way(1);out;', { timeoutMs: 1000, totalBudgetMs: 4000 });
    assert.deepEqual(data.elements, []);
    assert.equal(interpreters, 2);
  });
});
