import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseMailingAddress, formatPrice, mergeTemplateText } from '../services/postcardMerge.js';
import { STARTER_TEMPLATES, POSTCARD_PDF_W_IN, POSTCARD_PDF_H_IN, postcardDims, normalizePostcardFormat, templateForMail } from '../services/postcardStarters.js';
import { layoutAnchoredElements } from '../services/anchorLayout.js';
import { personalizeFrontImage, elementPdfBox, renderPostcardPdfs } from '../services/postcardPdf.js';

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
      'Hello Alex — 123 Main St',
    );
    assert.equal(
      mergeTemplateText('Hello {{owner_first}},\nWe designed a custom lighting look', {}),
      'Hello,\nWe designed a custom lighting look',
    );
    assert.equal(
      mergeTemplateText('Hey {{owner_first}} — your quote is ready', { ownerFirst: 'neighbor' }),
      'Hello — your quote is ready',
    );
    assert.equal(
      mergeTemplateText('{{hi_name}}\nChange the Look.', { ownerFirst: 'Dorothy' }),
      'Hi Dorothy,\nChange the Look.',
    );
  });

  test('starter templates have render slot on front', () => {
    assert.equal(STARTER_TEMPLATES.length, 7);
    assert.deepEqual(STARTER_TEMPLATES.map((t) => t.name), [
      'lighting1',
      'lighting2',
      'lighting3',
      'Light Up Every Season',
      'Illuminate Every Moment',
      'Your Home, Your Lights',
      'Permanent Lights',
    ]);
    for (const t of STARTER_TEMPLATES) {
      assert.ok(t.front?.elements?.some((e) => e.type === 'render'), t.name);
    }
    for (const t of STARTER_TEMPLATES.filter((t) => t.id.startsWith('starter-lighting'))) {
      assert.equal(t.format, '6x9');
    }
    for (const t of STARTER_TEMPLATES.filter((t) => t.id.startsWith('starter-nw'))) {
      assert.equal(t.format, '4x6');
      assert.ok(t.back?.elements?.some((e) => e.type === 'render'), t.name);
      const greet = t.front.elements.find((e) => e.id === 'greet');
      const parent = t.front.elements.find((e) => e.id === greet.follow);
      assert.ok(greet.follow && parent, t.name);
      for (const scale of [0.45, 1, 1.6]) {
        const sized = {
          ...parent,
          w: parent.w * scale,
          h: parent.h * scale,
        };
        const laid = layoutAnchoredElements(
          t.front.elements.map((e) => (e.id === parent.id ? sized : e)),
        ).find((e) => e.id === 'greet');
        const boxW = sized.fit === 'fill' ? sized.w : Math.min(sized.w, sized.h * sized.aspect);
        const boxH = sized.fit === 'fill' ? sized.h : Math.min(sized.h, sized.w / sized.aspect);
        assert.ok(laid.w <= boxW + 0.01, `${t.name} text wider than art at ${scale}`);
        assert.ok(laid.h <= boxH + 0.01, `${t.name} text taller than art at ${scale}`);
        assert.ok(laid.x >= sized.x - 0.01, `${t.name} text left of art at ${scale}`);
        assert.ok(laid.y >= sized.y - 0.01, `${t.name} text above art at ${scale}`);
      }
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

  test('Lob 4x6 and 6x11 PDF pages include 0.125in bleed', () => {
    const four = postcardDims('4x6');
    assert.equal(four.w, 6);
    assert.equal(four.h, 4);
    assert.equal(four.pdfW, 6.25);
    assert.equal(four.pdfH, 4.25);
    assert.equal(four.lobSize, '4x6');
    const eleven = postcardDims('6x11');
    assert.equal(eleven.w, 11);
    assert.equal(eleven.h, 6);
    assert.equal(eleven.pdfW, 11.25);
    assert.equal(eleven.pdfH, 6.25);
    assert.equal(eleven.lobSize, '6x11');
    assert.equal(normalizePostcardFormat('nope'), '6x9');
    const fourBleed = elementPdfBox({ type: 'render', x: 0, y: 0, w: 6, h: 4 }, four);
    assert.equal(fourBleed.w, 6.25 * 72);
    assert.equal(fourBleed.h, 4.25 * 72);
  });

  test('templateForMail scales a 6x9 layout onto 4x6', () => {
    const fitted = templateForMail(
      {
        format: '6x9',
        front: { elements: [{ id: 'r1', type: 'render', x: 0, y: 0, w: 9, h: 6 }] },
        back: { elements: [] },
      },
      '4x6',
    );
    assert.equal(fitted.format, '4x6');
    assert.equal(fitted.front.elements[0].w, 6);
    assert.equal(fitted.front.elements[0].h, 4);
  });

  test('templateForMail fills 6x11 width without changing 6x9 height', () => {
    const fitted = templateForMail(
      {
        format: '6x9',
        front: {
          elements: [
            { id: 'r1', type: 'render', x: 0, y: 0, w: 9, h: 6 },
            { id: 'cap', type: 'text', x: 0.35, y: 4.95, w: 8.3, h: 0.95 },
            { id: 'mascot', type: 'image', x: 6.72, y: 3.55, w: 2.22, h: 2.42, fit: 'contain' },
            { id: 'qr', type: 'qr', x: 0.5, y: 1.12, w: 2.2, h: 2.2 },
          ],
        },
        back: {
          elements: [
            { id: 'wave', type: 'image', x: 0, y: 0, w: 9, h: 6, fit: 'cover' },
            { id: 'logo', type: 'logo', x: 5.48, y: 0.16, w: 3.05, h: 1.22, fit: 'contain' },
          ],
        },
      },
      '6x11',
    );
    assert.equal(fitted.format, '6x11');
    const r1 = fitted.front.elements.find((e) => e.id === 'r1');
    assert.equal(r1.w, 11);
    assert.equal(r1.h, 6);
    assert.equal(r1.x, 0);
    assert.equal(fitted.front.elements.find((e) => e.id === 'cap').w, 10.3);
    assert.equal(fitted.front.elements.find((e) => e.id === 'mascot').x, 8.72);
    assert.equal(fitted.front.elements.find((e) => e.id === 'qr').x, 0.5);
    assert.equal(fitted.back.elements.find((e) => e.id === 'wave').w, 11);
    assert.equal(fitted.back.elements.find((e) => e.id === 'wave').fit, 'fill');
    assert.equal(fitted.back.elements.find((e) => e.id === 'logo').x, 7.48);
  });

  test('rendered PDF MediaBox matches selected size', async () => {
    const blank = { front: { background: '#000', elements: [] }, back: { background: '#000', elements: [] } };
    const four = await renderPostcardPdfs({ ...blank, format: '4x6' }, {});
    const nine = await renderPostcardPdfs({ ...blank, format: '6x9' }, {});
    const asText = (buf) => buf.toString('latin1');
    assert.match(asText(four.combined), /\/MediaBox \[0 0 450 306\]/);
    assert.match(asText(nine.combined), /\/MediaBox \[0 0 666 450\]/);
  });
});
