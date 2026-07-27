import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ownerFirstName } from '../services/ownerNames.js';
import {
  extractOwnerFromProperty,
  normalizePropertyRows,
  pickPropertyForRequest,
} from '../services/batchdata.js';

describe('batchdata owner parse', () => {
  test('normalizePropertyRows reads results.properties', () => {
    const rows = normalizePropertyRows({
      results: { properties: [{ owner: { fullName: 'A' } }] },
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].owner.fullName, 'A');
  });

  test('extractOwnerFromProperty reads nested owner fullName', () => {
    const out = extractOwnerFromProperty({
      owner: { fullName: 'Jane Q Public', phoneNumber: '5125550100', email: 'jane@example.com' },
    });
    assert.equal(out.owner_name, 'Jane Q Public');
    assert.equal(out.owner_phone, '5125550100');
    assert.equal(out.owner_email, 'jane@example.com');
  });

  test('extractOwnerFromProperty joins first/last', () => {
    const out = extractOwnerFromProperty({
      owners: [{ firstName: 'Sam', lastName: 'Lee' }],
    });
    assert.equal(out.owner_name, 'Sam Lee');
  });

  test('pickPropertyForRequest prefers matching zip+street', () => {
    const picked = pickPropertyForRequest(
      { street: '217 Bloomfield St', city: 'Johnstown', state: 'PA', zip: '15904' },
      [
        { address: { street: '100 Other St', city: 'Austin', state: 'TX', zip: '78701' }, owner: { fullName: 'Wrong' } },
        { address: { street: '217 Bloomfield St', city: 'Johnstown', state: 'PA', zip: '15904' }, owner: { fullName: 'Right Person' } },
      ],
      0,
    );
    assert.equal(picked.owner.fullName, 'Right Person');
  });

  test('ownerFirstName', () => {
    assert.equal(ownerFirstName('Jane Q Public'), 'Jane');
    assert.equal(ownerFirstName(''), 'neighbor');
    assert.equal(ownerFirstName('ABC Holdings LLC'), 'ABC Holdings LLC');
  });
});
