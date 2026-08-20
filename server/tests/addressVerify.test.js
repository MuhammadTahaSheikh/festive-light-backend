import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMailingAddress,
  validateParsedAddress,
  parsedToLobTo,
} from '../services/postcardMerge.js';
import {
  deliverabilityMessage,
  isMailableDeliverability,
  isLobAccountError,
  DELIVERABLE_OK,
  DELIVERABLE_WARN,
} from '../services/lob.js';

describe('address verification helpers', () => {
  test('validateParsedAddress rejects unparseable addresses', () => {
    const bad = validateParsedAddress(parseMailingAddress('somewhere vague'));
    assert.equal(bad.ok, false);
    assert.equal(bad.deliverability, 'undeliverable');
  });

  test('validateParsedAddress accepts standard US format', () => {
    const good = validateParsedAddress(parseMailingAddress('123 Main St, Austin, TX 78701'));
    assert.equal(good.ok, true);
    assert.equal(good.deliverability, 'unchecked');
  });

  test('parseMailingAddress handles Google geocode format with country suffix', () => {
    const parsed = parseMailingAddress('260 Broadway, New York, NY 10007, USA');
    const result = validateParsedAddress(parsed);
    assert.equal(result.ok, true);
    assert.equal(parsed.address_line1, '260 Broadway');
    assert.equal(parsed.address_city, 'New York');
    assert.equal(parsed.address_state, 'NY');
    assert.equal(parsed.address_zip, '10007');
  });

  test('parsedToLobTo maps Lob fields', () => {
    const parsed = parseMailingAddress('456 Oak Ave, Sarasota, FL 34236');
    const to = parsedToLobTo(parsed);
    assert.equal(to.address_line1, '456 Oak Ave');
    assert.equal(to.address_city, 'Sarasota');
    assert.equal(to.address_state, 'FL');
    assert.equal(to.address_zip, '34236');
    assert.equal(to.name, 'Homeowner');
  });

  test('isMailableDeliverability strict mode', () => {
    for (const d of DELIVERABLE_OK) {
      assert.equal(isMailableDeliverability(d, { allowWarnings: false }), true, d);
    }
    for (const d of DELIVERABLE_WARN) {
      assert.equal(isMailableDeliverability(d, { allowWarnings: false }), false, d);
      assert.equal(isMailableDeliverability(d, { allowWarnings: true }), true, d);
    }
    assert.equal(isMailableDeliverability('undeliverable'), false);
  });

  test('deliverabilityMessage covers key cases', () => {
    assert.match(deliverabilityMessage('deliverable'), /USPS deliverable/i);
    assert.match(deliverabilityMessage('deliverable_missing_unit'), /Missing apartment/i);
    assert.match(deliverabilityMessage('undeliverable'), /does not deliver/i);
  });

  test('isLobAccountError detects billing setup errors', () => {
    assert.equal(
      isLobAccountError('In order to create a live mail piece, your account needs to set up a billing address'),
      true,
    );
    assert.equal(isLobAccountError('USPS does not deliver to this address'), false);
  });
});
