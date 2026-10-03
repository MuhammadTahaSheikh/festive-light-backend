/** 4×6 starters matching nw 3 (1).pdf — four front/back postcard designs. */

const ART = '/postcard-art/nw';
const QR_CARD = '/postcard-art/qr-card.png';
const NAVY = '#1C2F5B';
const ORANGE = '#F7941E';
const PRICE = '#F49322';
const PHONE_COLOR = '#F19023';
const WHITE = '#ffffff';

const PHONE = '941.200.4984';
const FOOTER = 'FESTIVE LIGHTING PROS\nSarasota@FLPpros.com\n©1973 Northgate Blvd. , Sarasota, FL 34234';

const BODY_DESIGNED = 'Hello {{owner_first}},\nWe\'ve designed a custom permanent lighting system\nspecifically for your home—perfect for year-round enjoyment,\nenhanced curb appeal, and added security.\n\nControl your lights right from your phone—easily change\nfor Holiday and Special Events, colors, patterns, brightness,\nand schedules anytime through the app.\n\nYour personalized quote is ready, including pricing and next steps.\n\nScan the QR code to view your custom quote and get started!';

const BODY_CREATED = 'Hello {{owner_first}},\nWe\'ve created a custom permanent lighting system designed\nspecifically for your home—bringing year-round beauty,\nadded curb appeal, and security.\n\nControl everything from your phone and easily customize colors,\npatterns, brightness, and schedules for holidays, special events,\nor everyday use.\n\nYour personalized quote, including pricing and next steps, is ready.\nScan the QR code to view your custom quote and get started!';

const SCAN = 'SCAN QR CODE TODAY TO\nFOR THE NEXT STEP';

function img(id, src, x, y, w, h, z = 2, fit = 'contain', extra = {}) {
  return { id, type: 'image', x, y, w, h, src, fit, z, ...extra };
}

function text(id, fields) {
  return { id, type: 'text', z: 5, align: 'center', ...fields };
}

function headlineRun(id, x, y, w, h, value, color, fontSize) {
  return text(id, {
    x, y, w, h, text: value, color, fontSize,
    fontFamily: 'Poppins-ExtraBold', align: 'center',
  });
}

/** Greeting locked to the white area of a mascot or bubble image. */
function bubbleCopy(parentId, box, copy) {
  const [fx, fy, fw, fh] = box;
  return {
    id: 'greet',
    type: 'text',
    follow: parentId,
    fx, fy, fw, fh,
    fontScale: 15,
    text: copy,
    fontFamily: 'Poppins-Bold',
    color: NAVY,
    align: 'center',
    z: 6,
    x: 0,
    y: 0,
    w: 1,
    h: 0.4,
    fontSize: 8,
    lineGap: -0.5,
  };
}

function qrStack(x, y, size) {
  const pad = size * 0.1;
  const bulb = size * 0.22;
  return [
    img('qr-card', QR_CARD, x, y, size, size, 3, 'fill'),
    { id: 'qr', type: 'qr', x: x + pad, y: y + pad, w: size - pad * 2, h: size - pad * 2, z: 4 },
    img('qr-bulb', `${ART}/qr-bulb.png`, x + (size - bulb) / 2, y + (size - bulb * 1.55) / 2, bulb, bulb * 1.55, 5, 'contain'),
  ];
}

function phoneBlock(x, y, w) {
  return [
    text('phone', {
      x, y, w, h: 0.42,
      text: PHONE,
      fontSize: 16,
      fontFamily: 'Poppins-BlackItalic',
      color: PHONE_COLOR,
      strokeColor: NAVY,
      strokeWidth: 0.7,
    }),
    text('footer', {
      x, y: y + 0.40, w, h: 0.48,
      text: FOOTER,
      fontSize: 4.5,
      fontFamily: 'Poppins-Regular',
      color: WHITE,
      lineGap: 0.4,
    }),
  ];
}

