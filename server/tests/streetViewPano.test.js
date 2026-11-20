import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { selectStreetViewPanos } from '../services/maps.js';

describe('street view camera choice', () => {
  test('keeps a farther camera that can see the front when the closest cameras are one spot', () => {
    const kept = selectStreetViewPanos([
      { panoId: 'hedge', lat: 31.138308, lng: -83.796817, distanceM: 35 },
      { panoId: 'hedge-2', lat: 31.138320, lng: -83.796830, distanceM: 36 },
      { panoId: 'front', lat: 31.13855, lng: -83.79725, distanceM: 50 },
    ]);
    assert.equal(kept[0].panoId, 'hedge');
    assert.ok(kept.some((p) => p.panoId === 'front'));
    assert.equal(kept.some((p) => p.panoId === 'hedge-2'), false);
  });
});
