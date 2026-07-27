import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractOwnerFromProperty } from '../services/attom.js';
import { ownerFirstName } from '../services/ownerNames.js';

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
});
