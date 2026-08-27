import { Router } from 'express';
import { saveLead, listLeads, getRender } from '../db/index.js';
import { createdByFromReq } from '../util/createdBy.js';
import { resolveQuotePricing } from '../services/pricing.js';
import { sendBookConsultationWebhook } from '../services/leadconnector.js';

export const leadRouter = Router();
export const leadsRouter = Router();

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function consultationFields(body = {}) {
  let footage = toNum(body.footage);
  let estimate = toNum(body.estimate);
  let extraFootage = toNum(body.extraFootage) ?? 0;
  let extraPrice = toNum(body.extraPrice);
  let pricePerFoot = toNum(body.pricePerFoot);
  let imageUrl = body.imageUrl || '';
  let address = body.address || '';
  const quoteId = body.quoteId || null;

  if (quoteId) {
    try {
      const render = await getRender(quoteId);
      if (render) {
        const pricing = resolveQuotePricing(render);
        address = address || render.address || '';
        imageUrl = imageUrl || render.image_url || '';
        if (footage == null) footage = pricing.frontFeet;
        if (estimate == null) estimate = pricing.frontPrice;
        if (pricePerFoot == null) pricePerFoot = pricing.pricePerFoot;
      }
    } catch (e) {
      console.warn('[lead] quote lookup failed:', e.message);
    }
  }

  return {
    footage: footage ?? 0,
    estimate: estimate ?? 0,
    extraFootage: extraFootage ?? 0,
    extraPrice: extraPrice ?? 0,
    pricePerFoot: pricePerFoot ?? 0,
    imageUrl,
    address,
    quoteId,
  };
}

leadRouter.post('/', async (req, res) => {
  const body = req.body || {};
  const {
    name = '',
    email = '',
    phone = '',
    address = '',
    source = 'widget',
    notes = '',
    event = '',
  } = body;
  if (!email && !phone) return res.status(400).json({ error: 'missing_contact' });
  try {
    await saveLead({
      name, email, phone, address, source, notes,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || null,
      created_by: createdByFromReq(req),
    });

    const isBook = event === 'book_consultation'
      || source === 'book_consultation'
      || source === 'book_call'
      || source === 'quote_page';
    if (isBook) {
      const fields = await consultationFields(body);
      try {
        await sendBookConsultationWebhook({
          name,
          email,
          phone,
          ...fields,
          address: fields.address || address,
        });
      } catch (e) {
        console.warn('[leadconnector]', e.message);
      }
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'lead_failed', detail: String(err.message || err) });
  }
});

leadsRouter.get('/', async (_req, res) => {
  try {
    res.json({ ok: true, leads: await listLeads() });
  } catch (err) {
    res.status(500).json({ error: 'leads_failed', detail: String(err.message || err) });
  }
});
