import { Router } from 'express';
import {
  getCampaign,
  listCampaignHomes,
  findCampaignHomeByRenderId,
  updateCampaignHome,
} from '../db/campaigns.js';
import { getPostcardTemplate } from '../db/postcardTemplates.js';
import { getRender, listRenders } from '../db/renders.js';
import { buildPostcardForHome } from '../services/postcardPdf.js';
import {
  formatPrice,
  buildQuoteUrl,
} from '../services/postcardMerge.js';
import {
  sendPostcardViaLob,
  sendPostcardDemo,
  estimateMailCost,
  lobEnabled,
  verifyAddressForMail,
  shouldVerifyWithLob,
  mailConfigStatus,
} from '../services/lob.js';
import { LOB_MAIL_MODE, PUBLIC_BASE_URL } from '../config/env.js';
import { resolveQuotePricing } from '../services/pricing.js';

const router = Router();

function accountKey(req) {
  return req.headers['x-account-email'] || req.body?.accountEmail || 'default';
}

function filterMailableHomes(homes, { homeIds = [], unmailedOnly = false, liveOnly = false } = {}) {
  let list = homes.filter((h) => {
    if (!h.render_id) return false;
    if (h.status === 'rendered') return true;
    // Legacy rows: demo preview used to bump status to quote_sent.
    if (!liveOnly && h.status === 'quote_sent' && h.mail_status === 'mail_demo') return true;
    return false;
  });
  if (homeIds.length) {
    const set = new Set(homeIds);
    list = list.filter((h) => set.has(h.id));
  }
  if (liveOnly) {
    list = list.filter((h) => !h.mail_status);
  } else if (unmailedOnly) {
    list = list.filter((h) => h.mail_status !== 'sent');
  }
  return list;
}

function pseudoHomeFromRender(render, extras = {}) {
  return {
    id: render.id,
    address: render.address || 'Uploaded photo',
    estimated_total: render.estimated_total,
    owner_name: extras.owner_name || extras.ownerName || null,
    lat: extras.lat ?? render.lat ?? null,
    lng: extras.lng ?? render.lng ?? null,
  };
}

function templateCanShowHouseOnFront(template) {
  return Boolean(template?.front?.elements?.some(
    (el) => el.type === 'render' || (el.type === 'image' && (el.src || el.url)),
  ));
}

async function verifyAddresses(items, idKey = 'homeId') {
  const results = [];
  let mailable = 0;
  let blocked = 0;

  for (const item of items) {
    const verification = await verifyAddressForMail(item.address, {
      lat: item.lat,
      lng: item.lng,
    });
    if (verification.ok) mailable++;
    else blocked++;
    results.push({
      [idKey]: item.id,
      renderId: item.renderId || item.id,
      address: item.address,
      ok: verification.ok,
      deliverability: verification.deliverability,
      message: verification.message,
      warning: verification.warning,
      source: verification.source,
      standardized: verification.standardized || null,
    });
  }

  return { results, mailable, blocked, total: items.length, lobVerify: shouldVerifyWithLob() };
}

async function markAddressInvalid(home, verification) {
  try {
    await updateCampaignHome(home.id, {
      mail_status: 'address_invalid',
      notes: `verify:${verification.deliverability}`,
    });
  } catch {
    try {
      await updateCampaignHome(home.id, { notes: `verify:${verification.deliverability}` });
    } catch {
      /* ignore */
    }
  }
}

async function sendOnePostcard({
  render,
  template,
  base,
  useLob,
  skipVerify,
  description,
  onSent,
  home: campaignHome = null,
}) {
  const address = campaignHome?.address || render.address || '';
  const ownerName = campaignHome?.owner_name || '';

  if (!templateCanShowHouseOnFront(template)) {
    return {
      renderId: render.id,
      address,
      ok: false,
      error: 'template_missing_render_slot',
      message: 'Selected postcard template needs a Render element or a front image to replace with the house.',
    };
  }

  if (!render.image_url) {
    return {
      renderId: render.id,
      address,
      ok: false,
      error: 'no_render_image',
      message: 'This quote has no render image — cannot mail a postcard.',
    };
  }

  let to;
  const mailAddress = campaignHome?.address || render.address || address;
  if (!skipVerify && useLob) {
    const verification = await verifyAddressForMail(mailAddress, {
      lat: campaignHome?.lat ?? render.lat ?? null,
      lng: campaignHome?.lng ?? render.lng ?? null,
    });
    if (!verification.ok) {
      return {
        renderId: render.id,
        address,
        ok: false,
        error: 'undeliverable_address',
        deliverability: verification.deliverability,
        message: verification.message,
        source: verification.source,
      };
    }
    to = verification.to;
  }

  const home = campaignHome
    ? { ...campaignHome, address: campaignHome.address || address }
    : pseudoHomeFromRender(render, { owner_name: ownerName });
  const pricing = resolveQuotePricing(render);
  const { urls } = await buildPostcardForHome(template, home, render, {
    quoteUrl: buildQuoteUrl(render.id, base),
    priceFormatted: formatPrice(pricing.frontPrice),
    ownerName,
  });
  if (!to) {
    to = (await verifyAddressForMail(address, {
      lat: campaignHome?.lat ?? render.lat ?? null,
      lng: campaignHome?.lng ?? render.lng ?? null,
    })).to;
  }
  if (ownerName) {
    to = { ...to, name: ownerName };
  }

  const lobResult = useLob
    ? await sendPostcardViaLob({
        to,
        frontUrl: urls.frontUrl,
        backUrl: urls.backUrl,
        description: description || home.address,
      })
    : await sendPostcardDemo({ homeId: render.id });

  if (onSent) await onSent(lobResult);

  return {
    renderId: render.id,
    address,
    ok: true,
    lobId: lobResult.id,
    demo: !useLob,
    preview: urls,
    mailedTo: to,
    ownerName: ownerName || null,
  };
}

