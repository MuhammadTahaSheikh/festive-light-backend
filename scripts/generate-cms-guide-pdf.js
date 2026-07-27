// Generates the Festive Lighting Pros CMS & platform guide PDF.
// Run: node scripts/generate-cms-guide-pdf.js
import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'docs');
const OUT_FILE = path.join(OUT_DIR, 'Festive-Lighting-Pros-CMS-Guide.pdf');
fs.mkdirSync(OUT_DIR, { recursive: true });

const C = {
  ink: '#1c1c1c',
  sub: '#5c5c5c',
  gold: '#b8860b',
  line: '#e2e2e2',
  band: '#141414',
  bandText: '#f5c842',
};

const M = 50;
const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true });
doc.pipe(fs.createWriteStream(OUT_FILE));

const PAGE_W = doc.page.width;
const CONTENT_W = PAGE_W - M * 2;

function ensureSpace(h) {
  if (doc.y + h > doc.page.height - M) doc.addPage();
}

function h1(text) {
  ensureSpace(36);
  doc.moveDown(0.5);
  doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(18).text(text);
  doc.moveDown(0.3);
}

function h2(text) {
  ensureSpace(40);
  doc.moveDown(0.5);
  const y = doc.y;
  doc.save().rect(M, y, 4, 14).fill(C.gold).restore();
  doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(13).text(text, M + 10, y);
  doc.moveTo(M, doc.y + 4).lineTo(M + CONTENT_W, doc.y + 4).strokeColor(C.line).lineWidth(0.8).stroke();
  doc.moveDown(0.55);
}

function h3(text) {
  ensureSpace(24);
  doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(11).text(text);
  doc.moveDown(0.25);
}

function para(text, opts = {}) {
  doc.fillColor(opts.color || C.sub).font(opts.font || 'Helvetica').fontSize(opts.size || 10)
    .text(text, { align: opts.align || 'left', lineGap: 2.5, width: CONTENT_W });
  doc.moveDown(0.35);
}

function bullet(title, desc) {
  ensureSpace(22);
  const x = M + 2;
  const startY = doc.y;
  doc.circle(x + 2, startY + 5, 2).fill(C.gold);
  if (desc) {
    doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(10).text(title, x + 10, startY, { width: CONTENT_W - 12 });
    doc.fillColor(C.sub).font('Helvetica').fontSize(9.5).text(desc, x + 10, doc.y, { width: CONTENT_W - 12, lineGap: 2 });
  } else {
    doc.fillColor(C.ink).font('Helvetica').fontSize(10).text(title, x + 10, startY, { width: CONTENT_W - 12 });
  }
  doc.moveDown(0.3);
}

function numbered(n, title, desc) {
  ensureSpace(26);
  const y = doc.y;
  doc.fillColor(C.gold).font('Helvetica-Bold').fontSize(10).text(String(n) + '.', M, y);
  doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(10).text(title, M + 18, y, { width: CONTENT_W - 18 });
  if (desc) {
    doc.fillColor(C.sub).font('Helvetica').fontSize(9.5).text(desc, M + 18, doc.y, { width: CONTENT_W - 18, lineGap: 2 });
  }
  doc.moveDown(0.35);
}

// ── Cover ─────────────────────────────────────────────────────────────────
doc.rect(0, 0, PAGE_W, 120).fill(C.band);
doc.fillColor(C.bandText).font('Helvetica-Bold').fontSize(10).text('FESTIVE LIGHTING PROS', M, 28, { characterSpacing: 1.5 });
doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text('Platform & CMS Guide', M, 48);
doc.fillColor('#9a9a9a').font('Helvetica').fontSize(9)
  .text('How every component works  •  Dashboard, outreach, mail, quotes & billing', M, 78);
doc.fillColor(C.sub).font('Helvetica').fontSize(8.5).text(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, M, 98);

