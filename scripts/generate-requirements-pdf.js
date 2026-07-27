// Generates a professional project requirements PDF for stakeholder review.
// Run: node scripts/generate-requirements-pdf.js
import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'docs');
const OUT_FILE = path.join(OUT_DIR, 'Festive-Lighting-Pros-Project-Plan.pdf');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Palette ────────────────────────────────────────────────────────────────
const C = {
  ink: '#1c1c1c',
  sub: '#5c5c5c',
  gold: '#b8860b',
  goldSoft: '#f4e9c6',
  line: '#e2e2e2',
  band: '#141414',
  bandText: '#f5c842',
  green: '#2e7d32',
  chipBg: '#f5f1e4',
};

const M = 54;
const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true });
doc.pipe(fs.createWriteStream(OUT_FILE));

const PAGE_W = doc.page.width;
const CONTENT_W = PAGE_W - M * 2;

// ── Helpers ──────────────────────────────────────────────────────────────
function ensureSpace(h) {
  if (doc.y + h > doc.page.height - M) doc.addPage();
}

function h2(text) {
  ensureSpace(46);
  doc.moveDown(0.6);
  const y = doc.y;
  doc.save().rect(M, y, 4, 16).fill(C.gold).restore();
  doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(14).text(text, M + 12, y - 1);
  doc.moveTo(M, doc.y + 4).lineTo(M + CONTENT_W, doc.y + 4).strokeColor(C.line).lineWidth(1).stroke();
  doc.moveDown(0.7);
}

function para(text, opts = {}) {
  doc.fillColor(opts.color || C.sub).font(opts.font || 'Helvetica').fontSize(opts.size || 10.5)
    .text(text, { align: opts.align || 'left', lineGap: 3, width: CONTENT_W });
  doc.moveDown(0.4);
}

function bullet(title, desc) {
  ensureSpace(28);
  const x = M + 4;
  const startY = doc.y;
  doc.circle(x + 2, startY + 6, 2.2).fill(C.gold);
  doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(10.5)
    .text(title, x + 12, startY, { continued: !!desc, width: CONTENT_W - 12 });
  if (desc) doc.fillColor(C.sub).font('Helvetica').fontSize(10.5).text('  ' + desc);
  doc.moveDown(0.35);
}

function chip(text, x, y, color) {
  const w = doc.widthOfString(text) + 14;
  doc.roundedRect(x, y, w, 16, 8).fill(color || C.chipBg);
  doc.fillColor(C.ink).font('Helvetica-Bold').fontSize(8.5).text(text, x + 7, y + 4);
  return w;
}

// ── Cover header band ────────────────────────────────────────────────────
doc.rect(0, 0, PAGE_W, 132).fill(C.band);
doc.fillColor(C.bandText).font('Helvetica-Bold').fontSize(11).text('FESTIVE LIGHTING PROS', M, 34, { characterSpacing: 2 });
doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(24).text('Project Plan & Scope', M, 54);
doc.fillColor('#8a8a8a').font('Helvetica').fontSize(9)
  .text('Proposed plan for review  •  Modeled on lightlaunch.ai', M, 88);

doc.y = 152;

// ── 1. Overview ─────────────────────────────────────────────────────────
h2('1. Project Overview');
para('This plan outlines a lead-generation web application for Festive Lighting Pros, modeled on the functionality of lightlaunch.ai. The product lets a homeowner see a photorealistic preview of their own house decorated with permanent holiday and landscape lighting, then instantly receive a priced quote. Every render creates a private, shareable customer quote page (with QR code) and captures the homeowner as a lead inside a contractor dashboard.');
para('The goal is to turn "I might be interested" into a booked consultation by giving prospects an instant, personalized visual and price — and to give the sales team a single place to manage those leads through to a closed job.');

