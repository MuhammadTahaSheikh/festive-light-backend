import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {
  TEAMS_WEBHOOK_URL,
  PUBLIC_BASE_URL,
  PORT,
} from '../config/env.js';
import { RENDERS_DIR } from '../config/paths.js';
import { buildQuoteUrl, formatPrice } from './postcardMerge.js';

/** Teams Adaptive Card payload limit is ~28KB — keep image data well under that. */
const TEAMS_IMAGE_MAX_BYTES = 18_000;

export function isTeamsConfigured() {
  return Boolean(TEAMS_WEBHOOK_URL && String(TEAMS_WEBHOOK_URL).startsWith('http'));
}

function publicBase() {
  const base = (PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (base) return base;
  return `http://localhost:${PORT || 3000}`;
}

function resolveRenderFile(imageUrl) {
  if (!imageUrl) return null;
  const name = path.basename(String(imageUrl).split('?')[0]);
  if (!name || name.includes('..')) return null;
  const full = path.join(RENDERS_DIR, name);
  if (!fs.existsSync(full)) return null;
  return full;
}

function factSet(facts) {
  const items = facts.filter((f) => f.value);
  if (!items.length) return [];
  return [{
    type: 'FactSet',
    facts: items.map(({ title, value }) => ({ title, value: String(value) })),
  }];
}

/**
 * Build a tiny JPEG data-URI for Adaptive Cards (localhost URLs are not
 * reachable by Teams; full renders are far over the ~28KB card limit).
 */
async function thumbnailDataUri(imageUrl) {
  const filePath = resolveRenderFile(imageUrl);
  if (!filePath) return null;

  const widths = [420, 320, 240];
  const qualities = [55, 40, 28];

  for (const width of widths) {
    for (const quality of qualities) {
      try {
        const buf = await sharp(filePath)
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .jpeg({ quality, mozjpeg: true })
          .toBuffer();
        if (buf.length <= TEAMS_IMAGE_MAX_BYTES) {
          return `data:image/jpeg;base64,${buf.toString('base64')}`;
        }
      } catch (e) {
        console.warn('[teams] thumbnail failed:', e.message);
        return null;
      }
    }
  }

  // Last resort: force a very small preview even if slightly over budget.
  try {
    const buf = await sharp(filePath)
      .rotate()
      .resize({ width: 200, withoutEnlargement: true })
      .jpeg({ quality: 22, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch (e) {
    console.warn('[teams] thumbnail fallback failed:', e.message);
    return null;
  }
}

/**
 * Notify a Teams channel when a home is lit up.
 * Fire-and-forget safe; skips quietly when TEAMS_WEBHOOK_URL is unset.
 *
 * Power Automate "Send webhook alerts to a channel" expects a message with
 * Adaptive Card attachments (plain { text } is accepted with 202 but often
 * never posts).
 */
export async function sendLightUpTeamsAlert({
  address = '',
  name = '',
  email = '',
  phone = '',
  imageUrl = '',
  quoteId = null,
  stats = {},
} = {}) {
  if (!isTeamsConfigured()) {
    return { skipped: true, reason: 'not_configured' };
  }

  const frontPrice = formatPrice(stats.frontPrice ?? stats.estimatedTotal);
  const wholePrice = formatPrice(stats.wholePrice);
  const feet = stats.frontFeet ?? stats.rooflineFeet;
  const feetLabel = Number.isFinite(Number(feet)) && Number(feet) > 0
    ? `~${Math.round(Number(feet))} ft front roofline`
    : '';
  const quoteUrl = quoteId ? buildQuoteUrl(quoteId, publicBase()) : '';
  const designUrl = imageUrl
    ? (String(imageUrl).startsWith('http') ? imageUrl : `${publicBase()}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`)
    : '';

  const estimateLine = (stats.frontPrice || stats.wholePrice || feetLabel)
    ? `${frontPrice}${feetLabel ? ` (${feetLabel})` : ''}${stats.wholePrice ? ` · Whole house: ${wholePrice}` : ''}`
    : '';

  const thumb = await thumbnailDataUri(imageUrl);

  const bodyBlocks = [
    {
      type: 'TextBlock',
      text: 'New Light-Up',
      weight: 'Bolder',
      size: 'Medium',
      wrap: true,
    },
  ];

  if (thumb) {
    bodyBlocks.push({
      type: 'Image',
      url: thumb,
      altText: address ? `Lit design for ${address}` : 'Lit home design',
      size: 'Stretch',
    });
  }

  bodyBlocks.push(...factSet([
    { title: 'Address', value: address },
    { title: 'Name', value: name },
    { title: 'Email', value: email },
    { title: 'Phone', value: phone },
    { title: 'Estimate', value: estimateLine },
  ]));

  if (designUrl) {
    bodyBlocks.push({
      type: 'TextBlock',
      text: `[View full design](${designUrl})`,
      wrap: true,
    });
  }
  if (quoteUrl) {
    bodyBlocks.push({
      type: 'TextBlock',
      text: `[Open quote](${quoteUrl})`,
      wrap: true,
    });
  }

  // Required shape for Workflows / Power Automate Teams webhooks.
  const body = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          msteams: { width: 'Full' },
          body: bodyBlocks,
        },
      },
    ],
  };

  const resp = await fetch(TEAMS_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`teams_webhook_${resp.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }

  console.log('[teams] light-up alert sent', address || quoteId || '', thumb ? '(with image)' : '(no image)');
  return { ok: true };
}