doc.y = 138;
para('This document describes the full Festive Lighting Pros platform as built today: the marketing site, installer dashboard (CMS), AI render pipeline, campaign outreach, postcard direct mail, credit billing, and homeowner quote experience. Modeled on lightlaunch.ai with unique Season Switch and Block Wave features.', { size: 10, color: C.ink });

// ── 1. Architecture ───────────────────────────────────────────────────────
h2('1. System architecture');

para('The app runs as a single Node.js server (default port 3100) serving three layers:');

bullet('Marketing site (root /)', 'Static landing page + AI render widget at public/index.html');
bullet('Installer dashboard (/app/*)', 'React SPA (Vite build in client/dist) — the CMS');
bullet('REST API (/api/*)', 'Express routes for renders, campaigns, mail, credits, templates');

h3('Tech stack');
bullet('Frontend', 'React 18, React Router, Vite — mobile-responsive dashboard');
bullet('Backend', 'Express.js, PDFKit (postcards), QRCode, Lob API (direct mail)');
bullet('AI render', 'Google Gemini image model (primary) or Cloudflare Workers AI (fallback)');
bullet('Maps', 'Google Places, Geocoding, Street View — OSM Photon fallback for autocomplete');
bullet('Database', 'Supabase Postgres when configured; JSON files in data/ as fallback');
bullet('Storage', 'public/renders/ (AI images), public/mail/ (postcard PDFs), data/*.json');

h3('Key URLs (local dev)');
bullet('http://localhost:3100/', 'Marketing landing + free render widget');
bullet('http://localhost:3100/app/', 'Installer dashboard (login required)');
bullet('http://localhost:3100/app/quote/{render-id}', 'Public homeowner quote page (QR destination)');
bullet('http://localhost:3100/mail/{render-id}-front.pdf', 'Generated postcard PDF preview');

// ── 2. Public marketing site ──────────────────────────────────────────────
h2('2. Public marketing site');

h3('Landing page (public/index.html)');
para('Branded Festive Lighting Pros homepage with services, testimonials, and the signature “See your home lit up” widget. Separate from the dashboard — homeowners do not need an account.');

h3('AI render widget (public/demo-widget.js + /image-render)');
numbered(1, 'Address or photo', 'Homeowner types an address (Google autocomplete) or uploads a photo of their house.');
numbered(2, 'Street View / upload', 'Server fetches Google Street View image or uses uploaded photo as source.');
numbered(3, 'AI lighting render', 'Gemini (or Cloudflare) adds permanent roofline C9-style LED lighting in chosen colors at dusk.');
numbered(4, 'Instant estimate', 'Roofline feet estimated from building footprint; price = feet × $/ft (default $40/ft on widget).');
numbered(5, 'Lead capture', 'Optional name/email/phone saved via POST /api/lead → appears in Dashboard → Leads.');

para('Free render limit: MAX_FREE_RENDERS in .env (default 3 per browser, client-side counter). Widget renders do NOT consume installer credits.');

// ── 3. Authentication ─────────────────────────────────────────────────────
h2('3. Authentication & access');

bullet('/app/login', 'Email/password login via Supabase Auth (when configured) or demo auth');
bullet('Protected routes', 'All /app/* dashboard pages require login — Protected wrapper in App.jsx');
bullet('Account scoping', 'X-Account-Email header on API calls scopes credits, templates, and campaigns per installer email');
bullet('Sidebar credits', 'Live credit balance + Buy Credits button always visible when logged in');

// ── 4. Dashboard navigation ───────────────────────────────────────────────
h2('4. Dashboard (CMS) — navigation map');

h3('Daily');
bullet('Overview (/)', 'Stats: leads count, renders, quoted pipeline value, mini chart. Link to create campaigns.');
bullet('Outreach (/campaigns)', 'Campaign list — create and open neighborhood mail campaigns.');
bullet('Leads (/leads)', 'Table of all captured leads (widget, quote page, etc.) with name, email, phone, address, source.');
bullet('Portal (/portal)', 'Preview what homeowners see — select a render, view quote page + QR code.');

