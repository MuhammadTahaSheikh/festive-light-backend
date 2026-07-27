import { Router } from 'express';
import {
  GOOGLE_MAPS_API_KEY,
  GEMINI_API_KEY,
  GEMINI_IMAGE_MODEL,
  CF_ACCOUNT_ID,
  CF_API_TOKEN,
  MAX_FREE_RENDERS,
} from '../config/env.js';
import { activeProvider } from '../services/render.js';
import { dbMode, authMode } from '../db/index.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    maps: Boolean(GOOGLE_MAPS_API_KEY),
    gemini: Boolean(GEMINI_API_KEY),
    cloudflare: Boolean(CF_ACCOUNT_ID && CF_API_TOKEN),
    provider: activeProvider(),
    model: GEMINI_IMAGE_MODEL,
    db: dbMode,
  });
});

router.get('/config', (_req, res) => {
  res.json({
    maxFreeRenders: MAX_FREE_RENDERS,
    authMode,
    maps: Boolean(GOOGLE_MAPS_API_KEY),
    // Used only by Outreach map UI; render widget reads `maps` boolean only.
    mapsApiKey: GOOGLE_MAPS_API_KEY || null,
  });
});

/** Browser Maps JS key — Outreach map only. */
router.get('/config/maps-js', (_req, res) => {
  res.json({
    mapsApiKey: GOOGLE_MAPS_API_KEY || null,
    maps: Boolean(GOOGLE_MAPS_API_KEY),
  });
});

export default router;