/** Wave A: single orange sweep, arrow, “we’ve designed” copy. */
function backWaveA({ lines, subY = 0.60 }) {
  return {
    background: WHITE,
    elements: [
      { id: 'r1', type: 'render', x: 0, y: 0, w: 6, h: 4, z: 0 },
      img('wave', `${ART}/wave-a.png`, 0, 0, 6, 4, 1, 'fill', { overlay: true }),
      ...lines,
      text('sub', {
        x: 0.28, y: subY, w: 2.55, h: 0.26,
        text: 'ALL YEAR ROUND LIGHTING',
        fontSize: 9.5, fontFamily: 'Poppins-Medium', color: WHITE,
      }),
      ...qrStack(0.62, 1.02, 1.34),
      text('scan', {
        x: 0.42, y: 2.48, w: 1.74, h: 0.40,
        text: SCAN, fontSize: 7.2, fontFamily: 'Poppins-Bold', color: WHITE, lineGap: -0.5,
      }),
      img('arrow', `${ART}/arrow.png`, 1.78, 2.02, 0.62, 0.92, 4, 'contain'),
      img('hand', `${ART}/phone-hand.png`, 2.18, 2.36, 1.24, 1.64, 4, 'contain'),
      ...phoneBlock(0.32, 2.98, 1.95),
      text('body', {
        x: 3.08, y: 0.90, w: 2.78, h: 1.38,
        text: BODY_DESIGNED, fontSize: 5.3, fontFamily: 'Poppins-Medium', color: NAVY, align: 'left', lineGap: -0.6,
      }),
      text('est', {
        x: 3.35, y: 2.46, w: 1.8, h: 0.14,
        text: 'Estimated front quote:', fontSize: 4.6, fontFamily: 'Poppins-BoldItalic', color: NAVY, align: 'left',
      }),
      { id: 'price', type: 'price', x: 3.35, y: 2.58, w: 2.3, h: 0.38, fontSize: 15, fontFamily: 'Poppins-ExtraBold', color: PRICE, align: 'left', bold: true, z: 5 },
    ],
  };
}

/** Wave B: S-curve. CTA is either the orange pill or the curved arrow. */
function backWaveB({ lines, subY = 0.64, cta = 'arrow' }) {
  const ctaEls = cta === 'pill'
    ? [
      img('pill', `${ART}/pill.png`, 0.40, 2.42, 1.48, 0.34, 4, 'fill'),
      text('scan', {
        x: 0.44, y: 2.46, w: 1.40, h: 0.28,
        text: SCAN, fontSize: 6.2, fontFamily: 'Poppins-Bold', color: NAVY, lineGap: -1,
      }),
    ]
    : [
      text('scan', {
        x: 0.40, y: 2.44, w: 1.48, h: 0.36,
        text: SCAN, fontSize: 6.6, fontFamily: 'Poppins-Bold', color: WHITE, lineGap: -0.6,
      }),
      img('arrow', `${ART}/arrow.png`, 1.62, 1.95, 0.58, 0.86, 4, 'contain'),
    ];
  return {
    background: WHITE,
    elements: [
      { id: 'r1', type: 'render', x: 0, y: 0, w: 6, h: 4, z: 0 },
      img('wave', `${ART}/wave-b.png`, 0, 0, 6, 4, 1, 'fill', { overlay: true }),
      ...lines,
      text('sub', {
        x: 0.22, y: subY, w: 2.35, h: 0.24,
        text: 'ALL YEAR ROUND LIGHTING',
        fontSize: 9, fontFamily: 'Poppins-Medium', color: WHITE,
      }),
      ...qrStack(0.48, 0.96, 1.32),
      ...ctaEls,
      img('hand', `${ART}/phone-hand.png`, 1.98, 2.36, 1.26, 1.64, 4, 'contain'),
      ...phoneBlock(0.22, 2.98, 1.85),
      text('body', {
        x: 3.22, y: 1.08, w: 2.62, h: 1.55,
        text: BODY_CREATED, fontSize: 5.2, fontFamily: 'Poppins-Bold', color: NAVY, align: 'left', lineGap: -0.2,
      }),
      text('est', {
        x: 3.22, y: 2.66, w: 1.7, h: 0.14,
        text: 'Estimated front quote:', fontSize: 4.6, fontFamily: 'Poppins-BoldItalic', color: NAVY, align: 'left',
      }),
      { id: 'price', type: 'price', x: 3.22, y: 2.76, w: 2.2, h: 0.38, fontSize: 15, fontFamily: 'Poppins-ExtraBold', color: PRICE, align: 'left', bold: true, z: 5 },
    ],
  };
}