h3('Sales');
bullet('Quotes (/quotes)', 'All AI renders with address, estimated total, mail-one-quote flow, PDF preview links.');
bullet('Jobs (/jobs)', 'Kanban placeholder: Lead → Quoted → Scheduled → Installed (pipeline UI, awaiting full CRM wiring).');
bullet('Schedule (/schedule)', 'Calendar placeholder for install scheduling.');
bullet('Templates (/templates)', 'Postcard template gallery — starter layouts + custom templates; opens visual editor.');

h3('Account');
bullet('Settings (/settings)', 'Company profile and preferences placeholder.');
bullet('Billing (/billing)', 'Credit wallet balance, pricing tiers, transaction history, Buy Credits modal.');

// ── 5. Campaign outreach (core workflow) ──────────────────────────────────
h2('5. Campaign outreach — full workflow');

para('Campaigns are the primary installer workflow for mailing a whole block or neighborhood. Path: Outreach → open campaign → Campaign Detail page.');

h3('5.1 Load houses');
bullet('Map search', 'Address autocomplete centers the Google Map.');
bullet('Rectangle / Lasso tools', 'Draw on satellite map to select an area; server discovers addresses inside polygon.');
bullet('Find neighbors', 'From a seed address, find 250 / 500 / 1000 closest neighbors.');
bullet('Import CSV', 'Upload CSV — first column = address, one per line.');
bullet('Load into campaign', 'Discovered addresses bulk-added to campaign_homes (duplicates skipped).');

h3('5.2 Render options (left sidebar)');
bullet('Light color', 'Warm white, Cool white, July 4th, St. Patrick\'s, Christmas, Halloween, Custom');
bullet('Landscape lighting', 'Optional checkbox to include landscape lighting in AI prompt');
bullet('Holiday decor', 'Optional wreath/garland decor overlay');
bullet('Price per linear foot ($)', 'REQUIRED before Make Quotes — e.g. $40. Default saved per campaign via Adjust pricing.');
bullet('Make Quotes', 'Batch AI render: 1 credit per home, concurrency 2. Each home gets unique render_id + estimated_total.');

h3('5.3 Pricing calculation');
para('Front roofline feet ≈ 38% of building footprint perimeter (OSM data) or address-hash fallback (~95–175 ft). Formula: frontPrice = round(feet × $/ft to nearest $10). Whole-house ≈ front × 1.85. Stored on render record and campaign home row.');

h3('5.4 Campaign table');
para('Columns: Address, Est. quote, Status (prospect / rendered / quote_sent), Mail status. Shows pipeline at a glance.');

h3('5.5 Block Wave (unique feature)');
para('Gold banner appears when 2+ homes on the same street already have quotes but others do not — prompts mailing the rest of the block for neighbor momentum.');

h3('5.6 Direct mail panel');
numbered(1, 'Choose template', 'Select postcard layout (must include Render element for per-house photos — not static Image upload).');
numbered(2, 'Check addresses (USPS)', 'Lob address verification when live; format validation in demo mode.');
numbered(3, 'Preview PDFs', 'Generates demo postcard PDFs per home — no postage charged. Shows Open PDF links per address.');
numbered(4, 'Reset mail status', 'Sets homes back to rendered for re-testing after preview.');
numbered(5, 'Send live via Lob', 'When LOB_API_KEY + LOB_MAIL_MODE=live configured — prints and mails real postcards (~$1/piece).');

para('Each mailed home gets: unique AI render on postcard, personalized price ({{price}}), unique QR → private quote page. Demo preview does NOT change status to quote_sent; live Lob mail does.');

// ── 6. Postcard templates ───────────────────────────────────────────────────
h2('6. Postcard template system');