// ── 2. Core Scope ───────────────────────────────────────────────────────
h2('2. Functional Scope');
bullet('Branded landing page', 'Marketing site matching Festive Lighting Pros branding (logo, colors, phone), with the look and feel of Light Launch.');
bullet('Photo render widget', 'Homeowner uploads a photo of their house (or enters an address); the system returns the same house with permanent lighting traced along the roofline.');
bullet('Instant pricing', 'Auto-estimated front-of-house and whole-house pricing based on measured or entered footage.');
bullet('Customer quote pages', 'Each render generates a private page (image, price, call-to-action) reachable by unique URL and QR code.');
bullet('Lead capture', 'Every render or quote request is stored as a lead with contact info and source.');
bullet('Contractor dashboard', 'Logged-in area: Overview, Leads, Outreach, Campaigns, Quotes, Jobs, Schedule, Templates, Customer Portal, Settings, Billing.');
bullet('Campaigns', 'Group target homes into a campaign and track each home through a pipeline (Prospect > Rendered > Quote sent > Viewed > Interested > Closed) with live pipeline value.');
bullet('Authentication', 'Secure user accounts for the contractor team.');
bullet('Database', 'Persistent storage for leads, renders, campaigns, and campaign homes.');

// ── 3. Phases / Roadmap ─────────────────────────────────────────────────
h2('3. Delivery Phases');
const phases = [
  ['Phase 1 — Foundation', 'Branded landing page, photo render widget, instant pricing, customer quote pages, lead capture, and database.'],
  ['Phase 2 — Contractor Dashboard', 'Authentication, Overview, Leads, Campaigns pipeline, Quotes, and Customer Portal.'],
  ['Phase 3 — Render Quality', 'Upgrade to a premium image model for exact, non-distorting roofline lighting that matches Light Launch quality. Requires a paid API.'],
  ['Phase 4 — Address Automation', 'Address autocomplete and automatic Street View pull, so homeowners do not need to upload a photo (Google Maps Platform).'],
  ['Phase 5 — Conversion & Payments', 'Automated call requests, deposit and payment collection (Stripe), and email/SMS notifications to the team.'],
  ['Phase 6 — Operations', 'Jobs, Schedule, Templates, Settings, and Billing fully wired, plus reporting and export.'],
  ['Phase 7 — Physical Direct Mail (Optional)', 'Auto-generate a personalized postcard (render, price, QR) for every home in a campaign and mail it via a print/mail API (Lob) — the Light Launch mailed-postcard model. Adds per-piece print and postage cost.'],
];
phases.forEach(([t, d]) => bullet(t, d));

// ── 4. Technology Stack ─────────────────────────────────────────────────
h2('4. Technology Stack');
bullet('Frontend', 'React (Vite) with React Router for the contractor dashboard, and a static marketing site.');
bullet('Backend', 'Node.js and Express API (rendering, leads, campaigns, authentication).');
bullet('Database & Auth', 'Supabase (Postgres + Auth).');
bullet('Image rendering', 'Free option: Cloudflare Workers image generation. Recommended: Google Gemini image model for premium quality.');
bullet('Maps', 'Free option: OpenStreetMap autocomplete. Optional: Google Maps Platform for address automation.');

// ── 5. Paid Tools & Cost ────────────────────────────────────────────────
h2('5. Paid Tools & Estimated Monthly Cost');
para('Two paths are available. A free path keeps API cost near zero. A paid path is recommended for render quality and automation that match lightlaunch.ai. The cost table below covers only usage-based paid APIs (Gemini + Google Maps). All figures are estimates for budgeting only and will vary with usage.');

para('Free path:', { color: C.ink, font: 'Helvetica-Bold' });
bullet('Cloudflare Workers image generation', 'Free image generation. Limitation: can slightly alter the house and lighting is less precise.');
bullet('OpenStreetMap autocomplete', 'Free address suggestions. Homeowner uploads a photo (no auto Street View).');

para('Paid path (recommended tools):', { color: C.ink, font: 'Helvetica-Bold' });
bullet('Google Gemini (image model)', 'Photorealistic, non-distorting edits. ~$0.04 per render.');
bullet('Google Maps Platform', 'Places Autocomplete + Street View + Geocoding. ~$0.01–0.02 per render.');
bullet('Lob direct mail (optional)', 'Print + mail personalized postcards. Pay per piece: ~$0.70–$1.50 each (print + postage). Only if physical mail is wanted.');

// ── Cost table ──────────────────────────────────────────────────────────
doc.moveDown(0.3);
para('Estimated monthly API cost by render volume (paid path — Gemini + Google Maps only):', { color: C.ink, font: 'Helvetica-Bold' });

