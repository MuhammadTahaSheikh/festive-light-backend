import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import sharp from 'sharp';
import {
  POSTCARD_W_IN,
  POSTCARD_H_IN,
} from './postcardStarters.js';
import { resolveElementContent, formatPrice } from './postcardMerge.js';
import { resolveQuotePricing } from './pricing.js';
import { PUBLIC_DIR, RENDERS_DIR } from '../config/paths.js';
import { PORT, PUBLIC_BASE_URL } from '../config/env.js';
import { ownerFirstName } from './ownerLookup.js';

const IN = 72; // points per inch
const PAGE_SIZE = [POSTCARD_W_IN * IN, POSTCARD_H_IN * IN];

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
    .filter((el) => el.type === 'image' && (el.src || el.url))
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

function drawFittedImage(doc, source, x, y, w, h) {
  // Cover the slot completely (object-fit: cover) so letterboxing never reveals layers underneath.
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
  const x = (el.x || 0) * IN;
  const y = (el.y || 0) * IN;
  const w = (el.w || 1) * IN;
  const h = (el.h || 1) * IN;
  const color = el.color || '#ffffff';
  const fontSize = el.fontSize || 14;
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
          drawFittedImage(doc, Buffer.from(m[2], 'base64'), x, y, w, h);
        }
      } else if (src.startsWith('/')) {
        const fp = path.join(PUBLIC_DIR, src.replace(/^\//, ''));
        if (fs.existsSync(fp)) drawFittedImage(doc, fp, x, y, w, h);
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
  doc.fillColor(color);
  doc.font(el.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
  doc.text(text, x, y, { width: w, height: h, align });
  return Promise.resolve();
}

async function drawSide(doc, side, ctx) {
  const cleaned = stripCoveredRenderSlots(side);
  const bg = cleaned?.background || '#0b0b0d';
  doc.rect(0, 0, POSTCARD_W_IN * IN, POSTCARD_H_IN * IN).fill(bg);
  const elements = sortElements(cleaned?.elements || []);
  for (const el of elements) {
    await drawElement(doc, el, ctx);
  }
}

function pdfBufferFromSides(sides, ctx) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: PAGE_SIZE,
      margin: 0,
      autoFirstPage: true,
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    (async () => {
      try {
        for (let i = 0; i < sides.length; i += 1) {
          if (i > 0) doc.addPage({ size: PAGE_SIZE, margin: 0 });
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
  const personalized = personalizeFrontImage(template);
  const frontSide = personalized.front || {};
  const backSide = personalized.back || {};
  const [front, back, combined] = await Promise.all([
    sideToPdfBuffer(frontSide, ctx),
    sideToPdfBuffer(backSide, ctx),
    pdfBufferFromSides([frontSide, backSide], ctx),
  ]);
  return { front, back, combined };
}

export function saveMailPdfs(homeId, pdfs) {
  const dir = path.join(PUBLIC_DIR, 'mail');
  fs.mkdirSync(dir, { recursive: true });
  const frontName = `${homeId}-front.pdf`;
  const backName = `${homeId}-back.pdf`;
  const previewName = `${homeId}.pdf`;
  fs.writeFileSync(path.join(dir, frontName), pdfs.front);
  fs.writeFileSync(path.join(dir, backName), pdfs.back);
  fs.writeFileSync(path.join(dir, previewName), pdfs.combined);
  return {
    frontUrl: `/mail/${frontName}`,
    backUrl: `/mail/${backName}`,
    previewUrl: `/mail/${previewName}`,
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
    ownerFirst: ownerFirstName(ownerName, 'neighbor'),
    priceFormatted: options.priceFormatted || formatPrice(pricing.frontPrice || home.estimated_total || render?.estimated_total),
    rooflineFeet: pricing.frontFeet,
    quoteUrl: options.quoteUrl || (render?.id ? `${base}/app/quote/${render.id}` : ''),
    renderImagePath: render?.image_url || null,
  };
  const pdfs = await renderPostcardPdfs(template, ctx);
  const urls = saveMailPdfs(home.id, pdfs);
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