h3('Template gallery (/templates)');
bullet('Starter templates', 'Plain Render, This is YOUR house, Patriotic — built into server (postcardStarters.js)');
bullet('Custom templates', 'Saved per account in data/postcard_templates.json (Supabase table when migrated)');
bullet('Clone / preview / delete', 'Duplicate starters, preview with sample render, delete custom templates');

h3('Visual editor (/templates/:id)');
bullet('6×9 inch canvas', 'Drag-and-drop elements on front and back of postcard');
bullet('Element types', 'Render (🏠 per-house AI photo), Price ({{price}}), Address ({{address}}), QR (dynamic quote URL), Text, Image/Logo, Rectangle');
bullet('Merge tags', '{{price}} = formatted dollar amount; {{feet}} = roofline feet; {{address}} = mailing address');
bullet('Layer order', 'PDF engine draws: photo first → text/price → QR on top (fixes overlapping templates)');

h3('Important template rules');
bullet('Use Render element', 'NOT static Image — static image shows same photo on every postcard');
bullet('Plain Render starter', 'Price + QR on BACK of postcard — open {id}-back.pdf to see price');
bullet('Custom “taha” template', 'Price on front (gold text at top), QR bottom-right, house photo full bleed');

// ── 7. Homeowner quote page ────────────────────────────────────────────────
h2('7. Homeowner quote page (QR destination)');

para('Public URL: /app/quote/{render-id}. No login required. Opened when homeowner scans QR on postcard.');

h3('What homeowners see');
bullet('AI render image', 'Their house with permanent lighting');
bullet('Season Switch (unique vs Light Launch)', '4 buttons: Every night, Christmas, July 4th, Halloween — tap to preview same house in different holiday colors. First view generates via Gemini (~15 sec); cached after.');
bullet('Price hero', 'Large gold price (e.g. $7,200) + roofline feet + $/ft when set at quote time');
bullet('Footage stats', 'Front footage and whole-house footage estimates');
bullet('Request a call form', 'Name, email, phone → saved as lead with source quote_page');

para('Season previews use installer\'s Gemini API cost (platform cost), NOT installer credits. Cached in data/season_variants.json per render.');

// ── 8. Quotes dashboard ─────────────────────────────────────────────────────
h2('8. Quotes page (single-quote mail)');

para('Lists every AI render in the account. Click a row to:');
bullet('View render image + estimated price', '');
bullet('Open quote page + copy QR', '');
bullet('Choose template + Check address', '');
bullet('Preview postcard (demo PDF) or Send live via Lob', 'Same mail pipeline as campaigns, one quote at a time');

// ── 9. Credits & billing ──────────────────────────────────────────────────
h2('9. Credits & billing');

h3('Credit model (Light Launch–style)');
bullet('1 credit ≈ 1 campaign AI render', 'Deducted when Make Quotes runs (campaignHomeId sent to /api/render)');
bullet('Starting balance', '5 free credits per new account (STARTING_CREDITS in .env)');
bullet('Pricing tiers', '$1.00/credit (500–999), $0.95 (2,500+), $0.92 (5,000+), $0.90 (10,000+)');
bullet('Promo codes', 'WELCOME10, SAVE10 — 10% off in Buy Credits modal');
bullet('Demo mode', 'BILLING_MODE=demo — purchases add credits instantly, no Stripe charge');

h3('What credits do NOT cover');
bullet('Widget free renders', 'Homepage widget — separate free limit');
bullet('Season Switch on quote page', 'Platform Gemini cost, free to homeowner');
bullet('Lob mail postage', 'Billed to LOB_API_KEY account (~$0.70–$1.50/piece) — separate from credits');

h3('Buy Credits modal');
para('Slider 500–25,000 credits, live price quote, demo instant purchase. Stripe checkout stub ready (STRIPE_SECRET_KEY) — returns 501 until wired for production.');

// ── 10. Direct mail (Lob integration) ───────────────────────────────────────
h2('10. Direct mail — Lob integration');

