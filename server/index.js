import dns from 'node:dns';
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

// Prefer IPv4 — broken IPv6 on some Windows networks causes Google Maps
// "fetch failed" / ECONNRESET from Node (Places, Geocoding, Street View).
dns.setDefaultResultOrder('ipv4first');

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
app.use('/mail', express.static(path.join(PUBLIC_DIR, 'mail'), {
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store');
  },
}));
// The ORIGINAL marketing site (landing + render widget) stays at the root.
app.use(express.static(PUBLIC_DIR));
// The React dashboard app is mounted under /app (Vite base '/app/').
// A normal build writes the SPA at client/dist. The Vercel assembler
// (`build:vercel`) nests it at client/dist/app and puts the marketing
// page at client/dist/index.html. Serve whichever layout is present so
// /app never falls through to that marketing page.
function dashboardDist() {
  const nested = path.join(CLIENT_DIST, 'app');
  if (fs.existsSync(path.join(nested, 'index.html'))) return nested;
  if (fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) return CLIENT_DIST;
  return null;
}

const DASHBOARD_DIST = dashboardDist();
if (DASHBOARD_DIST) {
  app.use('/app', express.static(DASHBOARD_DIST));
}

app.use('/api', api);

// SPA fallback for the dashboard: any /app/* route serves the React index.html
// (client-side routing). The original site at / is untouched.
if (DASHBOARD_DIST) {
  app.get(['/app', '/app/*'], (_req, res) => {
    res.sendFile(path.join(DASHBOARD_DIST, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`\n  Festive Lighting Pros running at http://localhost:${PORT}`);
  console.log(`  Maps key:   ${GOOGLE_MAPS_API_KEY ? 'set' : 'MISSING'}`);
  console.log(`  Render:     ${activeProvider()} (gemini:${GEMINI_API_KEY ? 'set' : 'no'}, cloudflare:${CF_ACCOUNT_ID && CF_API_TOKEN ? 'set' : 'no'})`);
  console.log(`  Database:   ${dbMode === 'supabase' ? 'Supabase (Postgres)' : 'JSON file (add Supabase keys for a real DB)'}\n`);
  migrateSeasonVariantsFileToDb().catch(() => {});
});
