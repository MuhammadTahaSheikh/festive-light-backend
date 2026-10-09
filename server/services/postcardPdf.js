import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import sharp from 'sharp';
import {
  POSTCARD_BLEED_IN,
  postcardDims,
} from './postcardStarters.js';
import { resolveElementContent, formatPrice } from './postcardMerge.js';
import { resolveQuotePricing } from './pricing.js';
import { PUBLIC_DIR, RENDERS_DIR } from '../config/paths.js';
import { PORT, PUBLIC_BASE_URL } from '../config/env.js';
import { fileURLToPath } from 'node:url';
import { ownerFirstName } from './ownerLookup.js';
import { layoutAnchoredElements } from './anchorLayout.js';

const IN = 72; // points per inch
/** Editor canvas is 100px per inch. Template fontSize is those pixels, except speech-bubble copy. */
const CANVAS_PX_PER_IN = 100;

export function templateFontToPt(el) {
  const size = Number(el?.fontSize) || 14;
  // Anchored greeting fontSize is already in points (anchorLayout sizes it for the bubble).
  if (el?.follow) return size;
  return size * (IN / CANVAS_PX_PER_IN);
}
const FONT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fonts');
const CUSTOM_FONTS = {
  Pacifico: path.join(FONT_DIR, 'Pacifico-Regular.ttf'),
  'Poppins-Regular': path.join(FONT_DIR, 'Poppins-Regular.ttf'),
  'Poppins-Medium': path.join(FONT_DIR, 'Poppins-Medium.ttf'),
  'Poppins-SemiBold': path.join(FONT_DIR, 'Poppins-SemiBold.ttf'),
  'Poppins-Bold': path.join(FONT_DIR, 'Poppins-Bold.ttf'),
  'Poppins-ExtraBold': path.join(FONT_DIR, 'Poppins-ExtraBold.ttf'),
  'Poppins-BoldItalic': path.join(FONT_DIR, 'Poppins-BoldItalic.ttf'),
  'Poppins-BlackItalic': path.join(FONT_DIR, 'Poppins-BlackItalic.ttf'),
};

function registerCustomFonts(doc) {
  for (const [name, file] of Object.entries(CUSTOM_FONTS)) {
    if (fs.existsSync(file)) doc.registerFont(name, file);
  }
}

function fontForElement(el) {
  if (el.fontFamily && CUSTOM_FONTS[el.fontFamily]) return el.fontFamily;
  if (el.fontFamily === 'Poppins') return el.bold ? 'Poppins-Bold' : 'Poppins-Regular';
  return el.bold ? 'Helvetica-Bold' : 'Helvetica';
}
const EDGE_EPS = 0.05;

/**
 * Map template inches (trim) onto the Lob bleed page.
 * Edge-to-edge art extends into the 1/8" bleed so trim does not leave a gap.
 */
export function elementPdfBox(el, dims = postcardDims('6x9')) {
  let x = Number(el.x) || 0;
  let y = Number(el.y) || 0;
  let w = Number(el.w) || 1;
  let h = Number(el.h) || 1;
  const trimW = dims.w;
  const trimH = dims.h;
  const bleed = dims.bleed ?? POSTCARD_BLEED_IN;
  const extend = el.type === 'render' || el.type === 'image' || el.type === 'logo' || el.type === 'rect';
  if (extend) {
    if (x <= EDGE_EPS) {
      w += x + bleed;
      x = -bleed;
    }
    if (y <= EDGE_EPS) {
      h += y + bleed;
      y = -bleed;
    }
    if (x + w >= trimW - EDGE_EPS) {
      w = trimW + bleed - x;
    }
    if (y + h >= trimH - EDGE_EPS) {
      h = trimH + bleed - y;
    }
  }
  return {
    x: (x + bleed) * IN,
    y: (y + bleed) * IN,
    w: w * IN,
    h: h * IN,
  };
}

/** When z-index ties, draw house photo first, then text/price, then QR on top. */
const LAYER_ORDER = { render: 0, image: 0, logo: 0, rect: 1, text: 2, price: 2, address: 2, qr: 3 };

function sortElements(elements = []) {
  return [...elements].sort((a, b) => {
    const dz = (a.z || 0) - (b.z || 0);
    if (dz !== 0) return dz;
    return (LAYER_ORDER[a.type] ?? 2) - (LAYER_ORDER[b.type] ?? 2);
  });
}

function elementArea(el) {
  return Math.max(0, el.w || 0) * Math.max(0, el.h || 0);
}

/**
 * Custom templates often use an uploaded sample house as their main front image
 * instead of a dynamic render element. At merge time, turn the largest front
 * image into the recipient's house slot while preserving its size and position.
 */
