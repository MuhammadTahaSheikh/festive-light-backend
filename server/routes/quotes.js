import { Router } from 'express';
import { listRenders, getRender } from '../db/index.js';
import { resolveQuotePricing } from '../services/pricing.js';
import { buildSeasonGallery, resolveSeasonImage, seasonMeta } from '../services/seasonSwitch.js';

const router = Router();

router.get('/renders', async (_req, res) => {
  try {
    res.json({ ok: true, renders: await listRenders() });
  } catch (err) {
    res.status(500).json({ error: 'renders_failed', detail: String(err.message || err) });
  }
});

async function quotePayload(render) {
  const pricing = resolveQuotePricing(render);
  const { primary, gallery, available } = await buildSeasonGallery(render);
  return {
    id: render.id,
    address: render.address,
    imageUrl: render.image_url,
    scheme: render.scheme,
    ...pricing,
    createdAt: render.created_at,
    seasonSwitch: {
      enabled: true,
      primary,
      seasons: seasonMeta(),
      gallery,
      available,
    },
  };
}

router.get('/quote/:id', async (req, res) => {
  try {
    const render = await getRender(req.params.id);
    if (!render) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true, quote: await quotePayload(render) });
  } catch (err) {
    res.status(500).json({ error: 'quote_failed', detail: String(err.message || err) });
  }
});

router.post('/quote/:id/season', async (req, res) => {
  const { scheme = '' } = req.body || {};
  try {
    const render = await getRender(req.params.id);
    if (!render) return res.status(404).json({ error: 'not_found' });

    const result = await resolveSeasonImage(render, scheme);
    const galleryBuilt = await buildSeasonGallery(render);
    // Ensure the season just resolved is present even if DB read lagged.
    if (result.imageUrl) {
      galleryBuilt.gallery[scheme] = result.imageUrl;
      if (!galleryBuilt.available.includes(scheme)) galleryBuilt.available.push(scheme);
    }
    res.json({
      ok: true,
      scheme,
      imageUrl: result.imageUrl,
      cached: result.cached,
      generated: result.generated,
      seasonSwitch: {
        enabled: true,
        ...galleryBuilt,
        seasons: seasonMeta(),
      },
    });
  } catch (err) {
    const code = String(err.message || err);
    const status = code === 'render_not_found' || code === 'address_not_found' || code === 'no_streetview'
      ? 404
      : code === 'invalid_season'
        ? 400
        : 503;
    const detail = code === 'season_source_unavailable'
      ? 'Could not load a source photo for this quote.'
      : code;
    res.status(status).json({ error: code, detail });
  }
});

export default router;
