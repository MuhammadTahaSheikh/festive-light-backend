import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streetKey, blockWaveStats } from '../services/blockWave.js';

test('streetKey groups numbered addresses on same street', () => {
  assert.equal(streetKey('260 Broadway, New York, NY'), 'broadway');
  assert.equal(streetKey('255 Broadway, New York, NY'), 'broadway');
});

test('blockWaveStats finds partial block momentum', () => {
  const { wave } = blockWaveStats([
    { address: '260 Broadway, NY', render_id: 'a', status: 'rendered' },
    { address: '255 Broadway, NY', render_id: 'b', status: 'rendered' },
    { address: '240 Broadway, NY', render_id: null, status: 'prospect' },
    { address: '1 Murray St, NY', render_id: null, status: 'prospect' },
  ]);
  assert.equal(wave.street, 'broadway');
  assert.equal(wave.rendered, 2);
  assert.equal(wave.total, 3);
});