export function personalizeFrontImage(template) {
  const front = template?.front;
  const elements = front?.elements || [];
  if (elements.some((el) => el.type === 'render')) return template;

  const replacement = elements
    .filter((el) => el.type === 'image' && !el.overlay && (el.src || el.url))
    .sort((a, b) => elementArea(b) - elementArea(a))[0];
  if (!replacement) return template;

  return {
    ...template,
    front: {
      ...front,
      elements: elements.map((el) => {
        if (el.id !== replacement.id) return el;
        const { src, url, ...slot } = el;
        return { ...slot, type: 'render' };
      }),
    },
  };
}

function imageElementBuffer(el) {
  const src = String(el?.src || el?.url || '');
  if (src.startsWith('data:image')) {
    const match = src.match(/^data:image\/[a-z0-9.+-]+;base64,(.*)$/i);
    return match ? Buffer.from(match[1], 'base64') : null;
  }
  if (src.startsWith('/')) {
    const fp = path.join(PUBLIC_DIR, src.replace(/^\//, ''));
    if (fs.existsSync(fp)) return fs.readFileSync(fp);
  }
  return null;
}

/** A picture frame is a PNG with real transparency. It must stay above the house photo. */
async function isFrameArtwork(el) {
  if (el?.overlay) return true;
  if (el?.type !== 'image' && el?.type !== 'logo') return false;
  const buf = imageElementBuffer(el);
  if (!buf) return false;
  try {
    const img = sharp(buf);
    const meta = await img.metadata();
    if (!meta.hasAlpha) return false;
    const stats = await img.stats();
    const alpha = stats.channels?.[3];
    return Boolean(alpha && alpha.min < 250);
  } catch {
    return false;
  }
}

/**
 * Opaque uploaded photos become the house slot. A transparent frame stays an
 * overlay, with a house photo placed behind it when the template has none.
 */
export async function personalizeFrontForPrint(template) {
  const front = template?.front;
  let elements = [...(front?.elements || [])];
  const frameIds = [];
  for (const el of elements) {
    if (await isFrameArtwork(el)) frameIds.push(el.id);
  }
  if (frameIds.length) {
    elements = elements.map((el) => (frameIds.includes(el.id) ? { ...el, overlay: true } : el));
  }
  const withFrames = { ...template, front: { ...front, elements } };
  if (elements.some((el) => el.type === 'render')) return withFrames;

  const personalized = personalizeFrontImage(withFrames);
  if (personalized.front.elements.some((el) => el.type === 'render')) return personalized;

  const frame = elements
    .filter((el) => frameIds.includes(el.id))
    .sort((a, b) => elementArea(b) - elementArea(a))[0];
  if (!frame) return withFrames;
  return {
    ...withFrames,
    front: {
      ...withFrames.front,
      elements: [
        {
          id: `${frame.id}-house`,
          type: 'render',
          x: frame.x || 0,
          y: frame.y || 0,
          w: frame.w || 1,
          h: frame.h || 1,
          z: (Number(frame.z) || 1) - 1,
        },
        ...elements,
      ],
    },
  };
}

function overlapArea(a, b) {
  const ax1 = a.x || 0;
  const ay1 = a.y || 0;
  const ax2 = ax1 + (a.w || 0);
  const ay2 = ay1 + (a.h || 0);
  const bx1 = b.x || 0;
  const by1 = b.y || 0;
  const bx2 = bx1 + (b.w || 0);
  const by2 = by1 + (b.h || 0);
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(ax1, bx1));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(ay1, by1));
  return ix * iy;
}

/** True when a static uploaded image/logo covers most of a dynamic render slot. */
export function renderCoveredByArtwork(renderEl, elements = []) {
  const area = elementArea(renderEl);
  if (area <= 0) return false;
  return elements.some((el) => {
    if (el.overlay) return false;
    if ((el.type !== 'image' && el.type !== 'logo') || !el.src) return false;
    return overlapArea(renderEl, el) / area >= 0.45;
  });
}

/** Drop render slots that sit under uploaded artwork (leftover from cloning starters). */
export function stripCoveredRenderSlots(side) {
  if (!side || !Array.isArray(side.elements)) return side || { background: '#0b0b0d', elements: [] };
  const elements = side.elements;
  return {
    ...side,
    elements: elements.filter((el) => !(el.type === 'render' && renderCoveredByArtwork(el, elements))),
  };
}

function drawFittedImage(doc, source, x, y, w, h, fit = 'cover') {
  // Default cover so letterboxing never reveals layers underneath.
  // Opt-in contain is for logos/mascots that must not be cropped.
  // Fill stretches designed backgrounds (waves/banners) across 6×11.
  if (fit === 'contain') {
    doc.image(source, x, y, { fit: [w, h], align: 'center', valign: 'center' });
    return;
  }
  if (fit === 'fill' || fit === 'stretch') {
    doc.image(source, x, y, { width: w, height: h });
    return;
  }
  doc.image(source, x, y, { cover: [w, h], align: 'center', valign: 'center' });
}

