/** Built-in 6×9 postcard layouts (Light Launch–style starters). Coordinates in inches on a 9×6 canvas. */

export const POSTCARD_W_IN = 9;
export const POSTCARD_H_IN = 6;
/** Lob 6×9 files must include 1/8" bleed on each side (9.25 × 6.25). */
export const POSTCARD_BLEED_IN = 0.125;
export const POSTCARD_PDF_W_IN = POSTCARD_W_IN + POSTCARD_BLEED_IN * 2;
export const POSTCARD_PDF_H_IN = POSTCARD_H_IN + POSTCARD_BLEED_IN * 2;

export const BRAND_LOGO_SRC = '/brand/logo.png';

/** Layered warm tones so the back feels less flat than solid black. */
const warmBackdrop = (opts = {}) => [
  { id: 'bg-top', type: 'rect', x: 0, y: 0, w: 9, h: 3.4, fill: opts.topFill || '#14110e', z: 0 },
  { id: 'bg-mid', type: 'rect', x: 0, y: 3.4, w: 9, h: 1.82, fill: opts.midFill || '#100e0b', z: 0 },
];

/** Logo + company name. */
const brandHeader = (opts = {}) => {
  const tagline = opts.tagline || 'Permanent & holiday lighting specialists';
  const taglineColor = opts.taglineColor || '#8a8478';
  const nameColor = opts.nameColor || '#f49321';
  const accentColor = opts.accentColor || '#f49321';
  const logoSize = opts.logoSize ?? 1.18;
  const logoY = opts.logoY ?? 0.17;
  const header = [];
  if (!opts.skipAccent) {
    header.push({ id: 'accent-top', type: 'rect', x: 0, y: 0, w: 9, h: 0.055, fill: accentColor, z: 0 });
  }
  return [
    ...header,
    { id: 'logo', type: 'logo', x: 0.42, y: logoY, w: logoSize, h: logoSize, src: BRAND_LOGO_SRC, z: 2 },
    { id: 'brand-name', type: 'text', x: 1.72, y: 0.26, w: 7, h: 0.46, text: 'Festive Lighting Pros', fontSize: 16.5, color: nameColor, align: 'left', bold: true, z: 2 },
    { id: 'brand-tag', type: 'text', x: 1.72, y: 0.7, w: 7, h: 0.3, text: tagline, fontSize: 8, color: taglineColor, align: 'left', z: 2 },
    { id: 'divider', type: 'rect', x: 0.42, y: 1.36, w: 8.16, h: 0.012, fill: opts.dividerColor || '#2e281c', z: 1 },
  ];
};

/** Eyebrow + headline + supporting copy. */
const messageBlock = (opts = {}) => {
  const accent = opts.accentColor || '#f49321';
  const y = opts.y ?? 1.46;
  return [
    { id: 'eyebrow', type: 'text', x: 0.42, y, w: 8.16, h: 0.24, text: opts.eyebrow || '{{owner_eyebrow}}', fontSize: 6.5, color: accent, align: 'left', bold: true, z: 2 },
    { id: 'headline', type: 'text', x: 0.42, y: y + 0.28, w: 8.16, h: 0.52, text: opts.headline || '{{greeting_prefix}}Your lighting design', fontSize: 20, color: '#ffffff', align: 'left', bold: true, z: 2 },
    { id: 'headline-accent', type: 'text', x: 0.42, y: y + 0.76, w: 8.16, h: 0.42, text: opts.headlineAccent || 'is ready to view.', fontSize: 20, color: accent, align: 'left', bold: true, z: 2 },
    { id: 'body', type: 'text', x: 0.42, y: y + 1.28, w: opts.bodyW ?? 8.16, h: 0.95, text: opts.body || 'Scan the code to see your full render, personalized pricing, and book a free consultation.', fontSize: 10, color: '#b8b2a6', align: 'left', z: 2 },
  ];
};

/** Three small trust badges in a row. */
const trustBadges = (opts = {}) => {
  const y = opts.y ?? 3.02;
  const accent = opts.accentColor || '#f49321';
  const fill = opts.fill || '#1a1610';
  const badges = opts.items || ['Free consultation', 'Custom render', 'No obligation'];
  const w = 2.62;
  const gap = 0.15;
  return badges.flatMap((label, i) => {
    const x = 0.42 + i * (w + gap);
    return [
      { id: `badge-bg-${i}`, type: 'rect', x, y, w, h: 0.3, fill, z: 1 },
      { id: `badge-${i}`, type: 'text', x, y: y + 0.06, w, h: 0.22, text: label, fontSize: 6.5, color: accent, align: 'center', z: 2 },
    ];
  });
};

