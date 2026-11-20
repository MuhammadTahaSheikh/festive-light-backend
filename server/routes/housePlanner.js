import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { RENDERS_DIR } from '../config/paths.js';
import {
  buildHousePlannerHtmlEmail,
  imageDataUri,
  isLeadConnectorConfigured,
  sendBookConsultationWebhook,
} from '../services/leadconnector.js';

const router = Router();

/**
 * Save a House Light Planner export and send it through GHL / LeadConnector
 * (same webhook path as consultation emails — not SMTP).
 *
 * Body: { email, address?, name?, imageBase64, totalFeet? }
 */
router.post('/email', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim();
    const address = String(req.body?.address || '').trim();
    const name = String(req.body?.name || '').trim();
    const imageBase64 = String(req.body?.imageBase64 || '');
    const totalFeet = Number(req.body?.totalFeet);

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: 'invalid_email' });
    }
    if (!imageBase64) {
      return res.status(400).json({ error: 'missing_image' });
    }
    if (!isLeadConnectorConfigured()) {
      return res.status(503).json({
        error: 'ghl_not_configured',
        detail: 'LeadConnector / GHL webhook is not configured.',
      });
    }

    const m = imageBase64.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
    const ext = m ? (m[1].includes('jpeg') || m[1].includes('jpg') ? 'jpg' : 'png') : 'png';
    const buf = Buffer.from(m ? m[2] : imageBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (!buf.length) {
      return res.status(400).json({ error: 'invalid_image' });
    }

    if (!fs.existsSync(RENDERS_DIR)) fs.mkdirSync(RENDERS_DIR, { recursive: true });
    const filename = `planner-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const full = path.join(RENDERS_DIR, filename);
    fs.writeFileSync(full, buf);
    const imageUrl = `/renders/${filename}`;

    // Embed image bytes in HTML — PUBLIC_BASE_URL is the Vercel frontend and
    // does not host /renders files, so a remote <img src> would stay broken.
    const embedded = await imageDataUri(imageUrl);
    const footage = Number.isFinite(totalFeet) && totalFeet > 0 ? totalFeet : 0;
    const htmlEmail = buildHousePlannerHtmlEmail({
      name,
      address,
      imageUrl,
      imageSrc: embedded,
      footage,
    });

    const result = await sendBookConsultationWebhook({
      name,
      email,
      address,
      footage,
      imageUrl,
      image: embedded,
      htmlEmail,
    });

    if (result?.skipped) {
      return res.status(503).json({ error: 'ghl_skipped', detail: result.reason || 'skipped' });
    }

    res.json({ ok: true, imageUrl, via: 'ghl' });
  } catch (err) {
    console.error('[house-planner/email]', err);
    res.status(500).json({ error: 'email_failed', detail: String(err.message || err) });
  }
});

export default router;
