import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM,
  EMAIL_FROM_NAME,
  EMAIL_REPLY_TO,
  PUBLIC_BASE_URL,
  PORT,
} from '../config/env.js';
import { RENDERS_DIR } from '../config/paths.js';
import { buildQuoteUrl, formatPrice } from './postcardMerge.js';

export function isEmailConfigured() {
  return Boolean(SMTP_HOST && EMAIL_FROM);
}

let transporter = null;

function getTransporter() {
  if (!isEmailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

function publicBase() {
  const base = (PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (base) return base;
  return `http://localhost:${PORT || 3000}`;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveRenderFile(imageUrl) {
  if (!imageUrl) return null;
  const name = path.basename(String(imageUrl).split('?')[0]);
  if (!name || name.includes('..')) return null;
  const full = path.join(RENDERS_DIR, name);
  if (!fs.existsSync(full)) return null;
  return full;
}

/**
 * Send the lit-up design + quote estimate to the homeowner.
 * Safe to call fire-and-forget; skips quietly when SMTP is not configured.
 */
export async function sendDesignQuoteEmail({
  to,
  address = '',
  imageUrl = '',
  quoteId = null,
  stats = {},
} = {}) {
  const email = String(to || '').trim();
  if (!email) return { skipped: true, reason: 'no_recipient' };

  const transport = getTransporter();
  if (!transport) {
    console.warn('[email] SMTP not configured — skipping design quote email to', email);
    return { skipped: true, reason: 'not_configured' };
  }

  const frontPrice = formatPrice(stats.frontPrice ?? stats.estimatedTotal);
  const wholePrice = formatPrice(stats.wholePrice);
  const feet = stats.frontFeet ?? stats.rooflineFeet;
  const feetLabel = Number.isFinite(Number(feet)) && Number(feet) > 0
    ? `~${Math.round(Number(feet))} ft front roofline`
    : '';
  const quoteUrl = quoteId ? buildQuoteUrl(quoteId, publicBase()) : '';
  const safeAddress = escapeHtml(address);
  const filePath = resolveRenderFile(imageUrl);
  const cid = 'design@flp';

  const pricingBlock = (stats.frontPrice || stats.wholePrice)
    ? `<p style="margin:16px 0 8px;font-size:15px;color:#333;">
         <strong>Estimated quote</strong>${feetLabel ? ` <span style="color:#666;">(${escapeHtml(feetLabel)})</span>` : ''}
       </p>
       <ul style="margin:0;padding-left:18px;font-size:15px;color:#333;line-height:1.6;">
         <li>Front of home: <strong>${escapeHtml(frontPrice)}</strong></li>
         ${stats.wholePrice ? `<li>Whole house: <strong>${escapeHtml(wholePrice)}</strong></li>` : ''}
       </ul>`
    : `<p style="margin:16px 0;font-size:15px;color:#333;">Your personalized lighting design is ready. Open your quote for details and pricing.</p>`;

  const ctaBlock = quoteUrl
    ? `<p style="margin:24px 0;">
         <a href="${escapeHtml(quoteUrl)}"
            style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-size:15px;">
           View your full quote
         </a>
       </p>
       <p style="font-size:13px;color:#888;word-break:break-all;">Or open: ${escapeHtml(quoteUrl)}</p>`
    : '';

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f6f6f4;font-family:Georgia,serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#888;">Festive Lighting Pros</p>
    <h1 style="margin:0 0 12px;font-size:26px;font-weight:normal;color:#1a1a1a;">Your home, lit up</h1>
    <p style="margin:0 0 20px;font-size:16px;color:#444;line-height:1.5;">
      Here's the permanent lighting design we created${safeAddress ? ` for <strong>${safeAddress}</strong>` : ''}.
    </p>
    ${filePath
      ? `<img src="cid:${cid}" alt="Your home with festive lighting" style="width:100%;max-width:560px;height:auto;border-radius:4px;display:block;" />`
      : ''}
    ${pricingBlock}
    ${ctaBlock}
    <p style="margin:28px 0 0;font-size:13px;color:#888;line-height:1.5;">
      Questions? Reply to this email or call (941) 239-7919.
    </p>
  </div>
</body>
</html>`;

  const textParts = [
    'Your home, lit up — Festive Lighting Pros',
    address ? `Address: ${address}` : '',
    feetLabel ? `Front roofline: ${feetLabel}` : '',
    stats.frontPrice || stats.wholePrice
      ? `Estimated quote — Front: ${frontPrice}${stats.wholePrice ? `; Whole house: ${wholePrice}` : ''}`
      : '',
    quoteUrl ? `View your full quote: ${quoteUrl}` : '',
    'Questions? Call (941) 239-7919.',
  ].filter(Boolean);

  const from = EMAIL_FROM_NAME
    ? `"${EMAIL_FROM_NAME.replace(/"/g, '')}" <${EMAIL_FROM}>`
    : EMAIL_FROM;

  const mail = {
    from,
    to: email,
    subject: address
      ? `Your home lit up — ${address}`
      : 'Your home lit up — Festive Lighting Pros',
    text: textParts.join('\n\n'),
    html,
    replyTo: EMAIL_REPLY_TO || undefined,
    attachments: filePath
      ? [{
          filename: path.basename(filePath),
          path: filePath,
          cid,
          contentDisposition: 'inline',
        }]
      : [],
  };

  const info = await transport.sendMail(mail);
  console.log('[email] design quote sent to', email, info.messageId || '');
  return { ok: true, messageId: info.messageId };
}
