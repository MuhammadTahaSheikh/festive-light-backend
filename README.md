# Festive Lighting Pros — Landing + AI "See Your Home Lit Up" Widget

A rebranded clone of the Light Launch landing experience, adapted for **Festive Lighting Pros**
(a homeowner-facing outdoor-lighting installer). It includes the signature feature: a homeowner
types their address and instantly sees **their actual house** rendered with permanent lighting,
plus an instant estimate — a powerful lead magnet.

## What's in here

```
festive-light-launch/
├─ server/index.js       Express backend (keeps API keys server-side)
├─ public/
│  ├─ index.html         Rebranded landing page (self-contained CSS)
│  └─ demo-widget.js     The "see your home lit up" widget
├─ data/leads.json       Captured leads (auto-created, gitignored)
├─ .env.example          Copy to .env and add your keys
└─ package.json
```

## How the render works

1. **Address autocomplete** → Google **Places API (New)** (server-side, key stays secret)
2. **Grab the house photo** → Google **Street View Static API**
3. **Repaint it with lights** → Google **Gemini `gemini-3.1-flash-image`** (Nano Banana 2) edits
   the photo to add permanent roofline lighting in the chosen colors, at dusk
4. **Instant estimate** → roofline footage (approximation) × the price/ft the homeowner enters
5. **Lead capture** → name/email/phone saved to `data/leads.json`

## Setup

### 1. Get your keys (one Google Cloud project can do it all)

- **Google Cloud** → enable **Places API (New)**, **Street View Static API**, **Geocoding API**,
  then create an API key (APIs & Services → Credentials). Enable billing.
- **Gemini** → get a key at https://aistudio.google.com/apikey

### 2. Configure

```bash
copy .env.example .env      # Windows (PowerShell: cp .env.example .env)
```

Edit `.env` and paste in `GOOGLE_MAPS_API_KEY` and `GEMINI_API_KEY`.

### 3. Install & run

```bash
npm install
npm start
```

Open http://localhost:3000 and try the widget in the **"Try it on your real home"** section.

## Cost notes (rough, pay-as-you-go)

- Places Autocomplete / Details: a few $ per 1,000 requests
- Street View Static: ~$7 per 1,000 images
- Gemini image edit: ~$0.04 per rendered image

Set `MAX_FREE_RENDERS` in `.env` to cap free renders per visitor (enforcement is UI-side for now;
add server-side rate limiting before going to production).

## Notes / next steps

- Renders are saved to `public/renders/` and served statically. Add a cleanup job for production.
- Estimates are approximations by design — the real quote comes from an on-site measure.
- The live festivelightingpros.com currently has injected SEO spam; only genuine brand content
  (services, testimonials, phone, colors) was used here.
- Not yet included (would need more work / services): actual postcard mailing, Stripe deposits,
  full CRM/scheduler. This build covers the landing page + the AI render lead magnet.
