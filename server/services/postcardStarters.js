/** Built-in 6×9 postcard layouts (Light Launch–style starters). Coordinates in inches on a 9×6 canvas. */

export const POSTCARD_W_IN = 9;
export const POSTCARD_H_IN = 6;
/** Lob 6×9 files must include 1/8" bleed on each side (9.25 × 6.25). */
export const POSTCARD_BLEED_IN = 0.125;
export const POSTCARD_PDF_W_IN = POSTCARD_W_IN + POSTCARD_BLEED_IN * 2;
export const POSTCARD_PDF_H_IN = POSTCARD_H_IN + POSTCARD_BLEED_IN * 2;

export const STARTER_TEMPLATES = [
  {
    id: 'starter-plain-render',
    name: 'Plain Render',
    category: 'Eye-Catching',
    is_starter: true,
    format: '6x9',
    front: {
      background: '#0b0b0d',
      elements: [
        { id: 'r1', type: 'render', x: 0.25, y: 0.25, w: 8.5, h: 5.5 },
      ],
    },
    back: {
      background: '#141416',
      elements: [
        { id: 'b1', type: 'text', x: 0.5, y: 0.4, w: 8, h: 0.6, text: 'Festive Lighting Pros', fontSize: 22, color: '#f49321', align: 'center', bold: true },
        { id: 'b2', type: 'text', x: 0.5, y: 1.05, w: 8, h: 1.55, text: 'Hey {{owner_first}} —\nWe designed a custom lighting look\nspecifically for your home.\nYour personalized quote is ready,\nwith pricing and next steps inside.', fontSize: 13, color: '#f3f1ec', align: 'center' },
        { id: 'b3', type: 'text', x: 0.5, y: 2.75, w: 4, h: 0.5, text: 'Estimated front quote:', fontSize: 11, color: '#9a948a', align: 'left' },
        { id: 'b4', type: 'price', x: 0.5, y: 3.25, w: 4, h: 0.8, fontSize: 28, color: '#f49321', align: 'left', bold: true },
        { id: 'b5', type: 'qr', x: 6.2, y: 2.4, w: 2.2, h: 2.2 },
        { id: 'b6', type: 'text', x: 6.0, y: 4.75, w: 2.6, h: 0.4, text: 'Scan for your quote', fontSize: 9, color: '#9a948a', align: 'center' },
        { id: 'b7', type: 'address', x: 0.5, y: 4.9, w: 5, h: 0.8, fontSize: 10, color: '#c9c4bb', align: 'left' },
      ],
    },
  },
  {
    id: 'starter-your-house',
    name: 'This is YOUR house',
    category: 'Eye-Catching',
    is_starter: true,
    format: '6x9',
    front: {
      background: '#0b0b0d',
      elements: [
        { id: 'r1', type: 'render', x: 0, y: 0.9, w: 9, h: 5.1 },
        { id: 't1', type: 'text', x: 0.4, y: 0.25, w: 8.2, h: 0.7, text: 'Hey {{owner_first}}, this is YOUR house.', fontSize: 24, color: '#ffffff', align: 'center', bold: true },
        { id: 't2', type: 'text', x: 0.4, y: 5.35, w: 8.2, h: 0.45, text: 'A real render of your home — not a stock photo.', fontSize: 10, color: '#9a948a', align: 'center' },
      ],
    },
    back: {
      background: '#141416',
      elements: [
        { id: 'b1', type: 'text', x: 0.5, y: 0.4, w: 8, h: 0.6, text: 'Festive Lighting Pros', fontSize: 20, color: '#f49321', align: 'center', bold: true },
        { id: 'b2', type: 'price', x: 0.5, y: 1.3, w: 8, h: 1, text: 'From {{price}}', fontSize: 32, color: '#ffffff', align: 'center', bold: true },
        { id: 'b3', type: 'text', x: 0.5, y: 2.5, w: 8, h: 0.8, text: 'Scan to view your full quote and book a free consultation.', fontSize: 12, color: '#c9c4bb', align: 'center' },
        { id: 'b4', type: 'qr', x: 3.4, y: 3.4, w: 2.2, h: 2.2 },
        { id: 'b5', type: 'address', x: 0.5, y: 5.1, w: 8, h: 0.7, fontSize: 10, color: '#9a948a', align: 'center' },
      ],
    },
  },
  {
    id: 'starter-patriotic',
    name: 'Patriotic',
    category: 'Patriotic',
    is_starter: true,
    format: '6x9',
    front: {
      background: '#0a1628',
      elements: [
        { id: 'r1', type: 'render', x: 0.3, y: 0.5, w: 8.4, h: 4.8 },
        { id: 't1', type: 'text', x: 0.3, y: 0.15, w: 4, h: 0.5, text: '🇺🇸', fontSize: 20, color: '#ffffff', align: 'left' },
        { id: 't2', type: 'text', x: 5, y: 0.15, w: 3.7, h: 0.5, text: '🇺🇸', fontSize: 20, color: '#ffffff', align: 'right' },
        { id: 't3', type: 'text', x: 0.3, y: 5.4, w: 8.4, h: 0.45, text: 'Permanent red, white & blue lighting', fontSize: 11, color: '#4c8dff', align: 'center', bold: true },
      ],
    },
    back: {
      background: '#0a1628',
      elements: [
        { id: 'b1', type: 'text', x: 0.5, y: 0.5, w: 8, h: 0.7, text: 'Your home, lit for every season', fontSize: 18, color: '#ffffff', align: 'center', bold: true },
        { id: 'b2', type: 'price', x: 0.5, y: 1.5, w: 8, h: 0.9, fontSize: 30, color: '#f49321', align: 'center', bold: true },
        { id: 'b3', type: 'qr', x: 3.4, y: 2.8, w: 2.2, h: 2.2 },
        { id: 'b4', type: 'text', x: 0.5, y: 5.2, w: 8, h: 0.5, text: 'festivelightingpros.com', fontSize: 10, color: '#4c8dff', align: 'center' },
        { id: 'b5', type: 'address', x: 0.5, y: 4.2, w: 8, h: 0.6, fontSize: 9, color: '#9a948a', align: 'center' },
      ],
    },
  },
];

export function getStarterById(id) {
  return STARTER_TEMPLATES.find((t) => t.id === id) || null;
}
