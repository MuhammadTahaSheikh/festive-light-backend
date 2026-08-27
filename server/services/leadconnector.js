import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { LEADCONNECTOR_WEBHOOK_URL, PUBLIC_BASE_URL, QUOTE_PAGE_BASE_URL, PORT } from '../config/env.js';
import { RENDERS_DIR } from '../config/paths.js';
import { buildQuoteUrl, formatPrice } from './postcardMerge.js';

/** Keep GHL payloads well under typical inbound-webhook size limits. */
const IMAGE_MAX_BYTES = 450_000;

export function isLeadConnectorConfigured() {
  return Boolean(LEADCONNECTOR_WEBHOOK_URL && String(LEADCONNECTOR_WEBHOOK_URL).startsWith('http'));
}

function publicBase() {
  const base = (PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (base) return base;
  return `http://localhost:${PORT || 3000}`;
}

/** Quote page lives on the Vercel app at /app/quote/:id — never localhost. */
function quotePageBase() {
  const raw = (QUOTE_PAGE_BASE_URL || PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (raw && !/localhost|127\.0\.0\.1/i.test(raw)) return raw;
  return 'https://festive-light-frontend.vercel.app';
}

export function customerQuoteUrl(quoteId) {
  if (!quoteId) return '';
  return buildQuoteUrl(quoteId, quotePageBase());
}

export function absolutizeUrl(imageUrl) {
  const raw = String(imageUrl || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return raw;
  return `${publicBase()}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function resolveRenderFile(imageUrl) {
  if (!imageUrl) return null;
  const name = path.basename(String(imageUrl).split('?')[0]);
  if (!name || name.includes('..')) return null;
  const full = path.join(RENDERS_DIR, name);
  if (!fs.existsSync(full)) return null;
  return full;
}

async function imageDataUri(imageUrl) {
  const filePath = resolveRenderFile(imageUrl);
  if (!filePath) return '';

  try {
    const original = fs.readFileSync(filePath);
    const mime = /\.png$/i.test(filePath) ? 'image/png' : 'image/jpeg';
    if (original.length <= IMAGE_MAX_BYTES) {
      return `data:${mime};base64,${original.toString('base64')}`;
    }
    const buf = await sharp(filePath)
      .rotate()
      .resize({ width: 1280, withoutEnlargement: true })
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch (e) {
    console.warn('[leadconnector] image encode failed:', e.message);
    return '';
  }
}

export function buildConsultationHtmlEmail({
  name = '',
  address = '',
  imageUrl = '',
  footage = 0,
  estimate = 0,
  extraFootage = 0,
  extraPrice = 0,
  pricePerFoot = 0,
  quoteId = null,
} = {}) {
  const safeName = escapeHtml(name);
  const safeAddress = escapeHtml(address);
  const absImage = absolutizeUrl(imageUrl);
  const quoteUrl = customerQuoteUrl(quoteId);
  const greeting = safeName ? `Hi ${safeName},` : 'Hi,';
  const extraLine = extraFootage > 0
    ? `<li>Extra footage: <strong>${Math.round(extraFootage)} ft</strong>${extraPrice ? ` · ${escapeHtml(formatPrice(extraPrice))}` : ''}</li>`
    : '';

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f6f6f4;font-family:Georgia,serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#888;">Festive Lighting Pros</p>
    <h1 style="margin:0 0 12px;font-size:26px;font-weight:normal;color:#1a1a1a;">Your free consultation request</h1>
    <p style="margin:0 0 20px;font-size:16px;color:#444;line-height:1.5;">
      ${greeting} thanks for requesting a free on-site design consultation${safeAddress ? ` for <strong>${safeAddress}</strong>` : ''}.
      We'll reach out shortly to schedule a time.
    </p>
    ${absImage
      ? `<img src="${escapeHtml(absImage)}" alt="Your home with festive lighting" style="width:100%;max-width:560px;height:auto;border-radius:4px;display:block;" />`
      : ''}
    <p style="margin:16px 0 8px;font-size:15px;color:#333;"><strong>Estimated quote</strong></p>
    <ul style="margin:0;padding-left:18px;font-size:15px;color:#333;line-height:1.6;">
      ${footage ? `<li>Front footage: <strong>${Math.round(footage)} ft</strong></li>` : ''}
      ${estimate ? `<li>Front quote: <strong>${escapeHtml(formatPrice(estimate))}</strong></li>` : ''}
      ${pricePerFoot ? `<li>Price per foot: <strong>$${Number(pricePerFoot)}</strong></li>` : ''}
      ${extraLine}
    </ul>
    ${quoteUrl
      ? `<p style="margin:24px 0;">
           <a href="${escapeHtml(quoteUrl)}"
              clicktracking="off"
              data-msys-clicktrack="0"
              style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-size:15px;">
             View your full quote
           </a>
         </p>
         <p style="font-size:13px;color:#888;word-break:break-all;">Open your quote: ${escapeHtml(quoteUrl)}</p>`
      : ''}
    <p style="margin:28px 0 0;font-size:13px;color:#888;line-height:1.5;">
      Questions? Call (941) 239-7919.
    </p>
  </div>
</body>
</html>`;
}

export function buildBookConsultationPayload(input = {}) {
  const footage = Math.round(toNum(input.footage));
  const estimate = Math.round(toNum(input.estimate));
  const extraFootage = Math.round(toNum(input.extraFootage));
  const pricePerFoot = toNum(input.pricePerFoot);
  const extraPrice = input.extraPrice == null || input.extraPrice === ''
    ? Math.round(extraFootage * pricePerFoot)
    : Math.round(toNum(input.extraPrice));
  const imageUrl = absolutizeUrl(input.imageUrl);
  const quoteUrl = customerQuoteUrl(input.quoteId);
  const htmlEmail = input.htmlEmail
    || buildConsultationHtmlEmail({
      ...input,
      footage,
      estimate,
      extraFootage,
      extraPrice,
      pricePerFoot,
      imageUrl,
    });

  return {
    event: 'book_consultation',
    name: String(input.name || ''),
    email: String(input.email || ''),
    phone: String(input.phone || ''),
    address: String(input.address || ''),
    footage,
    estimate,
    extraFootage,
    extraPrice,
    pricePerFoot,
    imageUrl,
    image: String(input.image || ''),
    quoteUrl,
    htmlEmail,
  };
}

/**
 * POST a book_consultation payload to Go High Level / LeadConnector.
 * Safe to call fire-and-forget; skips when the webhook URL is disabled.
 */
export async function sendBookConsultationWebhook(input = {}) {
  if (!isLeadConnectorConfigured()) {
    return { skipped: true, reason: 'not_configured' };
  }

  const image = input.image || await imageDataUri(input.imageUrl);
  const payload = buildBookConsultationPayload({ ...input, image });

  const resp = await fetch(LEADCONNECTOR_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20_000),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`leadconnector_${resp.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`);
  }

  console.log('[leadconnector] book_consultation sent', payload.email || payload.address || '');
  return { ok: true, payload };
}
