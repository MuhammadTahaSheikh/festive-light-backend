import { Router } from 'express';
import {
  listPostcardTemplates,
  getPostcardTemplate,
  savePostcardTemplate,
  deletePostcardTemplate,
  cloneStarterTemplate,
} from '../db/postcardTemplates.js';
import { getRender } from '../db/renders.js';
import { buildPostcardForHome } from '../services/postcardPdf.js';
import { formatPrice, buildQuoteUrl } from '../services/postcardMerge.js';
import { PUBLIC_BASE_URL } from '../config/env.js';

const router = Router();

function accountKey(req) {
  return req.headers['x-account-email'] || req.body?.accountEmail || 'default';
}

router.get('/', async (req, res) => {
  try {
    const data = await listPostcardTemplates(accountKey(req));
    res.json({ ok: true, ...data });
  } catch (err) {
    res.status(500).json({ error: 'templates_failed', detail: String(err.message || err) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const template = await getPostcardTemplate(req.params.id, accountKey(req));
    if (!template) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true, template });
  } catch (err) {
    res.status(500).json({ error: 'templates_failed', detail: String(err.message || err) });
  }
});

router.post('/', async (req, res) => {
  try {
    const template = await savePostcardTemplate(accountKey(req), req.body || {});
    res.json({ ok: true, template });
  } catch (err) {
    res.status(500).json({ error: 'templates_failed', detail: String(err.message || err) });
  }
});

router.post('/clone', async (req, res) => {
  const { starterId = '', name = '' } = req.body || {};
  if (!starterId) return res.status(400).json({ error: 'missing_starter_id' });
  try {
    const template = await cloneStarterTemplate(accountKey(req), starterId, name);
    res.json({ ok: true, template });
  } catch (err) {
    res.status(500).json({ error: 'templates_failed', detail: String(err.message || err) });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await deletePostcardTemplate(req.params.id, accountKey(req));
    res.json({ ok: true });
  } catch (err) {
    if (String(err.message) === 'cannot_delete_starter') {
      return res.status(400).json({ error: 'cannot_delete_starter' });
    }
    res.status(500).json({ error: 'templates_failed', detail: String(err.message || err) });
  }
});

router.post('/:id/preview', async (req, res) => {
  const { renderId = '' } = req.body || {};
  try {
    const template = await getPostcardTemplate(req.params.id, accountKey(req));
    if (!template) return res.status(404).json({ error: 'not_found' });
    const render = renderId ? await getRender(renderId) : null;
    const home = {
      id: render?.id || `preview-${req.params.id}`,
      address: render?.address || '123 Sample St, Austin, TX 78701',
      estimated_total: render?.estimated_total || 4500,
    };
    const { urls } = await buildPostcardForHome(template, home, render, {
      priceFormatted: formatPrice(render?.estimated_total || 4500),
      quoteUrl: render?.id
        ? buildQuoteUrl(render.id, PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3100}`)
        : 'https://example.com/app/quote/sample',
    });
    res.json({ ok: true, preview: urls, sampleRender: Boolean(render) });
  } catch (err) {
    res.status(500).json({ error: 'preview_failed', detail: String(err.message || err) });
  }
});

export default router;
