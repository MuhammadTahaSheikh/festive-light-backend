import { Router } from 'express';
import {
  saveCampaign,
  listCampaigns,
  getCampaign,
  addCampaignHome,
  bulkAddCampaignHomes,
  updateCampaign,
  listCampaignHomes,
  updateCampaignHome,
} from '../db/index.js';
import { campaignStats } from '../services/pricing.js';
import { ownerLookupEnabled, ownerLookupStatus, lookupOwnersByAddress } from '../services/ownerLookup.js';
import { createdByFromReq } from '../util/createdBy.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    res.json({ ok: true, campaigns: await listCampaigns() });
  } catch (err) {
    res.status(500).json({ error: 'campaigns_failed', detail: String(err.message || err) });
  }
});

router.post('/', async (req, res) => {
  const { name = '', area = '', notes = '' } = req.body || {};
  if (!name.trim()) return res.status(400).json({ error: 'missing_name' });
  try {
    res.json({
      ok: true,
      campaign: await saveCampaign({
        name: name.trim(),
        area: area.trim(),
        notes,
        created_by: createdByFromReq(req),
      }),
    });
  } catch (err) {
    res.status(500).json({ error: 'campaign_failed', detail: String(err.message || err) });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const campaign = await updateCampaign(req.params.id, req.body || {});
    if (!campaign) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true, campaign });
  } catch (err) {
    res.status(500).json({ error: 'campaign_failed', detail: String(err.message || err) });
  }
});

router.post('/:id/homes/bulk', async (req, res) => {
  const { homes = [] } = req.body || {};
  if (!Array.isArray(homes) || !homes.length) {
    return res.status(400).json({ error: 'missing_homes' });
  }
  try {
    const campaign = await getCampaign(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'not_found' });
    const result = await bulkAddCampaignHomes(req.params.id, homes, createdByFromReq(req));
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: 'bulk_failed', detail: String(err.message || err) });
  }
});

/**
 * Dynamically look up property owner names for campaign homes.
 * Provider: ATTOM (default), AssessorSearch, or BatchData — see OWNER_LOOKUP_PROVIDER in .env
 * Body: { homeIds?: string[], onlyMissing?: boolean }
 */
router.post('/:id/homes/enrich-owners', async (req, res) => {
  const { homeIds = [], onlyMissing = true } = req.body || {};
  if (!ownerLookupEnabled()) {
    const status = ownerLookupStatus();
    return res.status(503).json({
      error: 'owner_lookup_not_configured',
      detail: 'Add ATTOM_API_KEY to .env (free trial at https://api.developer.attomdata.com), then restart the server.',
      ...status,
    });
  }

  try {
    const campaign = await getCampaign(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'not_found' });

    let homes = await listCampaignHomes(req.params.id);
    if (Array.isArray(homeIds) && homeIds.length) {
      const set = new Set(homeIds);
      homes = homes.filter((h) => set.has(h.id));
    }
    if (onlyMissing !== false) {
      homes = homes.filter((h) => !String(h.owner_name || '').trim());
    }
    if (!homes.length) {
      return res.json({
        ok: true,
        matched: 0,
        updated: 0,
        total: 0,
        skipped: 0,
        message: 'No homes need owner enrichment.',
        ...ownerLookupStatus(),
        results: [],
      });
    }

    const lookups = await lookupOwnersByAddress(homes);

    const results = [];
    let matched = 0;
    let updated = 0;

    for (const row of lookups) {
      if (row.matched) matched++;
      if (row.homeId && row.matched) {
        const saved = await updateCampaignHome(row.homeId, { owner_name: row.owner_name });
        if (saved) updated++;
      }
      results.push({
        homeId: row.homeId,
        address: row.address,
        matched: row.matched,
        owner_name: row.owner_name,
      });
    }

    res.json({
      ok: true,
      matched,
      updated,
      total: homes.length,
      skipped: homes.length - matched,
      ...ownerLookupStatus(),
      results,
    });
  } catch (err) {
    const status = err.code === 'owner_lookup_not_configured' || err.code === 'attom_not_configured' || err.code === 'assessorsearch_not_configured' ? 503 : 500;
    res.status(status).json({
      error: err.code || 'enrich_failed',
      detail: String(err.message || err),
      ...(err.detail ? { provider: err.detail } : {}),
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const campaign = await getCampaign(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'not_found' });
    const homes = await listCampaignHomes(req.params.id);
    res.json({
      ok: true,
      campaign,
      homes,
      stats: campaignStats(homes),
      ownerEnrichment: ownerLookupStatus(),
    });
  } catch (err) {
    res.status(500).json({ error: 'campaign_failed', detail: String(err.message || err) });
  }
});

router.post('/:id/homes', async (req, res) => {
  const {
    address = '', lat = null, lng = null, place_id = '',
    estimated_total = null, owner_name = '', owner_phone = '', owner_email = '',
  } = req.body || {};
  if (!address.trim()) return res.status(400).json({ error: 'missing_address' });
  try {
    const home = await addCampaignHome({
      campaign_id: req.params.id,
      address: address.trim(),
      lat, lng, place_id,
      estimated_total,
      owner_name, owner_phone, owner_email,
      created_by: createdByFromReq(req),
    });
    res.json({ ok: true, home });
  } catch (err) {
    res.status(500).json({ error: 'home_failed', detail: String(err.message || err) });
  }
});

router.patch('/homes/:homeId', async (req, res) => {
  try {
    const home = await updateCampaignHome(req.params.homeId, req.body || {});
    if (!home) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true, home });
  } catch (err) {
    res.status(500).json({ error: 'home_failed', detail: String(err.message || err) });
  }
});

export default router;
