import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractOwnerFromRecord } from '../services/assessorsearch.js';
import { ownerFirstName } from '../services/ownerNames.js';
import { mergeTemplateText } from '../services/postcardMerge.js';

describe('assessorsearch owner parse', () => {
  test('extractOwnerFromRecord reads owner_1_full_name', () => {
    const out = extractOwnerFromRecord({
      owner_1_full_name: 'Jane Q Public',
      property_id: 'ABC123',
    });
    assert.equal(out.owner_name, 'Jane Q Public');
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
    assert.equal(ownerFirstName(''), 'neighbor');
  });

  test('mergeTemplateText owner tags', () => {
    assert.equal(
      mergeTemplateText('Hey {{owner_first}}, from {{owner}}', {
        ownerName: 'Jane Public',
        ownerFirst: 'Jane',
      }),
      'Hey Jane, from Jane Public',
    );
  });
});