const rows = [
  ['Renders / month', 'Gemini (~$0.04/render)', 'Google Maps (~$0.01–0.02/render)', 'Estimated total'],
  ['50', '~$2', '~$0.50–1', '~$2.50–3'],
  ['100', '~$4', '~$1–2', '~$5–6'],
  ['200', '~$8', '~$2–4', '~$10–12'],
  ['500', '~$20', '~$5–10', '~$25–30'],
  ['1,000', '~$40', '~$10–20', '~$50–60'],
];
const colW = [CONTENT_W * 0.24, CONTENT_W * 0.26, CONTENT_W * 0.26, CONTENT_W * 0.24];
const rowH = 22;
let ty = doc.y + 4;
ensureSpace(rowH * rows.length + 10);
ty = doc.y;
rows.forEach((r, i) => {
  const isHead = i === 0;
  if (isHead) doc.rect(M, ty, CONTENT_W, rowH).fill(C.band);
  else if (i % 2 === 0) doc.rect(M, ty, CONTENT_W, rowH).fill('#faf7ef');
  let x = M;
  r.forEach((cell, ci) => {
    doc.fillColor(isHead ? C.bandText : C.ink)
      .font(isHead ? 'Helvetica-Bold' : (ci === 3 ? 'Helvetica-Bold' : 'Helvetica'))
      .fontSize(9.5)
      .text(cell, x + 8, ty + 6, { width: colW[ci] - 12 });
    x += colW[ci];
  });
  doc.moveTo(M, ty + rowH).lineTo(M + CONTENT_W, ty + rowH).strokeColor(C.line).lineWidth(0.5).stroke();
  ty += rowH;
});
doc.y = ty + 6;
para('Note: Costs above cover only the paid Gemini and Google Maps APIs. Google historically offers monthly free credit for Maps, and image costs scale per use — low volume months cost very little. Payment/SMS providers (e.g. Stripe, Twilio) add per-transaction fees only if enabled in Phase 5. Physical mail (Phase 7, Lob) is billed per postcard (~$0.70–$1.50) and is separate from the totals above.', { size: 9, color: C.sub });

// ── 6. Decisions needed ─────────────────────────────────────────────────
h2('6. Decisions Needed From Reviewer');
bullet('Render quality', 'Approve budget for the paid image model (Gemini) to match Light Launch quality, or stay on the free model?');
bullet('Address automation', 'Use address-to-Street-View (paid Maps), or keep homeowner photo upload (free)?');
bullet('Payments', 'Should the customer quote page collect a deposit (Stripe) in Phase 5?');
bullet('Direct mail', 'Do we want physical mailed postcards (Lob, Phase 7) like Light Launch, or stay digital-only?');
bullet('Notifications', 'Email/SMS alerts to the sales team on new leads — in scope?');
bullet('Volume', 'Expected renders per month, to size the plan and budget accurately.');
bullet('Scope changes', 'Any features to add or remove from Sections 2 and 3.');

// ── Footer on all pages ─────────────────────────────────────────────────
const range = doc.bufferedPageRange();
for (let i = 0; i < range.count; i++) {
  doc.switchToPage(range.start + i);
  // Writing in the bottom margin makes PDFKit auto-add blank pages; disable the
  // bottom margin on this page while stamping the footer to prevent that.
  doc.page.margins.bottom = 0;
  const fy = doc.page.height - 34;
  doc.moveTo(M, fy).lineTo(M + CONTENT_W, fy).strokeColor(C.line).lineWidth(0.5).stroke();
  doc.fillColor(C.sub).font('Helvetica').fontSize(8)
    .text('Festive Lighting Pros — Project Plan', M, fy + 6, { width: CONTENT_W / 2, align: 'left', lineBreak: false });
  doc.fillColor(C.sub).font('Helvetica').fontSize(8)
    .text(`Page ${i + 1} of ${range.count}`, M + CONTENT_W / 2, fy + 6, { width: CONTENT_W / 2, align: 'right', lineBreak: false });
}

doc.end();
console.log('PDF written to', OUT_FILE);