/** Price + QR in a unified premium panel. */
const ctaRow = (opts = {}) => {
  const accent = opts.accentColor || '#f49321';
  const y = opts.y ?? 3.35;
  const h = opts.h ?? 1.72;
  const rightColX = 5.02;
  const rightColW = 3.48;
  const qrSize = 1.18;
  const qrX = rightColX + (rightColW - qrSize) / 2;
  const qrY = y + h - qrSize - 0.12;
  return [
    { id: 'cta-shadow', type: 'rect', x: 0.38, y: y + 0.03, w: 8.24, h, fill: '#0a0806', z: 0 },
    { id: 'cta-panel', type: 'rect', x: 0.42, y, w: 8.16, h, fill: opts.panelFill || '#18140f', z: 1 },
    { id: 'cta-border', type: 'rect', x: 0.42, y, w: 8.16, h: 0.012, fill: accent, z: 2 },
    { id: 'cta-accent', type: 'rect', x: 0.42, y, w: 0.05, h, fill: accent, z: 2 },
    { id: 'cta-divider', type: 'rect', x: 4.92, y: y + 0.14, w: 0.012, h: h - 0.28, fill: opts.dividerColor || '#2e281c', z: 2 },
    { id: 'price-label', type: 'text', x: 0.58, y: y + 0.2, w: 4.1, h: 0.24, text: opts.priceLabel || 'YOUR ESTIMATED QUOTE', fontSize: 6.5, color: opts.mutedColor || '#8a8478', align: 'left', z: 2 },
    { id: 'price', type: 'price', x: 0.58, y: y + 0.46, w: 4.1, h: 0.9, fontSize: opts.priceSize ?? 34, color: accent, align: 'left', bold: true, z: 2 },
    { id: 'qr-label', type: 'text', x: rightColX, y: y + 0.18, w: rightColW, h: 0.22, text: opts.qrLabel || 'SCAN TO VIEW', fontSize: 6.5, color: accent, align: 'center', bold: true, z: 2 },
    { id: 'qr-sub', type: 'text', x: rightColX, y: y + 0.36, w: rightColW, h: 0.18, text: 'Full render & pricing', fontSize: 6, color: opts.mutedColor || '#8a8478', align: 'center', z: 2 },
    { id: 'qr-box', type: 'rect', x: qrX, y: qrY, w: qrSize, h: qrSize, fill: '#ffffff', z: 1 },
    { id: 'qr', type: 'qr', x: qrX + 0.05, y: qrY + 0.05, w: qrSize - 0.1, h: qrSize - 0.1, z: 3 },
  ];
};

/** USPS mailing address strip at the bottom. */
const addressStrip = (opts = {}) => [
  { id: 'addr-bar', type: 'rect', x: 0, y: 5.2, w: 9, h: 0.8, fill: opts.barFill || '#0c0a08', z: 1 },
  { id: 'addr-accent', type: 'rect', x: 0, y: 5.2, w: 9, h: 0.012, fill: opts.accentColor || '#f49321', z: 2 },
  { id: 'address', type: 'address', x: 0.42, y: 5.38, w: 5.5, h: 0.48, fontSize: 8, color: opts.addrColor || '#9a948a', align: 'left', z: 2 },
  { id: 'website', type: 'text', x: 5.4, y: 5.48, w: 3.2, h: 0.35, text: 'festivelightingpros.com', fontSize: 7.5, color: opts.siteColor || '#f49321', align: 'right', bold: true, z: 2 },
];

/** Standard premium back layout shared by starter templates. */
const premiumBack = (opts = {}) => [
  { id: 'left-accent', type: 'rect', x: 0, y: 0, w: 0.055, h: 5.2, fill: opts.accentColor || '#f49321', z: 1 },
  ...warmBackdrop(opts.backdrop || {}),
  ...brandHeader(opts.header || {}),
  ...messageBlock(opts.message || {}),
  ...(opts.trust !== false ? trustBadges({ accentColor: opts.accentColor, items: opts.trustItems }) : []),
  ...ctaRow(opts.cta || {}),
  ...addressStrip(opts.footer || {}),
];