async function toJpegBuffer(buf) {
  try {
    return await sharp(buf).rotate().jpeg({ quality: 88 }).toBuffer();
  } catch {
    return buf;
  }
}

async function fetchImageBuffer(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.warn('[postcardPdf] fetch failed', url, err.message);
    return null;
  }
}

/** Load a house photo for PDFKit: local file, then HTTP, then JPEG-normalize. */
export async function loadRenderImage(imageRef) {
  if (!imageRef) return null;
  const raw = String(imageRef).trim().split('?')[0];
  if (!raw) return null;

  const isHttp = /^https?:\/\//i.test(raw);
  const rel = raw.replace(/^\//, '');
  const basename = path.basename(isHttp ? (() => {
    try { return new URL(raw).pathname; } catch { return rel; }
  })() : rel);
  const localPaths = [
    !isHttp ? path.join(PUBLIC_DIR, rel) : null,
    path.join(RENDERS_DIR, basename),
  ].filter(Boolean);

  for (const fp of localPaths) {
    if (fp && fs.existsSync(fp)) {
      return toJpegBuffer(fs.readFileSync(fp));
    }
  }

  const urls = [];
  if (isHttp) urls.push(raw);
  if (basename && !basename.includes('..')) {
    urls.push(`http://127.0.0.1:${PORT || 3100}/renders/${basename}`);
  }
  const publicBase = (PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (publicBase && !isHttp) {
    urls.push(`${publicBase}${raw.startsWith('/') ? raw : `/${raw}`}`);
  }

  for (const url of urls) {
    const buf = await fetchImageBuffer(url);
    if (buf?.length) return toJpegBuffer(buf);
  }

  console.warn('[postcardPdf] missing render image:', imageRef);
  return null;
}

async function drawElement(doc, el, ctx) {
  const dims = ctx.dims || postcardDims('6x9');
  const { x, y, w, h } = elementPdfBox(el, dims);
  const color = el.color || '#ffffff';
  const fontSize = templateFontToPt(el);
  const align = el.align || 'left';

  if (el.type === 'render') {
    const source = await loadRenderImage(ctx.renderImagePath);
    if (source) {
      try {
        drawFittedImage(doc, source, x, y, w, h);
        return;
      } catch (err) {
        console.warn('[postcardPdf] embed render failed:', err.message);
      }
    }
    doc.rect(x, y, w, h).fill('#1b1b1f');
    doc.fillColor('#666').fontSize(10).text('[Render]', x, y + h / 2 - 5, { width: w, align: 'center' });
    return;
  }

  if (el.type === 'qr') {
    return QRCode.toBuffer(ctx.quoteUrl || 'https://example.com', { margin: 1, width: Math.round(w) })
      .then((buf) => {
        doc.image(buf, x, y, { width: w, height: h });
      })
      .catch(() => {
        doc.rect(x, y, w, h).stroke('#666');
      });
  }

  if (el.type === 'image' || el.type === 'logo') {
    try {
      const src = el.src || el.url || '';
      if (src.startsWith('data:image')) {
        const m = src.match(/^data:(image\/[a-z0-9.+-]+);base64,(.*)$/i);
        if (m) {
          drawFittedImage(doc, Buffer.from(m[2], 'base64'), x, y, w, h, el.fit);
        }
      } else if (src.startsWith('/')) {
        const fp = path.join(PUBLIC_DIR, src.replace(/^\//, ''));
        if (fs.existsSync(fp)) drawFittedImage(doc, fp, x, y, w, h, el.fit);
      }
    } catch {
      doc.rect(x, y, w, h).fill('#1b1b1f');
      doc.fillColor('#666').fontSize(10).text(`[${el.type}]`, x, y + h / 2 - 5, { width: w, align: 'center' });
    }
    return Promise.resolve();
  }

  if (el.type === 'rect') {
    doc.rect(x, y, w, h).fill(el.fill || '#333');
    return Promise.resolve();
  }

  const text = resolveElementContent(el, ctx);
  doc.font(fontForElement(el)).fontSize(fontSize);
  const textOpts = {
    width: w,
    height: h,
    align,
    lineGap: (el.lineGap ?? 0) * (el.follow ? 1 : IN / CANVAS_PX_PER_IN),
  };
  let textY = y;
  if (el.follow) {
    const lines = String(text || '').split('\n').length;
    const block = lines * fontSize * 1.5;
    textY = y + Math.max(0, (h - block) / 2);
  }
  if (el.strokeColor) {
    doc.fillColor(color);
    doc.strokeColor(el.strokeColor);
    doc.lineWidth(Number(el.strokeWidth) || 1.6);
    doc.text(text, x, textY, { ...textOpts, height: Math.max(fontSize, h - (textY - y)), fill: true, stroke: true });
  } else {
    doc.fillColor(color);
    doc.text(text, x, textY, { ...textOpts, height: Math.max(fontSize, h - (textY - y)) });
  }
  return Promise.resolve();
}

async function drawSide(doc, side, ctx) {
  const cleaned = stripCoveredRenderSlots(side);
  const bg = cleaned?.background || '#0b0b0d';
  const dims = ctx.dims || postcardDims('6x9');
  doc.rect(0, 0, dims.pdfW * IN, dims.pdfH * IN).fill(bg);
  const elements = sortElements(layoutAnchoredElements(cleaned?.elements || []));
  for (const el of elements) {
    await drawElement(doc, el, ctx);
  }
}

function pdfPageSize(dims) {
  return [dims.pdfW * IN, dims.pdfH * IN];
}

function pdfBufferFromSides(sides, ctx) {
  const dims = ctx.dims || postcardDims('6x9');
  const pageSize = pdfPageSize(dims);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: pageSize,
      margin: 0,
      autoFirstPage: true,
      info: { Title: `Postcard ${dims.label || dims.format}` },
    });
    registerCustomFonts(doc);
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    (async () => {
      try {
        for (let i = 0; i < sides.length; i += 1) {
          if (i > 0) doc.addPage({ size: pageSize, margin: 0 });
          await drawSide(doc, sides[i], ctx);
        }
        doc.end();
      } catch (err) {
        reject(err);
      }
    })();
  });
}

