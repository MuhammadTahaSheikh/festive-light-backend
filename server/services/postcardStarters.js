/** Built-in postcard layouts. Coordinates in inches on the trim canvas. */

import { LIGHTING_STARTERS } from './lightingStarters.js';
import { NW_STARTERS } from './nwStarters.js';

export const POSTCARD_BLEED_IN = 0.125;

/** Lob postcard sizes (landscape trim). PDF adds 1/8" bleed on each side. */
export const POSTCARD_SIZES = {
  '4x6': { id: '4x6', label: '4×6', w: 6, h: 4 },
  '6x9': { id: '6x9', label: '6×9', w: 9, h: 6 },
  '6x11': { id: '6x11', label: '6×11', w: 11, h: 6 },
};

export const DEFAULT_POSTCARD_FORMAT = '6x9';

export function postcardDims(format = DEFAULT_POSTCARD_FORMAT) {
  const spec = POSTCARD_SIZES[format] || POSTCARD_SIZES[DEFAULT_POSTCARD_FORMAT];
  return {
    format: spec.id,
    label: spec.label,
    w: spec.w,
    h: spec.h,
    bleed: POSTCARD_BLEED_IN,
    pdfW: spec.w + POSTCARD_BLEED_IN * 2,
    pdfH: spec.h + POSTCARD_BLEED_IN * 2,
    lobSize: spec.id,
  };
}

export function normalizePostcardFormat(format) {
  return postcardDims(format).format;
}

function scaleSideToFormat(side, from, to) {
  if (!side) return side;
  const sx = to.w / from.w;
  const sy = to.h / from.h;
  const s = Math.min(sx, sy);
  const ox = (to.w - from.w * s) / 2;
  const oy = (to.h - from.h * s) / 2;
  return {
    ...side,
    elements: (side.elements || []).map((el) => ({
      ...el,
      x: ((el.x || 0) * s) + ox,
      y: ((el.y || 0) * s) + oy,
      w: (el.w || 0) * s,
      h: (el.h || 0) * s,
      fontSize: el.fontSize ? el.fontSize * s : el.fontSize,
      strokeWidth: el.strokeWidth ? el.strokeWidth * s : el.strokeWidth,
    })),
  };
}

/** Stretch x with the width and y with the height so trim is filled edge to edge. */
function scaleSideToFill(side, from, to) {
  if (!side) return side;
  const sx = to.w / from.w;
  const sy = to.h / from.h;
  return {
    ...side,
    elements: (side.elements || []).map((el) => ({
      ...el,
      x: (el.x || 0) * sx,
      y: (el.y || 0) * sy,
      w: (el.w || 0) * sx,
      h: (el.h || 0) * sy,
      fontSize: el.fontSize ? el.fontSize * sy : el.fontSize,
      strokeWidth: el.strokeWidth ? el.strokeWidth * sy : el.strokeWidth,
    })),
  };
}

/**
 * 6×9 and 6×11 share a 6" height. Fill the extra 2" of width:
 * full-bleed art/photo stretches across 11", left column stays put,
 * right column shifts right. Does not run for 4×6.
 */
function expandSixByNineToSixByEleven(side) {
  if (!side) return side;
  const fromW = 9;
  const toW = 11;
  const extra = toW - fromW;
  const edge = 0.12;
  return {
    ...side,
    elements: (side.elements || []).map((el) => {
      const x = el.x || 0;
      const w = el.w || 0;
      const spansWidth = x <= edge && x + w >= fromW - edge;
      const wideBand = w >= fromW * 0.82;
      if (spansWidth) {
        const next = { ...el, x: 0, w: toW };
        if (el.type === 'image' && el.fit !== 'contain') next.fit = 'fill';
        return next;
      }
      if (wideBand) {
        return { ...el, w: w + extra };
      }
      if (x + w / 2 >= fromW / 2) {
        return { ...el, x: Math.round((x + extra) * 1000) / 1000 };
      }
      return { ...el };
    }),
  };
}

