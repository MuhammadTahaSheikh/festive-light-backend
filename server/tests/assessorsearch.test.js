import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { addressAgrees, buildPropertySearchPath, extractOwnerFromRecord, parseLookupResponse } from '../services/assessorsearch.js';
import { ownerFirstName } from '../services/ownerNames.js';
import { mergeTemplateText } from '../services/postcardMerge.js';

describe('assessorsearch owner parse', () => {
  test('buildPropertySearchPath keeps city, state, and ZIP on the address', () => {
    const path = buildPropertySearchPath('217 Bloomfield St, Johnstown, PA 15904, USA');
    const params = new URLSearchParams(path.split('?')[1]);
    assert.equal(params.get('address'), '217 Bloomfield St, Johnstown, PA 15904');
    assert.equal(params.get('city'), null);
    assert.equal(params.get('state'), null);
  });

  test('addressAgrees rejects a different house number or ZIP', () => {
    assert.equal(addressAgrees('217 Bloomfield St, Johnstown, PA 15904', '217 Bloomfield St, Johnstown, PA 15904'), true);
    assert.equal(addressAgrees('217 Bloomfield St, Johnstown, PA 15904', '219 Bloomfield St, Johnstown, PA 15904'), false);
    assert.equal(addressAgrees('217 Bloomfield St, Johnstown, PA 15904', '217 Bloomfield St, Other City, OH 43000'), false);
  });

  test('extractOwnerFromRecord reads owner_1_full_name', () => {
    const out = extractOwnerFromRecord({
      owner_1_full_name: 'Jane Q Public',
      property_id: 'ABC123',
    });
    assert.equal(out.owner_name, 'Jane Q Public');
  });

  test('parseLookupResponse reads the nested property owner', () => {
    const out = parseLookupResponse({
      status: 'matched',
      match: { property_id: '12276B6', apn: '451-492-10-00' },
      property: { property_id: '12276B6', owner_1_full_name: 'Morgan Family Trust', apn: '451-492-10-00' },
    });
    assert.equal(out.matched, true);
    assert.equal(out.owner_name, 'Morgan Family Trust');
    assert.equal(out.property_id, '12276B6');
  });

  test('parseLookupResponse rejects a matched record at a different ZIP', () => {
    const out = parseLookupResponse({
      status: 'matched',
      property: {
        property_id: 'OTHER',
        property_address: '217 Bloomfield St, Springfield, OH 45503',
        owner_1_full_name: 'HENDERSON MARY',
      },
    }, '217 Bloomfield St, Johnstown, PA 15904');
    assert.equal(out.matched, false);
    assert.equal(out.owner_name, null);
    assert.equal(out.rawError, 'address_mismatch');
  });

  test('parseLookupResponse ignores possible matches', () => {
    const out = parseLookupResponse({
      status: 'possible',
      match: { property_id: '6DEE911' },
      property: null,
    });
    assert.equal(out.matched, false);
    assert.equal(out.owner_name, null);
    assert.equal(out.rawError, 'possible');
  });

  test('extractOwnerFromRecord joins co-owners', () => {
    const out = extractOwnerFromRecord({
      owner_1_full_name: 'Jane Public',
      owner_2_full_name: 'John Public',
    });
    assert.equal(out.owner_name, 'Jane Public & John Public');
  });

  test('ownerFirstName', () => {
    assert.equal(ownerFirstName('Jane Q Public'), 'Jane');
    assert.equal(ownerFirstName('DOROTHY SMITH'), 'Dorothy');
    assert.equal(ownerFirstName(''), '');
  });

  test('mergeTemplateText owner tags', () => {
    assert.equal(
      mergeTemplateText('Hey {{owner_first}}, from {{owner}}', {
        ownerName: 'Jane Public',
        ownerFirst: 'Jane',
      }),
      'Hello Jane, from Jane Public',
    );
  });
});
