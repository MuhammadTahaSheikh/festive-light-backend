import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { addressQueryFromHome, extractOwnerFromProperty, interpretAttomResponse } from '../services/attom.js';
import { ownerFirstName } from '../services/ownerNames.js';
import { addressLookupVariants } from '../db/campaigns.js';

describe('attom owner parse', () => {
  test('extractOwnerFromProperty joins owner1 first/last', () => {
    const out = extractOwnerFromProperty({
      owner: {
        owner1: { firstnameandmi: 'Jane Q', lastname: 'Public' },
      },
    });
    assert.equal(out.owner_name, 'Jane Q Public');
  });

  test('extractOwnerFromProperty joins co-owners', () => {
    const out = extractOwnerFromProperty({
      owner: {
        owner1: { firstNameAndMi: 'Jane', lastName: 'Public' },
        owner2: { firstNameAndMi: 'John', lastName: 'Public' },
      },
    });
    assert.equal(out.owner_name, 'Jane Public & John Public');
  });

  test('ownerFirstName from attom name', () => {
    assert.equal(ownerFirstName('Jane Q Public'), 'Jane');
  });

  test('addressQueryFromHome uses ATTOM city/state zip format', () => {
    const q = addressQueryFromHome({
      address: '217 Bloomfield St, Johnstown, PA 15904, USA',
    });
    assert.equal(q.address1, '217 Bloomfield St');
    assert.equal(q.address2, 'Johnstown, PA 15904');
  });

  test('interpretAttomResponse treats wrapped 401 as unauthorized', () => {
    const out = interpretAttomResponse(401, {
      Response: { status: { version: '1.0.0', code: '401', msg: 'Unauthorized' } },
    });
    assert.equal(out.kind, 'unauthorized');
  });

  test('interpretAttomResponse treats SuccessWithoutResult as no_match', () => {
    const out = interpretAttomResponse(400, {
      status: { code: 1, msg: 'SuccessWithoutResult', total: 0 },
      property: [],
    });
    assert.equal(out.kind, 'no_match');
  });

  test('addressLookupVariants covers USA suffix', () => {
    const variants = addressLookupVariants('217 Bloomfield St, Johnstown, PA 15904, USA');
    assert.ok(variants.includes('217 Bloomfield St, Johnstown, PA 15904'));
    assert.ok(variants.includes('217 Bloomfield St, Johnstown, PA 15904, USA'));
  });
});
