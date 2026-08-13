import { Router } from 'express';
import { saveLead, listLeads } from '../db/index.js';
import { createdByFromReq } from '../util/createdBy.js';

export const leadRouter = Router();
export const leadsRouter = Router();

leadRouter.post('/', async (req, res) => {
  const { name = '', email = '', phone = '', address = '', source = 'widget', notes = '' } = req.body || {};
  if (!email && !phone) return res.status(400).json({ error: 'missing_contact' });
  try {
    await saveLead({
      name, email, phone, address, source, notes,
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || null,
      created_by: createdByFromReq(req),
    });
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