function sideToPdfBuffer(side, ctx) {
  return pdfBufferFromSides([side || {}], ctx);
}

export async function renderPostcardPdfs(template, ctx) {
  const dims = postcardDims(template?.format);
  const next = { ...ctx, dims };
  const personalized = await personalizeFrontForPrint(template);
  const frontSide = personalized.front || {};
  const backSide = personalized.back || {};
  const [front, back, combined] = await Promise.all([
    sideToPdfBuffer(frontSide, next),
    sideToPdfBuffer(backSide, next),
    pdfBufferFromSides([frontSide, backSide], next),
  ]);
  return { front, back, combined, dims };
}

export function saveMailPdfs(homeId, pdfs, format = '6x9') {
  const dir = path.join(PUBLIC_DIR, 'mail');
  fs.mkdirSync(dir, { recursive: true });
  const size = postcardDims(format).format;
  const stamp = Date.now();
  const frontName = `${homeId}-${size}-front.pdf`;
  const backName = `${homeId}-${size}-back.pdf`;
  const previewName = `${homeId}-${size}.pdf`;
  fs.writeFileSync(path.join(dir, frontName), pdfs.front);
  fs.writeFileSync(path.join(dir, backName), pdfs.back);
  fs.writeFileSync(path.join(dir, previewName), pdfs.combined);
  return {
    frontUrl: `/mail/${frontName}?t=${stamp}`,
    backUrl: `/mail/${backName}?t=${stamp}`,
    previewUrl: `/mail/${previewName}?t=${stamp}`,
    format: size,
    label: postcardDims(size).label,
  };
}

export async function buildPostcardForHome(template, home, render, options = {}) {
  const base = options.baseUrl || '';
  const pricing = resolveQuotePricing(render || { estimated_total: home.estimated_total, roofline_feet: null });
  const ownerName = options.ownerName || home.owner_name || '';
  const ctx = {
    address: home.address,
    ownerName,
    owner: ownerName,
    ownerFirst: ownerFirstName(ownerName),
    priceFormatted: options.priceFormatted || formatPrice(pricing.frontPrice || home.estimated_total || render?.estimated_total),
    rooflineFeet: pricing.frontFeet,
    quoteUrl: options.quoteUrl || (render?.id ? `${base}/app/quote/${render.id}` : ''),
    renderImagePath: render?.image_url || null,
  };
  const pdfs = await renderPostcardPdfs(template, ctx);
  const urls = saveMailPdfs(home.id, pdfs, template?.format);
  return { pdfs, urls, ctx };
}

export function samplePreviewContext(render) {
  return {
    address: render?.address || '123 Sample St, Austin, TX 78701',
    ownerName: 'Alex Rivera',
    owner: 'Alex Rivera',
    ownerFirst: 'Alex',
    priceFormatted: render?.estimated_total ? `$${Number(render.estimated_total).toLocaleString()}` : '$4,500',
    quoteUrl: render?.id ? `https://example.com/app/quote/${render.id}` : 'https://example.com/app/quote/sample',
    renderImagePath: render?.image_url || null,
  };
}