async function loadRendersByIds(renderIds) {
  if (!renderIds?.length) {
    const all = await listRenders(500);
    return all.filter((r) => r.image_url);
  }
  const renders = [];
  for (const id of renderIds) {
    const r = await getRender(id);
    if (r) renders.push(r);
  }
  return renders;
}

router.get('/status', (_req, res) => {
  res.json({ ok: true, ...mailConfigStatus() });
});

router.post('/estimate', (req, res) => {
  const { count = 0 } = req.body || {};
  res.json({
    ok: true,
    ...estimateMailCost(count),
    lobEnabled: lobEnabled(),
    lobVerify: shouldVerifyWithLob(),
    mode: LOB_MAIL_MODE,
  });
});

/** Verify addresses for existing quotes/renders (no campaign required). */
router.post('/renders/verify-addresses', async (req, res) => {
  const { renderIds = [] } = req.body || {};
  try {
    const renders = await loadRendersByIds(renderIds);
    if (!renders.length) {
      return res.status(400).json({
        error: 'no_quotes',
        detail: 'No quotes with render images found.',
      });
    }
    const items = renders.map((r) => ({
      id: r.id,
      renderId: r.id,
      address: r.address || '',
    }));
    const summary = await verifyAddresses(items, 'renderId');
    res.json({ ok: true, ...summary });
  } catch (err) {
    res.status(500).json({ error: 'verify_failed', detail: String(err.message || err) });
  }
});

