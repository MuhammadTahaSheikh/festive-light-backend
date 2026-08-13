import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {
  PORT,
  GOOGLE_MAPS_API_KEY,
  GEMINI_API_KEY,
  CF_ACCOUNT_ID,
  CF_API_TOKEN,
  STRIPE_WEBHOOK_SECRET,
  CORS_ORIGINS,
} from './config/env.js';
import { PUBLIC_DIR, RENDERS_DIR, CLIENT_DIST } from './config/paths.js';
import { activeProvider } from './services/render.js';
import { dbMode } from './db/index.js';
import { migrateSeasonVariantsFileToDb } from './db/seasonVariants.js';
import { handleStripeWebhook } from './services/stripeCheckout.js';
import api from './routes/index.js';

const app = express();

const defaultCorsOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
const allowedOrigins = new Set([...defaultCorsOrigins, ...CORS_ORIGINS]);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  let allow = false;
  if (origin) {
    if (allowedOrigins.has(origin)) allow = true;
    else {
      try {
        allow = /\.vercel\.app$/i.test(new URL(origin).hostname);
      } catch {
        allow = false;
      }
    }
  }
  if (allow) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, X-Account-Email, Authorization, Stripe-Signature',
    );
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
});

app.post(
  '/api/credits/stripe-webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    if (!STRIPE_WEBHOOK_SECRET) {
      return res.status(400).send('Webhook secret not configured');
    }
    try {
      const sig = req.headers['stripe-signature'];
      await handleStripeWebhook(req.body, sig);
      res.json({ received: true });
    } catch (err) {
      console.error('[stripe webhook]', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  },
);

app.use(express.json({ limit: '12mb' }));

// Rendered images live in public/renders and are referenced as /renders/*.
app.use('/renders', express.static(RENDERS_DIR));
// Generated postcard PDFs for Lob / preview.
app.use('/mail', express.static(path.join(PUBLIC_DIR, 'mail')));
// The ORIGINAL marketing site (landing + render widget) stays at the root.
app.use(express.static(PUBLIC_DIR));
// The React dashboard app is mounted under /app (built to client/dist with a
// matching Vite base of '/app/'). In dev, Vite serves it on :5173 instead.
if (fs.existsSync(CLIENT_DIST)) {
  app.use('/app', express.static(CLIENT_DIST));
}

app.use('/api', api);

// SPA fallback for the dashboard: any /app/* route serves the React index.html
// (client-side routing). The original site at / is untouched.
if (fs.existsSync(CLIENT_DIST)) {
  app.get(['/app', '/app/*'], (_req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`\n  Festive Lighting Pros running at http://localhost:${PORT}`);
  console.log(`  Maps key:   ${GOOGLE_MAPS_API_KEY ? 'set' : 'MISSING'}`);
  console.log(`  Render:     ${activeProvider()} (gemini:${GEMINI_API_KEY ? 'set' : 'no'}, cloudflare:${CF_ACCOUNT_ID && CF_API_TOKEN ? 'set' : 'no'})`);
  console.log(`  Database:   ${dbMode === 'supabase' ? 'Supabase (Postgres)' : 'JSON file (add Supabase keys for a real DB)'}\n`);
  migrateSeasonVariantsFileToDb().catch(() => {});
});