h3('How mail works');
numbered(1, 'Load render + template for each campaign home', '');
numbered(2, 'Verify address (USPS via Lob when live)', 'Google-format addresses parsed correctly (USA suffix stripped)');
numbered(3, 'Build PDF', 'PDFKit merges template + per-home render + price + QR URL');
numbered(4, 'Save PDFs', 'public/mail/{render-id}-front.pdf and -back.pdf');
numbered(5, 'Send via Lob (live) or demo', 'Demo: PDF only. Live: Lob prints 6×9 postcard and mails via USPS First Class');

h3('Environment');
bullet('LOB_API_KEY', 'live_ key for real mail; test_ keys simulate only');
bullet('LOB_MAIL_MODE', 'demo (PDF preview) or live (physical mail)');
bullet('PUBLIC_BASE_URL', 'HTTPS public URL for QR codes on mailed postcards (ngrok or production domain — NOT localhost)');

h3('Mail API endpoints');
bullet('POST /api/mail/campaigns/:id/verify-addresses', 'Bulk USPS check');
bullet('POST /api/mail/campaigns/:id/send', 'Preview or live send all mailable homes');
bullet('POST /api/mail/campaigns/:id/reset-mail', 'Reset quote_sent / mail_status for testing');
bullet('POST /api/mail/renders/send', 'Mail single quote from Quotes page');

// ── 11. Backend API reference ─────────────────────────────────────────────
h2('11. Backend API summary');

h3('Core routes');
bullet('GET /api/health', 'Server status, render provider, maps key, max free renders');
bullet('POST /api/render', 'AI render — previewOnly or full save + optional campaignHomeId (credits)');
bullet('GET/POST /api/campaigns', 'List/create campaigns');
bullet('GET /api/campaigns/:id', 'Campaign + homes + stats');
bullet('POST /api/campaigns/:id/homes/bulk', 'Add discovered addresses');
bullet('PATCH /api/campaigns/homes/:homeId', 'Update home status, address, etc.');
bullet('POST /api/discovery/area', 'Find addresses in map polygon');
bullet('POST /api/discovery/neighbors', 'Find N neighbors near seed address');
bullet('GET /api/quote/:id', 'Homeowner quote payload + seasonSwitch metadata');
bullet('POST /api/quote/:id/season', 'Generate or return cached season variant image');
bullet('GET/POST /api/templates', 'List/save postcard templates');
bullet('GET/POST /api/credits/*', 'Balance, packages, purchase, transactions');
bullet('POST /api/lead', 'Capture lead from widget or quote page');

// ── 12. Data storage ──────────────────────────────────────────────────────
h2('12. Data storage');

h3('JSON fallback (data/ folder — used when Supabase not configured)');
bullet('campaigns.json', 'Campaign records');
bullet('campaign_homes.json', 'Homes per campaign with status, render_id, estimated_total');
bullet('renders.json', 'All AI renders with image_url, scheme, pricing, roofline_feet');
bullet('leads.json', 'Captured leads');
bullet('credits.json + credit_transactions.json', 'Per-account credit balances');
bullet('postcard_templates.json', 'Custom postcard templates');
bullet('season_variants.json', 'Cached Season Switch images per render');

h3('Supabase (production)');
para('Migrations in supabase/migrations/ add outreach columns (mail_status, lat/lng), credits tables, postcard_templates table. Apply migrations for full persistence.');

h3('Static files');
bullet('public/renders/*.jpg', 'AI-generated house images served at /renders/');
bullet('public/mail/*-front.pdf', 'Generated postcard PDFs served at /mail/');

// ── 13. Environment variables ───────────────────────────────────────────────
h2('13. Key environment variables (.env)');