function sideExtent(side) {
  let maxX = 0;
  let maxY = 0;
  for (const el of side?.elements || []) {
    maxX = Math.max(maxX, (Number(el.x) || 0) + (Number(el.w) || 0));
    maxY = Math.max(maxY, (Number(el.y) || 0) + (Number(el.h) || 0));
  }
  return { maxX, maxY };
}

/** Trim the elements actually fill, when the saved label is a larger card. */
export function inferContentFormat(side, declared = DEFAULT_POSTCARD_FORMAT) {
  const spec = POSTCARD_SIZES[declared] || POSTCARD_SIZES[DEFAULT_POSTCARD_FORMAT];
  const { maxX, maxY } = sideExtent(side);
  if ((side?.elements || []).length && maxX >= spec.w - 0.45 && maxY >= spec.h - 0.45) return spec.id;
  if (maxX <= 6.45 && maxY <= 4.4) return '4x6';
  if (maxX <= 9.45 && maxY <= 6.4) return '6x9';
  return spec.id;
}

function fitSide(side, declared, toFormat) {
  const from = postcardDims(inferContentFormat(side, declared));
  const to = postcardDims(toFormat);
  if (from.format === to.format) return side;
  if (from.format === '6x9' && to.format === '6x11') return expandSixByNineToSixByEleven(side);
  if (from.format === '4x6' && to.format === '6x11') return scaleSideToFill(side, from, to);
  return scaleSideToFormat(side, from, to);
}

function stripSizeMeta(side) {
  if (!side || typeof side !== 'object') return side;
  const { __sizeLayouts, ...rest } = side;
  return rest;
}

const POSTCARD_FORMAT_IDS = ['4x6', '6x9', '6x11'];

/** Per-size layouts saved on the template, including the copy stored on front for older rows. */
export function readStoredLayouts(template) {
  const raw = template?.layouts && Object.keys(template.layouts).length
    ? template.layouts
    : template?.front?.__sizeLayouts;
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const id of POSTCARD_FORMAT_IDS) {
    const item = raw[id];
    if (!item?.front || !item?.back) continue;
    out[id] = { front: stripSizeMeta(item.front), back: stripSizeMeta(item.back) };
  }
  return Object.keys(out).length ? out : null;
}

/** Fit a saved layout onto a Lob size. A saved size is used as-is. */
export function templateForMail(template, format) {
  if (!template) return template;
  const declared = postcardDims(template.format).format;
  const to = postcardDims(format || declared);
  const exact = readStoredLayouts(template)?.[to.format];
  if (exact?.front && exact?.back) {
    return {
      ...template,
      format: to.format,
      front: stripSizeMeta(exact.front),
      back: stripSizeMeta(exact.back),
    };
  }
  return {
    ...template,
    format: to.format,
    front: fitSide(stripSizeMeta(template.front), declared, to.format),
    back: fitSide(stripSizeMeta(template.back), declared, to.format),
  };
}

/** @deprecated Use postcardDims(format). Kept so 6×9 callers and tests stay stable. */
export const POSTCARD_W_IN = POSTCARD_SIZES['6x9'].w;
export const POSTCARD_H_IN = POSTCARD_SIZES['6x9'].h;
export const POSTCARD_PDF_W_IN = postcardDims('6x9').pdfW;
export const POSTCARD_PDF_H_IN = postcardDims('6x9').pdfH;

export const STARTER_TEMPLATES = [
  /* Hidden for now — Plain Render, This is YOUR house, Patriotic
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
        { id: 'b2', type: 'text', x: 0.5, y: 1.05, w: 8, h: 1.55, text: 'Hello {{owner_first}},\nWe designed a custom lighting look\nspecifically for your home.\nYour personalized quote is ready,\nwith pricing and next steps inside.', fontSize: 13, color: '#f3f1ec', align: 'center' },
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
        { id: 't1', type: 'text', x: 0.4, y: 0.25, w: 8.2, h: 0.7, text: 'Hello {{owner_first}}, this is YOUR house.', fontSize: 24, color: '#ffffff', align: 'center', bold: true },
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
  */
  ...LIGHTING_STARTERS,
  ...NW_STARTERS,
];

export function getStarterById(id) {
  return STARTER_TEMPLATES.find((t) => t.id === id) || null;
}
