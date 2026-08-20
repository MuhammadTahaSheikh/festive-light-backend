import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseMailingAddress, formatPrice, mergeTemplateText } from '../services/postcardMerge.js';
import { STARTER_TEMPLATES, POSTCARD_PDF_W_IN, POSTCARD_PDF_H_IN } from '../services/postcardStarters.js';
import { personalizeFrontImage, elementPdfBox } from '../services/postcardPdf.js';

describe('postcardMerge', () => {
  test('parseMailingAddress parses US format', () => {
    const a = parseMailingAddress('123 Main St, Austin, TX 78701');
    assert.equal(a.address_line1, '123 Main St');
    assert.equal(a.address_city, 'Austin');
    assert.equal(a.address_state, 'TX');
    assert.equal(a.address_zip, '78701');
  });

  test('formatPrice', () => {
    assert.equal(formatPrice(4600), '$4,600');
    assert.equal(formatPrice(0), 'Call for quote');
  });

  test('mergeTemplateText', () => {
    assert.equal(mergeTemplateText('From {{price}}', { priceFormatted: '$4,500' }), 'From $4,500');
    assert.equal(mergeTemplateText('{{feet}} ft · {{price}}', { rooflineFeet: 95, priceFormatted: '$3,800' }), '95 ft · $3,800');
    assert.equal(
      mergeTemplateText('Hey {{owner_first}} — {{address}}', {
        ownerFirst: 'Alex',
        address: '123 Main St',
      }),
      'Hey Alex — 123 Main St',
    );
  });

  test('starter templates have render slot on front', () => {
    for (const t of STARTER_TEMPLATES) {
      assert.ok(t.front?.elements?.some((e) => e.type === 'render'), t.name);
      assert.equal(t.format, '6x9');
    }
  });

  test('largest custom front image becomes the house render slot', () => {
    const template = {
      front: {
        elements: [
          { id: 'logo', type: 'logo', x: 0, y: 0, w: 2, h: 1, src: 'data:image/png;base64,AA==' },
          { id: 'house', type: 'image', x: 0.5, y: 1, w: 8, h: 4.5, src: 'data:image/jpeg;base64,AA==' },
        ],
      },
      back: { elements: [] },
    };
    const personalized = personalizeFrontImage(template);
    const house = personalized.front.elements.find((el) => el.id === 'house');
    assert.equal(house.type, 'render');
    assert.equal(house.src, undefined);
    assert.equal(personalized.front.elements.find((el) => el.id === 'logo').type, 'logo');
  });

  test('Lob 6x9 PDF page includes 0.125in bleed', () => {
    assert.equal(POSTCARD_PDF_W_IN, 9.25);
    assert.equal(POSTCARD_PDF_H_IN, 6.25);
    const inset = elementPdfBox({ type: 'text', x: 0.5, y: 0.4, w: 8, h: 0.6 });
    assert.equal(inset.x, 0.625 * 72);
    assert.equal(inset.y, 0.525 * 72);
    const fullBleed = elementPdfBox({ type: 'render', x: 0, y: 0, w: 9, h: 6 });
    assert.equal(fullBleed.x, 0);
    assert.equal(fullBleed.y, 0);
    assert.equal(fullBleed.w, 9.25 * 72);
    assert.equal(fullBleed.h, 6.25 * 72);
  });
});