function frontHouse(mascot, bubble) {
  return {
    background: '#0b0b0d',
    elements: [
      { id: 'r1', type: 'render', x: 0, y: 0, w: 6, h: 4, z: 0 },
      ...mascot,
      ...bubble,
    ],
  };
}

export const NW_STARTERS = [
  {
    id: 'starter-nw-1',
    name: 'Light Up Every Season',
    category: 'Eye-Catching',
    is_starter: true,
    format: '4x6',
    front: frontHouse(
      [img('mascot', `${ART}/mascot-remote.png`, 4.90, 2.52, 1.05, 1.40, 3, 'contain', { aspect: 102 / 136 })],
      [
        img('bubble', `${ART}/bubble-remote.png`, 4.30, 2.18, 1.08, 0.72, 3, 'contain', { aspect: 101 / 68 }),
        bubbleCopy('bubble', [0.07, 0.06, 0.86, 0.62], '{{hi_name}}\nOne Tap. Endless Colors.\nLights All Year Round'),
      ],
    ),
    back: backWaveA({
      subY: 0.62,
      lines: [
        headlineRun('h-a', 0.32, 0.30, 1.00, 0.32, 'LIGHT UP', WHITE, 13),
        headlineRun('h-b', 1.32, 0.30, 1.48, 0.32, 'EVERY SEASON', ORANGE, 13),
      ],
    }),
  },
  {
    id: 'starter-nw-2',
    name: 'Illuminate Every Moment',
    category: 'Eye-Catching',
    is_starter: true,
    format: '4x6',
    front: frontHouse(
      [img('mascot', `${ART}/mascot-one-app.png`, 3.55, 1.55, 2.38, 2.40, 3, 'contain', { aspect: 1461 / 1629 })],
      [
        bubbleCopy('mascot', [0.52, 0.05, 0.38, 0.18], '{{hi_name}}\nChange your lights\nanytime—just ONE APP!'),
      ],
    ),
    back: backWaveB({
      subY: 0.66,
      cta: 'pill',
      lines: [
        headlineRun('h-a', 0.22, 0.32, 1.10, 0.30, 'ILLUMINATE', ORANGE, 11),
        headlineRun('h-b', 1.32, 0.32, 1.28, 0.30, 'EVERY MOMENT', WHITE, 11),
      ],
    }),
  },
  {
    id: 'starter-nw-3',
    name: 'Your Home, Your Lights',
    category: 'Eye-Catching',
    is_starter: true,
    format: '4x6',
    front: frontHouse(
      [img('mascot', `${ART}/mascot-fingertips.png`, 3.42, 1.48, 2.50, 2.48, 3, 'contain', { aspect: 1932 / 2095 })],
      [
        bubbleCopy('mascot', [0.07, 0.07, 0.56, 0.24], '{{hi_name}}\nYour permanent lights,\nright at your fingertips!'),
      ],
    ),
    back: backWaveB({
      subY: 0.66,
      cta: 'arrow',
      lines: [
        headlineRun('h-a', 0.18, 0.34, 1.22, 0.28, 'YOUR HOME .', WHITE, 10.5),
        headlineRun('h-b', 1.40, 0.34, 1.22, 0.28, 'YOUR LIGHTS', ORANGE, 10.5),
      ],
    }),
  },
  {
    id: 'starter-nw-4',
    name: 'Permanent Lights',
    category: 'Eye-Catching',
    is_starter: true,
    format: '4x6',
    front: frontHouse(
      [img('mascot', `${ART}/mascot-season.png`, 3.48, 1.42, 2.46, 2.54, 3, 'contain', { aspect: 1763 / 1919 })],
      [
        bubbleCopy('mascot', [0.07, 0.07, 0.56, 0.24], '{{hi_name}}\nChange the Look.\nOne Tap. Any Season.'),
      ],
    ),
    back: backWaveA({
      subY: 0.78,
      lines: [
        headlineRun('h-a', 0.18, 0.18, 2.55, 0.28, 'PERMANENT LIGHTS', ORANGE, 12.5),
        headlineRun('h-b', 0.12, 0.44, 2.65, 0.28, 'ENDLESS POSSIBILITIES', WHITE, 12.5),
      ],
    }),
  },
];