/** Send postcards for existing quotes/renders (Quotes page, widget renders, etc.). */
router.post('/renders/send', async (req, res) => {
  const { templateId = '', renderIds = [], demoConfirm = false, skipVerify = false } = req.body || {};
  if (!templateId) return res.status(400).json({ error: 'missing_template_id' });

  try {
    const template = await getPostcardTemplate(templateId, accountKey(req));
    if (!template) return res.status(404).json({ error: 'template_not_found' });

    const renders = await loadRendersByIds(renderIds);
    if (!renders.length) {
      return res.status(400).json({
        error: 'no_quotes',
        detail: 'No quotes with render images to mail.',
      });
    }

    const useLob = lobEnabled() && LOB_MAIL_MODE === 'live' && !demoConfirm;
    const base = PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3100}`;
    const results = [];
    let sent = 0;
    let failed = 0;
    let skippedAddress = 0;

    for (const render of renders) {
      try {
        // Reuse owner_name already stored on the linked Outreach home (no owner-API call).
        const campaignHome = await findCampaignHomeByRenderId(render.id);
        const result = await sendOnePostcard({
          render,
          template,
          base,
          useLob,
          skipVerify,
          description: `Quote — ${render.address || render.id}`,
          home: campaignHome,
        });
        if (result.ok) {
          sent++;
        } else {
          failed++;
          if (result.error === 'undeliverable_address') skippedAddress++;
        }
        results.push(result);
      } catch (e) {
        failed++;
        results.push({
          renderId: render.id,
          address: render.address,
          ok: false,
          error: String(e.message || e),
        });
      }
    }

    res.json({
      ok: true,
      sent,
      failed,
      skippedAddress,
      total: renders.length,
      demo: !useLob,
      lobVerify: shouldVerifyWithLob(),
      cost: estimateMailCost(sent),
      results,
    });
  } catch (err) {
    res.status(500).json({ error: 'mail_failed', detail: String(err.message || err) });
  }
});

router.post('/campaigns/:id/verify-addresses', async (req, res) => {
  const { homeIds = [], unmailedOnly = true } = req.body || {};
  try {
    const campaign = await getCampaign(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'campaign_not_found' });

    const homes = filterMailableHomes(await listCampaignHomes(req.params.id), { homeIds, unmailedOnly });
    if (!homes.length) {
      return res.status(400).json({
        error: 'no_mailable_homes',
        detail: 'No rendered homes to verify. Make quotes first.',
      });
    }

    const items = homes.map((h) => ({
      id: h.id,
      address: h.address,
      lat: h.lat,
      lng: h.lng,
    }));
    const summary = await verifyAddresses(items, 'homeId');
    res.json({ ok: true, ...summary });
  } catch (err) {
    res.status(500).json({ error: 'verify_failed', detail: String(err.message || err) });
  }
});

router.post('/campaigns/:id/reset-mail', async (req, res) => {
  try {
    const campaign = await getCampaign(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'campaign_not_found' });

    const homes = await listCampaignHomes(req.params.id);
    let reset = 0;
    for (const home of homes) {
      const mailed = home.mail_status || home.status === 'quote_sent';
      if (!mailed) continue;
      const statusPatch = home.render_id && home.status === 'quote_sent'
        ? { status: 'rendered' }
        : {};
      const fullPatch = {
        ...statusPatch,
        mail_status: null,
        lob_postcard_id: null,
        mail_template_id: null,
        mailed_at: null,
      };
      try {
        await updateCampaignHome(home.id, fullPatch);
      } catch {
        if (statusPatch.status) await updateCampaignHome(home.id, statusPatch);
      }
      reset++;
    }
    res.json({ ok: true, reset });
  } catch (err) {
    res.status(500).json({ error: 'reset_failed', detail: String(err.message || err) });
  }
});

router.post('/campaigns/:id/send', async (req, res) => {
  const { templateId = '', homeIds = [], demoConfirm = false, skipVerify = false } = req.body || {};
  if (!templateId) return res.status(400).json({ error: 'missing_template_id' });

  try {
    const campaign = await getCampaign(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'campaign_not_found' });

    const template = await getPostcardTemplate(templateId, accountKey(req));
    if (!template) return res.status(404).json({ error: 'template_not_found' });

    const useLob = lobEnabled() && LOB_MAIL_MODE === 'live' && !demoConfirm;
    const homes = filterMailableHomes(await listCampaignHomes(req.params.id), { homeIds, liveOnly: useLob });
    if (!homes.length) {
      return res.status(400).json({
        error: 'no_mailable_homes',
        detail: 'Load houses, make quotes first — only rendered homes can be mailed.',
      });
    }

    const base = PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3100}`;
    const results = [];
    let sent = 0;
    let failed = 0;
    let skippedAddress = 0;

    for (const home of homes) {
      const render = await getRender(home.render_id);
      if (!render) {
        failed++;
        results.push({ homeId: home.id, address: home.address, ok: false, error: 'render_not_found' });
        continue;
      }

      try {
        let to;
        if (!skipVerify) {
          const verification = await verifyAddressForMail(home.address);
          if (!verification.ok) {
            skippedAddress++;
            failed++;
            await markAddressInvalid(home, verification);
            results.push({
              homeId: home.id,
              renderId: render.id,
              address: home.address,
              ok: false,
              error: 'undeliverable_address',
              deliverability: verification.deliverability,
              message: verification.message,
              source: verification.source,
            });
            continue;
          }
          to = verification.to;
        }

        if (to && home.owner_name) {
          to = { ...to, name: home.owner_name };
        }

        const result = await sendOnePostcard({
          render,
          template,
          base,
          useLob,
          skipVerify: true,
          home,
          description: `${campaign.name} — ${home.address}`,
          onSent: async (lobResult) => {
            const patch = {
              mail_status: useLob ? 'sent' : 'mail_demo',
              lob_postcard_id: lobResult.id,
              mail_template_id: templateId,
              mailed_at: new Date().toISOString(),
            };
            if (useLob && home.status === 'rendered') {
              patch.status = 'quote_sent';
            }
            try {
              await updateCampaignHome(home.id, patch);
            } catch {
              try {
                const fallback = { notes: `mailed:${lobResult.id}` };
                if (useLob && home.status === 'rendered') fallback.status = 'quote_sent';
                await updateCampaignHome(home.id, fallback);
              } catch {
                /* ignore */
              }
            }
          },
        });

        if (result.ok) {
          sent++;
          results.push({ homeId: home.id, ...result, mailedTo: to || result.mailedTo });
        } else {
          failed++;
          if (result.error === 'undeliverable_address') skippedAddress++;
          results.push({ homeId: home.id, ...result });
        }
      } catch (e) {
        failed++;
        results.push({ homeId: home.id, address: home.address, ok: false, error: String(e.message || e) });
      }
    }

    res.json({
      ok: true,
      sent,
      failed,
      skippedAddress,
      total: homes.length,
      demo: !useLob,
      lobVerify: shouldVerifyWithLob(),
      cost: estimateMailCost(sent),
      results,
    });
  } catch (err) {
    res.status(500).json({ error: 'mail_failed', detail: String(err.message || err) });
  }
});

export default router;
