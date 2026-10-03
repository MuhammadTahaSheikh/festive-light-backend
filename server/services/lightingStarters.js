/** Extra 6×9 starters matching the lighting1–3 postcard artwork. */

const ART = '/postcard-art';
const NAVY = '#1B2E5B';
const ORANGE = '#F29121';
const WHITE = '#ffffff';

const CONTACT_PHONE = '941.200.4984';
const CONTACT_FOOTER = 'FESTIVE LIGHTING PROS\nSarasota@FLPpros.com\n1073 Northgate Blvd., Sarasota, FL 34234';
const BODY_COPY = 'Hey {{owner_first}},\nWe designed a custom lighting look\nspecifically for your home.\nYour personalized quote is ready with\npricing and next step inside';

function img(id, src, x, y, w, h, z = 1, fit = 'contain') {
  return { id, type: 'image', x, y, w, h, src, fit, z };
}

function logo(id, x, y, w, h) {
  return { id, type: 'logo', x, y, w, h, src: `${ART}/logo-wordmark.png`, fit: 'contain', z: 2 };
}

function qrBlock(prefix, x, y, size, pad = 0.16) {
  return [
    img(`${prefix}-qr-card`, `${ART}/qr-card.png`, x, y, size, size, 2, 'contain'),
    { id: `${prefix}-qr`, type: 'qr', x: x + pad, y: y + pad, w: size - pad * 2, h: size - pad * 2, z: 3 },
  ];
}

function headlinePair(prefix, colX, y, colW, first, second, fontSize = 16) {
  const table = {
    16: { 'LEVEL UP': 1.087, 'YOUR HOME': 1.355 },
    20: { 'LEVEL UP': 1.358, 'YOUR HOME': 1.694 },
    22: { 'LEVEL UP': 1.494, 'YOUR HOME': 1.863 },
  };
  const widths = table[fontSize] || table[16];
  const w1 = (widths[first] || first.length * fontSize * 0.0076) + 0.05;
  const w2 = (widths[second] || second.length * fontSize * 0.0076) + 0.05;
  const gap = 0.08;
  const start = colX + (colW - (w1 + gap + w2)) / 2;
  return [
    { id: `${prefix}-h1a`, type: 'text', x: start, y, w: w1, h: 0.4, text: first, fontSize, color: WHITE, align: 'left', bold: true, z: 4 },
    { id: `${prefix}-h1b`, type: 'text', x: start + w1 + gap, y, w: w2, h: 0.4, text: second, fontSize, color: ORANGE, align: 'left', bold: true, z: 4 },
  ];
}

function outlinedPhone(colX, y, colW) {
  return [
    { id: 'phone', type: 'text', x: colX, y, w: colW, h: 0.55, text: CONTACT_PHONE, fontSize: 28, color: NAVY, align: 'center', bold: true, z: 4, strokeColor: ORANGE, strokeWidth: 2.4 },
  ];
}

function qrBlockOnCenter(prefix, centerX, y, size) {
  return qrBlock(prefix, centerX - size / 2, y, size);
}