export const STARTER_TEMPLATES = [
  {
    id: 'starter-plain-render',
    name: 'Plain Render',
    category: 'Eye-Catching',
    is_starter: true,
    format: '6x9',
    front: {
      background: '#0b0b0d',
      elements: [
        { id: 'accent-top', type: 'rect', x: 0, y: 0, w: 9, h: 0.05, fill: '#f49321', z: 2 },
        { id: 'r1', type: 'render', x: 0, y: 0, w: 9, h: 6, z: 0 },
      ],
    },
    back: {
      background: '#100e0b',
      elements: premiumBack({
        message: {
          body: 'We designed a custom lighting look for your home. Scan the code to see every detail, your personalized price, and book a free consultation.',
        },
      }),
    },
  },
  {
    id: 'starter-your-house',
    name: 'This is YOUR house',
    category: 'Eye-Catching',
    is_starter: true,
    format: '6x9',
    front: {
      background: '#0b0b0d',
      elements: [
        { id: 'accent-top', type: 'rect', x: 0, y: 0, w: 9, h: 0.06, fill: '#f49321', z: 2 },
        { id: 'r1', type: 'render', x: 0, y: 0.85, w: 9, h: 4.95, z: 0 },
        { id: 'shade', type: 'rect', x: 0, y: 0, w: 9, h: 1.05, fill: '#0b0b0d', z: 1 },
        { id: 't1', type: 'text', x: 0.4, y: 0.2, w: 8.2, h: 0.7, text: '{{greeting_prefix}}This is YOUR house.', fontSize: 21, color: '#ffffff', align: 'center', bold: true, z: 2 },
        { id: 't2', type: 'text', x: 0.4, y: 5.35, w: 8.2, h: 0.45, text: 'A real render of your home — not a stock photo.', fontSize: 9.5, color: '#9a948a', align: 'center', z: 2 },
      ],
    },
    back: {
      background: '#100e0b',
      elements: premiumBack({
        header: { tagline: 'Your personalized lighting quote' },
        message: {
          eyebrow: 'YOUR PERSONALIZED QUOTE',
          headline: 'Your custom quote',
          headlineAccent: 'is ready to view.',
          body: 'See your full render, every lighting detail, and book a free in-home consultation — all from your phone.',
          bodyW: 8.16,
        },
        cta: { priceLabel: 'STARTING AT', priceSize: 36 },
      }),
    },
  },
  {
    id: 'starter-patriotic',
    name: 'Patriotic',
    category: 'Patriotic',
    is_starter: true,
    format: '6x9',
    front: {
      background: '#0a1628',
      elements: [
        { id: 'stripe-r', type: 'rect', x: 0, y: 0, w: 9, h: 0.05, fill: '#c41e3a', z: 2 },
        { id: 'stripe-w', type: 'rect', x: 0, y: 0.05, w: 9, h: 0.05, fill: '#ffffff', z: 2 },
        { id: 'stripe-b', type: 'rect', x: 0, y: 0.1, w: 9, h: 0.05, fill: '#4c8dff', z: 2 },
        { id: 'r1', type: 'render', x: 0.25, y: 0.45, w: 8.5, h: 4.85, z: 0 },
        { id: 't3', type: 'text', x: 0.3, y: 5.42, w: 8.4, h: 0.45, text: 'Permanent red, white & blue lighting', fontSize: 11, color: '#4c8dff', align: 'center', bold: true, z: 2 },
      ],
    },
    back: {
      background: '#0a1628',
      elements: [
        { id: 'stripe-r', type: 'rect', x: 0, y: 0, w: 9, h: 0.05, fill: '#c41e3a', z: 2 },
        { id: 'stripe-w', type: 'rect', x: 0, y: 0.05, w: 9, h: 0.05, fill: '#ffffff', z: 2 },
        { id: 'stripe-b', type: 'rect', x: 0, y: 0.1, w: 9, h: 0.05, fill: '#4c8dff', z: 2 },
        ...premiumBack({
          accentColor: '#4c8dff',
          backdrop: { topFill: '#0c1a30', midFill: '#0a1628' },
          header: {
            tagline: 'Lit for every season & every holiday',
            taglineColor: '#6b8fc4',
            nameColor: '#ffffff',
            skipAccent: true,
            dividerColor: '#1a3050',
            logoY: 0.2,
          },
          message: {
            eyebrow: 'PATRIOTIC LIGHTING DESIGN',
            headline: 'Your home, beautifully lit',
            headlineAccent: 'year-round.',
            body: '{{greeting_prefix}}See your patriotic lighting design and personalized quote inside.',
            bodyW: 8.16,
          },
          trustItems: ['Red, white & blue', 'Every season', 'Free consultation'],
          cta: {
            accentColor: '#4c8dff',
            panelFill: '#0d1e38',
            dividerColor: '#1a3050',
            mutedColor: '#6b8fc4',
            priceLabel: 'YOUR QUOTE',
          },
          footer: { barFill: '#071220', addrColor: '#6b8fc4', siteColor: '#4c8dff', accentColor: '#c41e3a' },
        }).map((el) => (el.id === 'left-accent' ? { ...el, fill: '#c41e3a' } : el)),
      ],
    },
  },
];

export function getStarterById(id) {
  return STARTER_TEMPLATES.find((t) => t.id === id) || null;
}