bullet('PORT', 'Server port (default 3100 in this project)');
bullet('GOOGLE_MAPS_API_KEY', 'Places, Geocoding, Street View');
bullet('GEMINI_API_KEY + GEMINI_IMAGE_MODEL', 'AI lighting renders');
bullet('RENDER_PROVIDER', 'gemini or cloudflare');
bullet('SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY', 'Postgres database');
bullet('STARTING_CREDITS / CREDITS_PER_RENDER', 'Credit wallet defaults');
bullet('DEFAULT_PRICE_PER_FOOT', 'Fallback $/ft for campaign renders (default 40)');
bullet('MAX_FREE_RENDERS', 'Widget free render limit per visitor');
bullet('LOB_API_KEY / LOB_MAIL_MODE / PUBLIC_BASE_URL', 'Direct mail');
bullet('BILLING_MODE / STRIPE_SECRET_KEY', 'Payments (demo vs live)');

// ── 14. Unique features vs Light Launch ───────────────────────────────────
h2('14. Unique features vs Light Launch');

bullet('Season Switch', 'Homeowner previews 4 holiday color schemes on one quote page — proves permanent lighting value. Light Launch shows one static design per mailer.');
bullet('Block Wave', 'Campaign detects when a street has partial coverage and prompts mailing remaining neighbors.');
bullet('Split pricing today', 'Credits for AI renders + separate Lob postage (Light Launch bundles ~$1/mail all-in). Stripe bundle checkout planned.');
bullet('Template editor', 'Full drag-and-drop 6×9 postcard designer with per-house Render slots and merge tags.');
bullet('Demo-first mail', 'Preview unlimited PDF postcards without Lob charges; reset mail status for testing.');

// ── 15. Demo vs production checklist ──────────────────────────────────────
h2('15. Demo vs production checklist');

h3('Working today (demo/local)');
bullet('Full campaign workflow: load homes → Make Quotes → Preview PDFs → QR quote page → Season Switch', '');
bullet('Credit wallet with demo purchases', '');
bullet('Address verification (format check; Lob USPS when live keys set)', '');
bullet('Mobile-responsive dashboard', '');

h3('Before going live');
numbered(1, 'Set PUBLIC_BASE_URL to HTTPS domain', 'QR codes on mailed postcards');
numbered(2, 'Apply Supabase migrations', 'mail_status, lat/lng, templates table');
numbered(3, 'Configure LOB_API_KEY (live_) + verified return address', 'Physical mail');
numbered(4, 'Wire Stripe checkout', 'Real credit purchases');
numbered(5, 'Remove test addresses', 'Fake addresses fail USPS verification');
numbered(6, 'Restart server after code changes', 'New API routes require npm start');

// ── 16. Typical end-to-end test ───────────────────────────────────────────
h2('16. Typical end-to-end test flow');

numbered(1, 'Login at /app/login', '');
numbered(2, 'Outreach → New campaign → load 5 addresses on map or CSV', '');
numbered(3, 'Set Price per linear foot = $40 in sidebar', '');
numbered(4, 'Make Quotes — wait for batch render (uses credits)', '');
numbered(5, 'Verify Est. quote column shows dollar amounts', '');
numbered(6, 'Choose template with Render slot → Preview PDFs', '');
numbered(7, 'Open PDF — confirm unique house photo + gold price + QR', '');
numbered(8, 'Scan QR on phone (or open quote URL) — test Season Switch buttons', '');
numbered(9, 'Submit Request a call — verify lead in Dashboard → Leads', '');

// ── Footer on all pages ─────────────────────────────────────────────────────
const pages = doc.bufferedPageRange();
for (let i = 0; i < pages.count; i++) {
  doc.switchToPage(i);
  doc.fillColor('#aaa').font('Helvetica').fontSize(8)
    .text(`Festive Lighting Pros — CMS Guide  •  Page ${i + 1} of ${pages.count}`, M, doc.page.height - 32, {
      width: CONTENT_W,
      align: 'center',
    });
}

doc.end();

console.log(`\n  CMS Guide PDF written to:\n  ${OUT_FILE}\n`);