function backQrRight() {
  // Keep every left-column block inside the navy, short of the orange wave.
  const lx = 0.28;
  const lw = 3.55;
  return {
    background: WHITE,
    elements: [
      img('wave', `${ART}/back-wave-qr-right.png`, 0, 0, 9, 6, 0, 'cover'),
      ...headlinePair('l', lx, 0.22, lw, 'LEVEL UP', 'YOUR HOME'),
      { id: 'sub', type: 'text', x: lx, y: 0.58, w: lw, h: 0.28, text: 'ALL YEAR ROUND LIGHTING', fontSize: 10, color: WHITE, align: 'center', z: 4 },
      { id: 'body', type: 'text', x: lx, y: 0.92, w: lw, h: 1.28, text: BODY_COPY, fontSize: 11, color: WHITE, align: 'center', z: 4 },
      { id: 'est', type: 'text', x: lx, y: 2.28, w: lw, h: 0.24, text: 'Estimated front quote:', fontSize: 10, color: WHITE, align: 'center', z: 4 },
      { id: 'price', type: 'price', x: lx, y: 2.5, w: lw, h: 0.48, fontSize: 26, color: ORANGE, align: 'center', bold: true, z: 4 },
      { id: 'addr-left', type: 'address', x: lx, y: 3.02, w: lw, h: 0.42, fontSize: 9, color: WHITE, align: 'center', z: 4 },
      { id: 'phone', type: 'text', x: lx, y: 3.48, w: lw, h: 0.42, text: CONTACT_PHONE, fontSize: 22, color: ORANGE, align: 'center', bold: true, z: 4 },
      { id: 'footer', type: 'text', x: lx, y: 3.95, w: lw, h: 0.85, text: CONTACT_FOOTER, fontSize: 8, color: WHITE, align: 'center', z: 4 },
      logo('logo', 5.2, 0.18, 3.4, 1.18),
      ...qrBlock('r', 5.85, 1.42, 2.4),
      { id: 'scan', type: 'text', x: 5.35, y: 3.9, w: 3.3, h: 0.48, text: 'SCAN QR CODE TODAY\nFOR THE NEXT STEP', fontSize: 9, color: NAVY, align: 'center', bold: true, z: 4 },
      { id: 'addr-mail', type: 'address', x: 5.35, y: 4.5, w: 3.3, h: 0.9, fontSize: 8, color: NAVY, align: 'center', z: 4 },
    ],
  };
}

function backQrLeft(headline = ['LEVEL UP', 'YOUR HOME']) {
  const cx = 2.18;
  const colW = 3.4;
  const colX = cx - colW / 2;
  const qrSize = 2.62;
  const qrY = 1.12;
  const below = qrY + qrSize + 0.1;
  const rx = 5.48;
  const rw = 3.2;
  return {
    background: WHITE,
    elements: [
      img('wave', `${ART}/back-wave-qr-left.png`, 0, 0, 9, 6, 0, 'cover'),
      ...headlinePair('l', colX, 0.22, colW, headline[0], headline[1], 20),
      { id: 'sub', type: 'text', x: colX, y: 0.62, w: colW, h: 0.3, text: 'ALL YEAR ROUND LIGHTING', fontSize: 12, color: WHITE, align: 'center', z: 4 },
      ...qrBlockOnCenter('l', cx, qrY, qrSize),
      { id: 'scan', type: 'text', x: colX, y: below, w: colW, h: 0.48, text: 'SCAN QR CODE TODAY TO\nFOR THE NEXT STEP', fontSize: 11, color: WHITE, align: 'center', bold: true, z: 4 },
      ...outlinedPhone(colX, below + 0.5, colW),
      { id: 'footer', type: 'text', x: colX, y: below + 1.1, w: colW, h: 0.7, text: CONTACT_FOOTER, fontSize: 7, color: WHITE, align: 'center', z: 4 },
      logo('logo', rx, 0.16, 3.05, 1.22),
      { id: 'hey', type: 'text', x: rx, y: 1.52, w: 0.38, h: 0.28, text: 'Hey', fontSize: 12, color: NAVY, align: 'left', z: 4 },
      { id: 'who', type: 'text', x: rx + 0.36, y: 1.52, w: 2.7, h: 0.28, text: '{{owner_first}},', fontSize: 12, color: ORANGE, align: 'left', bold: true, z: 4 },
      { id: 'body', type: 'text', x: rx, y: 1.84, w: rw, h: 1.05, text: 'We designed a custom lighting look\nspecifically for your home.\nYour personalized quote is ready with\npricing and next step inside', fontSize: 12, color: NAVY, align: 'left', z: 4 },
      { id: 'est', type: 'text', x: rx, y: 3.08, w: rw, h: 0.24, text: 'Estimated front quote:', fontSize: 11, color: NAVY, align: 'left', z: 4 },
      { id: 'price', type: 'price', x: rx, y: 3.32, w: rw, h: 0.55, fontSize: 32, color: ORANGE, align: 'left', bold: true, z: 4 },
      { id: 'addr', type: 'address', x: rx, y: 3.96, w: rw, h: 0.42, fontSize: 10, color: NAVY, align: 'left', bold: true, z: 4 },
    ],
  };
}

