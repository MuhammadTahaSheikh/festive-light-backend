import { GoogleGenAI } from '@google/genai';
import {
  GEMINI_API_KEY,
  GEMINI_IMAGE_MODEL,
  RENDER_PROVIDER,
  CF_ACCOUNT_ID,
  CF_API_TOKEN,
  CF_IMAGE_MODEL,
  CF_STRENGTH,
  CF_GUIDANCE,
} from '../config/env.js';
import { buildRenderPrompt, buildShortPrompt } from './prompts.js';

const genai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

export function activeProvider() {
  if (RENDER_PROVIDER === 'gemini') return GEMINI_API_KEY ? 'gemini' : 'none';
  if (RENDER_PROVIDER === 'cloudflare') return (CF_ACCOUNT_ID && CF_API_TOKEN) ? 'cloudflare' : 'none';
  if (CF_ACCOUNT_ID && CF_API_TOKEN) return 'cloudflare';
  if (GEMINI_API_KEY) return 'gemini';
  return 'none';
}

async function renderWithCloudflare(imageBuffer, prompt) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${CF_IMAGE_MODEL}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CF_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      negative_prompt: 'different house, generic house, redesigned garden, new landscaping, replaced plants, different roof, warped architecture, extra houses, lights on neighboring houses, lit adjacent roofs, deformed windows, changed driveway, new trees, fantasy garden, continuous light strip, solid line of light, light bar, glowing ribbon, merged lights, rope light, widely spaced lights, architectural downlights, recessed can lights, puck spotlights, large pools of wall light, hanging string lights, exposed wires, C9 bulbs, globe bulbs, oversized bulbs, large circular fixtures, fuzzy glowing dots, daytime, bright daylight, overexposed, blurry, low quality, text, watermark, cartoon, painting, neon glow',
      image: Array.from(imageBuffer),
      strength: CF_STRENGTH,
      num_steps: 20,
      guidance: CF_GUIDANCE,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error('Cloudflare AI error ' + resp.status + ': ' + t.slice(0, 300));
  }
  const ct = resp.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const j = await resp.json();
    const b64 = j?.result?.image;
    if (b64) return { buffer: Buffer.from(b64, 'base64'), mimeType: 'image/png' };
    throw new Error('Cloudflare AI returned no image: ' + JSON.stringify(j).slice(0, 300));
  }
  return { buffer: Buffer.from(await resp.arrayBuffer()), mimeType: 'image/png' };
}

async function renderWithGemini(imageBuffer, mimeType, prompt, { temperature = 0.4 } = {}) {
  if (!genai) throw new Error('GEMINI_API_KEY is missing.');
  const response = await genai.models.generateContent({
    model: GEMINI_IMAGE_MODEL,
    contents: [
      { text: prompt },
      { inlineData: { mimeType, data: imageBuffer.toString('base64') } },
    ],
    config: {
      responseModalities: ['IMAGE', 'TEXT'],
      temperature,
    },
  });
  const parts = response?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        buffer: Buffer.from(part.inlineData.data, 'base64'),
        mimeType: part.inlineData.mimeType || 'image/png',
      };
    }
  }
  throw new Error('No image returned by the model.');
}

/** Dispatch to whichever provider is configured. */
export async function doRender(imageBuffer, mimeType, opts) {
  const p = activeProvider();
  const custom = Boolean(opts?.userPrompt && String(opts.userPrompt).trim());
  if (custom) {
    console.log('[render] describe-mode prompt:', String(opts.userPrompt).trim().slice(0, 160));
  }
  if (p === 'gemini') {
    const isBrightDim = opts?.scheme === 'bright-dim-1-3';
    return renderWithGemini(imageBuffer, mimeType, buildRenderPrompt(opts), {
      // Bright-dim pattern is easy for the model to ignore — keep it tighter.
      temperature: custom ? 0.7 : isBrightDim ? 0.25 : 0.4,
    });
  }
  if (p === 'cloudflare') return renderWithCloudflare(imageBuffer, buildShortPrompt(opts));
  throw new Error('No render provider configured');
}