export const LIGHTING_STARTERS = [
  {
    id: 'starter-lighting-1',
    name: 'lighting1',
    category: 'Eye-Catching',
    is_starter: true,
    format: '6x9',
    front: {
      background: '#0b0b0d',
      elements: [
        { id: 'r1', type: 'render', x: 0, y: 0, w: 9, h: 6, z: 0 },
        // Native art is ~4.17:1; full height keeps the orange wave and navy band uncropped.
        img('banner', `${ART}/front-caption-wave.png`, 0, 3.843, 9, 2.157, 1, 'fill'),
        img('mascot', `${ART}/mascot.png`, 6.55, 3.38, 2.35, 2.52, 3, 'contain'),
        {
          id: 'caption',
          type: 'text',
          x: 0.35,
          y: 5.08,
          w: 6.4,
          h: 0.78,
          text: 'Hi {{owner_first}}, Level Up Your Home with Permanent Lighting\nYou Can Enjoy All Year Round.',
          fontSize: 13,
          color: WHITE,
          align: 'center',
          bold: true,
          z: 4,
        },
      ],
    },
    back: backQrRight(),
  },
  {
    id: 'starter-lighting-2',
    name: 'lighting2',
    category: 'Eye-Catching',
    is_starter: true,
    format: '6x9',
    front: {
      background: '#0b0b0d',
      elements: [
        { id: 'r1', type: 'render', x: 0, y: 0, w: 9, h: 6, z: 0 },
        { id: 'bar-orange', type: 'rect', x: 0, y: 4.78, w: 9, h: 0.07, fill: ORANGE, z: 1 },
        { id: 'bar-navy', type: 'rect', x: 0, y: 4.85, w: 9, h: 1.15, fill: NAVY, z: 1 },
        {
          id: 'caption',
          type: 'text',
          x: 0.35,
          y: 4.95,
          w: 8.3,
          h: 0.95,
          text: 'Hi I’m Matt, owner of Festive Lighting Pro. I drove past your home and thought it would look Incredible with permanent lighting & year-round lights – so I had a custom design made for you.',
          fontSize: 11,
          color: WHITE,
          align: 'center',
          z: 4,
        },
      ],
    },
    back: backQrLeft(['LEVEL UP', 'YOUR HOME']),
  },
  {
    id: 'starter-lighting-3',
    name: 'lighting3',
    category: 'Eye-Catching',
    is_starter: true,
    format: '6x9',
    front: {
      background: '#0b0b0d',
      elements: [
        { id: 'r1', type: 'render', x: 0, y: 0, w: 9, h: 6, z: 0 },
        img('mascot', `${ART}/mascot-welcome.png`, 5.05, 3.42, 3.9, 2.52, 3, 'contain'),
        { id: 'welcome', type: 'text', x: 5.50, y: 3.66, w: 0.85, h: 0.36, text: 'Welcome', fontSize: 14, fontFamily: 'Pacifico', color: ORANGE, align: 'right', z: 4 },
        { id: 'home', type: 'text', x: 6.38, y: 3.72, w: 0.58, h: 0.28, text: 'Home', fontSize: 13, fontFamily: 'Poppins', color: NAVY, align: 'left', bold: true, z: 4 },
        {
          id: 'owner',
          type: 'text',
          x: 5.42,
          y: 4.02,
          w: 1.48,
          h: 0.42,
          text: '{{owner_first}}',
          fontSize: 18,
          fontFamily: 'Poppins',
          color: NAVY,
          align: 'center',
          bold: true,
          z: 4,
        },
      ],
    },
    back: backQrLeft(['LEVEL UP', 'YOUR HOME']),
  },
];
