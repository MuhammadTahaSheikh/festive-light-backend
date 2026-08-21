// Detailed, bulb-accurate color descriptions for Gemini; short labels for Cloudflare.
// Wording mirrors Light Launch (lightlaunch.ai) — the strict C9-track language is what
// forces individual roofline bulbs instead of a vague glow.

const BULB_GLOW = 'Each LED emits a high-intensity pin-size point with a bright, clean four-point star sparkle and strong realistic bloom. The physical fixture remains almost invisible — never an exposed bulb, globe, recessed can light, spotlight, or fuzzy glowing orb.';
const STRICT_NO_ADJACENT = 'CRITICAL: never place two bulbs of the same color next to each other; every single bulb is a different color from both of its neighbors.';
const STRICT_TRACK = 'Identical even spacing between all bulbs, like one continuous factory-programmed C9 light track.';

const BRIGHT_DIM_1_3_TAIL = [
  'Identical even spacing between all pin LEDs in one continuous flush soffit track (NOT C9 bulbs, NOT a second lighting system).',
  'Bright bulbs (every 4th only): stronger pin-points with bloom, each casting ONE downward wash cone / scallop onto the wall below — the wash must be the SAME hue as the LED (never a separate warm-white downlight).',
  'Dim bulbs (the three between each bright): faint pin-points at roughly 10–15% intensity — tiny dots under the eave ONLY. FORBIDDEN on dim bulbs: wash cones, scallops, blooms, or pools of light on the wall.',
  'Count groups along each edge: BRIGHT, dim, dim, dim, BRIGHT, dim, dim, dim. Keep that cadence unbroken around corners and peaks.',
  'FORBIDDEN: making every LED equally bright. FORBIDDEN: a scalloped wash cone under every LED. FORBIDDEN: adding red/colored edge bulbs plus a separate row of warm-white soffit downlights — that dual look is wrong.',
  'If the garage eave shows equal warm cones under every fixture, or a string of exposed C9 bulbs on the fascia, the render failed — redo as one flush pin-LED track with 1-bright-3-dim only.',
].join(' ');

function normalizeHex(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  return m ? `#${m[1].toLowerCase()}` : null;
}

function hexToRgb(hex) {
  const h = normalizeHex(hex);
  if (!h) return null;
  const n = parseInt(h.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function hexLuma(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
}

function colorLabel(c) {
  if (!c) return null;
  if (c.name && c.hex) return `${c.name} (${c.hex})`;
  if (c.name) return c.name;
  if (c.hex) return c.hex;
  return null;
}

/** Hex is authoritative for bright-dim color; optional name is only a label. */
function describeBrightDimColor(customColors) {
  const c = Array.isArray(customColors) && customColors.length ? customColors[0] : null;
  const hex = normalizeHex(c?.hex);
  const rgb = hexToRgb(hex);
  const luma = hexLuma(hex);
  const label = c?.name ? String(c.name).trim() : '';

  // Default / empty → warm white
  if (!hex || hex === '#fff3d6') {
    return 'All bulbs are warm white (#fff3d6) — only brightness varies, never hue. Do not change the color.';
  }

  // Near-black: models often illegally "fix" this to warm white — lock it hard.
  if (luma != null && luma < 0.08) {
    return [
      `CRITICAL COLOR LOCK: user selected near-black ${hex}${label ? ` (labeled "${label}")` : ''}.`,
      'Do NOT substitute warm white, amber, gold, or creamy yellow — that is incorrect.',
      'Render LED emission as deep charcoal / near-black with a faint cool blue-gray glow on the bright bulbs only; dim bulbs nearly extinguished (tiny cool pin-points).',
      'Zero amber, yellow, or warm-white tint anywhere in the added LED light.',
    ].join(' ');
  }

  const rgbText = rgb ? `RGB(${rgb.r}, ${rgb.g}, ${rgb.b})` : hex;
  return [
    `CRITICAL COLOR LOCK: every LED emission must match hex ${hex} (${rgbText})${label ? ` — labeled "${label}"` : ''}.`,
    'The color-picker hex is authoritative; do not ignore it.',
    'Only brightness varies between bright and dim bulbs — hue stays identical.',
    'FORBIDDEN: falling back to warm white, amber, or any other color than the selected hex.',
  ].join(' ');
}

function describeBrightDim1_3(customColors) {
  return [
    'LOOK: permanent architectural soffit pin-LEDs only — one flush track under the eaves, NOT holiday C9 bulbs, NOT recessed can downlights.',
    'BRIGHTNESS PATTERN (mandatory): one full-brightness LED, then three dim LEDs, then repeat — exactly 1-bright-3-dim without interruption on every lit edge.',
    'Every fourth LED is the bright “hero” with a wall-wash cone; the three between are dim filler dots with no wall wash.',
    describeBrightDimColor(customColors),
    'The wall-wash cones under bright LEDs must tint the same color as those LEDs (e.g. red LEDs → red-tinted wash). Never paint warm-white cones under colored LEDs.',
    BRIGHT_DIM_1_3_TAIL,
  ].join(' ');
}

function shortBrightDim1_3(customColors) {
  const c = Array.isArray(customColors) && customColors.length ? customColors[0] : null;
  const hex = normalizeHex(c?.hex);
  const luma = hexLuma(hex);
  let color = 'warm white';
  if (hex && hex !== '#fff3d6') {
    if (luma != null && luma < 0.08) {
      color = `near-black ${hex} cool charcoal glow, NEVER warm white`;
    } else {
      color = hex;
    }
  }
  return `${color} permanent LEDs, strict 1-bright-3-dim pattern, ONLY every 4th LED bright with wall-wash cone, other three faint pin-points NO scallop wash, never equal brightness`;
}

const SCHEME_DESC = {
  'warm-white': `Warm white only. ${BULB_GLOW} Warm glow onto facade.`,
  'bright-dim-1-3': describeBrightDim1_3(null),
  'cool-white': `Cool bright white only — crisp daylight-balanced white LEDs. ${BULB_GLOW} Clean modern glow onto facade.`,
  'july-4th': `Permanent LED bulbs in a STRICT repeating three-color sequence along every lit edge: red, then white, then blue, then red, then white, then blue — exactly that order, repeating without interruption. ${STRICT_NO_ADJACENT} ${STRICT_TRACK} Each color crisp and saturated. ${BULB_GLOW} Patriotic Fourth of July color scheme. Subtle red, white and blue glow onto facade.`,
  'st-patricks': `Permanent LED bulbs in a STRICT alternating two-color sequence along every lit edge: emerald green, then gold, then emerald green, then gold — exactly every other bulb, repeating without interruption. ${STRICT_NO_ADJACENT} ${STRICT_TRACK} Rich saturated St. Patrick's Day colors. ${BULB_GLOW} Festive green and gold glow onto facade.`,
  christmas: `Permanent LED bulbs in a STRICT alternating two-color sequence along every lit edge: classic Christmas red, then green, then red, then green — exactly every other bulb, repeating without interruption. ${STRICT_NO_ADJACENT} ${STRICT_TRACK} Rich saturated holiday colors. ${BULB_GLOW} Festive red and green glow onto facade.`,
  halloween: `Permanent LED bulbs in a STRICT alternating two-color sequence along every lit edge: orange, then purple, then orange, then purple — exactly every other bulb, repeating without interruption. ${STRICT_NO_ADJACENT} ${STRICT_TRACK} Rich saturated Halloween colors. ${BULB_GLOW} Spooky orange and purple glow onto facade.`,
  holiday: `Permanent LED bulbs in a STRICT repeating four-color sequence along every lit edge: red, then green, then gold, then warm white, then repeat — exactly that order without interruption. ${STRICT_NO_ADJACENT} ${STRICT_TRACK} Each color crisp and saturated. ${BULB_GLOW} Warm festive glow onto facade.`,
};

const SHORT_COLOR = {
  'warm-white': 'warm white',
  'bright-dim-1-3': 'warm white with strict 1 bright 3 dim repeating brightness pattern and scalloped wall wash cones',
  'cool-white': 'cool bright white',
  'july-4th': 'strict alternating red, white and blue',
  'st-patricks': 'strict alternating emerald green and gold',
  christmas: 'strict alternating red and green',
  halloween: 'strict alternating orange and purple',
  holiday: 'strict alternating red, green, gold and white',
};

const SINGLE_HOUSE = [
  'CRITICAL — ONE HOUSE ONLY: if more than one building is visible, add lights ONLY on the primary home that dominates the center of the frame (clearest front facade facing the camera).',
  'Neighboring houses, attached duplex mates, and houses at the edges of the frame must stay completely dark — no bulbs, no glow, no trim lights on them.',
].join(' ');

const PERMANENT_ROOFLINE = [
  'ONLY CHANGE: add a professionally installed permanent architectural LED system beneath the soffits/eaves, gable rakes, dormers, and visible front-facing architectural ledges of that single target house.',
  'Match this installation style exactly: a straight row of individual, clearly SEPARATED pin-point LEDs set flush inside a concealed color-matched aluminum track. The track hugs the underside and outer edge of each eave.',
  'CRITICAL SPACING: the LEDs are spaced roughly 8 inches apart (about 3 to 4 LEDs per linear foot). There must be a clear dark gap between each individual light so the separate dots can be counted — this is a row of distinct points, NOT a continuous glowing line, light bar, ribbon, or solid strip.',
  'The fixtures themselves are almost invisible. No hanging string, exposed wire, C9 bulb, globe bulb, recessed can, puck spotlight, large circular fixture, icicle light, or rope-light strip.',
  'Trace the real architecture pixel-accurately. Each individual LED must shine at high brightness as its own brilliant defined point, with a clean small four-point star sparkle and strong warm-white halo like the reference installation. Add a clearly visible, brighter warm wash beneath the trim, while preserving a dark unlit gap between every LED. The lights must be the brightest visual feature of the photo. Do not merge the dots into a solid line and do not create large isolated spotlight cones or pools down the walls.',
  'Follow every eave and gable angle, including the garage and entry rooflines visible on the front facade, keeping the same evenly spaced separated dots along each edge.',
  SINGLE_HOUSE,
].join(' ');

/** Same placement/spacing as permanent, but brightness matches 1-bright / 3-dim soffit installs (cones on bright LEDs only). */
const PERMANENT_ROOFLINE_BRIGHT_DIM = [
  'ONLY CHANGE: add ONE professionally installed permanent architectural LED track beneath the soffits/eaves, gable rakes, dormers, and visible front-facing architectural ledges of that single target house.',
  'ONE SYSTEM ONLY: a single straight row of individual, clearly SEPARATED pin-point LEDs set flush inside a concealed color-matched aluminum track under each eave. Do not add any second lighting layer.',
  'CRITICAL SPACING: LEDs about 8 inches apart (3–4 per linear foot) with a clear dark gap between each countable pin-point — not a continuous strip or light bar.',
  'FORBIDDEN FIXTURES: C9 bulbs, globe bulbs, exposed holiday bulbs on the fascia edge, recessed can lights, puck spotlights, hanging strings, icicles, rope lights, or a separate warm-white downlight row.',
  'CRITICAL BRIGHTNESS PATTERN (the whole point): along every lit edge repeat exactly 1 FULL-BRIGHT LED → 3 DIM LEDs (~10–15% intensity) → repeat. Never equal brightness on every LED.',
  'WALL WASH: only every 4th (bright) LED casts a soft downward scalloped wash cone; that wash is tinted the LED color. Dim LEDs are faint pin-points with no wash cones.',
  'WRONG RESULTS TO AVOID: (1) red/colored bulbs on the roof edge plus warm-white equal cones under the soffit; (2) every LED casting the same cone; (3) any C9-style bulb look.',
  'Trace the real architecture pixel-accurately. Follow every eave and gable angle on the front facade, including garage and entry rooflines.',
  SINGLE_HOUSE,
].join(' ');

const CHRISTMAS_FASCIA = [
  'Add the Christmas roofline lights directly ON the visible fascia boards at the outside edge of every eave, rake, gable, dormer, garage roof, and porch roof of the single target house.',
  'CRITICAL PLACEMENT: every light follows the face or lower edge of the fascia exactly. Do not place lights on shingles, roof surfaces, ridges, walls, windows, or floating above or below the fascia.',
  'CRITICAL SPACING: use individual clearly separated LED points at consistent 8-inch centers (about 3 to 4 lights per linear foot), matching the permanent-light spacing. Preserve a visible dark gap between neighboring points so every light can be counted; never form a solid strip or merged glowing line.',
  'Each point shines brightly with a clean small four-point sparkle and strong festive halo, while the wire and clips remain discreet. Follow every corner and roof angle continuously without sagging, dangling loops, icicles, or oversized bulbs.',
  'Keep the house architecture and all existing features unchanged.',
  SINGLE_HOUSE,
].join(' ');

const DECORATIVE_ROOFLINE = [
  'ONLY CHANGE: add professionally installed C9-style decorative LED bulbs along every roof edge, eave, gable peak, dormer, and visible architectural ledge of that single target house.',
  'Trace the real architecture pixel-accurately — bulbs must sit directly ON each roofline, cornice, belt course, window lintel, and horizontal molding line.',
  'For multi-story buildings: light every horizontal ledge and cornice on each floor, not just the top roof.',
  'Individual visible bulbs in an even factory-programmed track with consistent spacing — never a vague glow, never floating above the architecture.',
  'Follow every angle change at corners and peaks exactly; do not skip any visible edge on the front facade of the target house.',
  SINGLE_HOUSE,
].join(' ');

/** Neon = classic permanent placement, continuous thin tube instead of pin dots. */
const NEON_ROOFLINE = [
  'ONLY CHANGE: add a professionally installed permanent architectural LED neon-flex system beneath the soffits/eaves, gable rakes, dormers, and visible front-facing architectural ledges of that single target house.',
  'Match this installation placement exactly like permanent lighting: a concealed color-matched aluminum track that hugs the UNDERSIDE and outer edge of each eave — same mount location as classic pin LEDs.',
  'THE ONLY STYLE DIFFERENCE FROM CLASSIC: instead of separated pin-point LEDs, the track holds one thin CONTINUOUS warm neon-flex tube (silicone neon) — a slim unbroken glowing line under the soffit.',
  'CRITICAL — DO NOT CHANGE THE HOUSE: keep the exact source roof silhouette, peaks, pitch, fascia, shingles, house number, walls, and camera angle. Do not rebuild or thicken the roof. Do not place light on top of shingles or ridges. The original fascia/shingle edge must stay fully visible.',
  'The physical tube/housing is almost invisible. No hanging string, exposed wire, C9 bulb, globe bulb, recessed can, puck spotlight, icicle light, fat neon-sign ribbon, or thick brush-stroke glow.',
  'Trace the real architecture pixel-accurately. Soft restrained bloom only — do not obscure or redraw the roof edge. Add a clearly visible warmer wash beneath the trim onto the wall, like classic permanent lighting. The lights must be the brightest visual feature of the photo.',
  'Follow every eave and gable angle, including the garage and entry rooflines visible on the front facade, along each existing edge only.',
  SINGLE_HOUSE,
].join(' ');

const CHRISTMAS_NEON_FASCIA = [
  'Add a thin continuous LED neon-flex tube on the lower edge / underside of every EXISTING fascia board — same placement as classic Christmas fascia lights, continuous tube instead of spaced bulbs.',
  'CRITICAL PLACEMENT: follow the face or lower edge of the fascia exactly. Do not place lights on shingles, roof surfaces, ridges, walls, or windows. Do not reshape the roof.',
  'Keep the house architecture and all existing features unchanged.',
  SINGLE_HOUSE,
].join(' ');

function describeNeonColors(scheme, customColors) {
  if (scheme === 'bright-dim-1-3') {
    // Neon tubes don't do 1-bright-3-dim; use the selected color as a continuous tube.
    const c = Array.isArray(customColors) && customColors.length ? customColors[0] : null;
    const hex = normalizeHex(c?.hex) || '#fff3d6';
    const label = c?.name ? String(c.name).trim() : '';
    if (hex === '#fff3d6' && !label) {
      return 'Continuous warm-white neon-flex tube (#fff3d6) under every eave — same warm white as permanent lighting, continuous form only. Soft local wash under the eave. Not orange, not sepia.';
    }
    return `Continuous neon-flex tube in ${label ? `${label} (${hex})` : hex} under every eave — even brightness with subtle same-color local wash into gable faces only.`;
  }
  if (scheme === 'custom' && Array.isArray(customColors) && customColors.length) {
    const names = customColors
      .map((c) => (c && c.name ? `${c.name} (${c.hex})` : c && c.hex ? c.hex : null))
      .filter(Boolean);
    if (names.length === 1) {
      return `Continuous neon-flex tube in ${names[0]} under every eave with subtle same-color local wash onto the facade beneath.`;
    }
    if (names.length) {
      return `Continuous neon-flex tubes in a repeating color sequence under every eave: ${names.join(', then ')}, then repeat — soft continuous glow with subtle local wall wash (not individual bulbs).`;
    }
  }
  const neonScheme = {
    'warm-white': 'Warm white only continuous neon-flex (#fff3d6). Clean warm glow with restrained bloom — never a fat neon-sign ribbon on the roof edge. Warm glow onto facade beneath the trim.',
    'cool-white': 'Continuous cool bright-white neon-flex tube under every eave with subtle soft white local wash onto the facade beneath. Keep natural house colors.',
    'july-4th': 'Continuous neon-flex tubes in a repeating red, white, and blue sequence under every eave — soft continuous glow with subtle local wall wash, not individual bulbs.',
    'st-patricks': 'Continuous neon-flex tubes alternating emerald green and gold under every eave with subtle local wall wash.',
    christmas: 'Continuous neon-flex tubes alternating classic Christmas red and green under every eave with subtle local wall wash.',
    halloween: 'Continuous neon-flex tubes alternating orange and purple under every eave with subtle local wall wash.',
    holiday: 'Continuous neon-flex tubes in a repeating red, green, gold, and warm-white sequence under every eave with subtle local wall wash.',
  };
  return neonScheme[scheme] || neonScheme['warm-white'];
}

function shortNeonColor(scheme, customColors) {
  if (scheme === 'bright-dim-1-3') {
    const c = Array.isArray(customColors) && customColors.length ? customColors[0] : null;
    const hex = normalizeHex(c?.hex);
    return (hex && hex !== '#fff3d6' ? hex : 'warm white') + ' thin continuous neon-flex under eaves, blue-hour dusk, subtle local wash';
  }
  if (scheme === 'custom' && Array.isArray(customColors) && customColors.length) {
    const names = customColors.map((c) => (c && c.name ? c.name : c && c.hex ? c.hex : null)).filter(Boolean);
    if (names.length) return 'thin continuous neon-flex ' + names.join(' and ') + ' under eaves';
  }
  const map = {
    'warm-white': 'warm-white #fff3d6 thin continuous neon-flex under eaves, blue-hour dusk, subtle local gable wash, photorealistic permanent lighting look',
    'cool-white': 'cool white thin continuous neon-flex under eaves with subtle local wash',
    'july-4th': 'red white blue continuous neon-flex under eaves',
    'st-patricks': 'green and gold continuous neon-flex under eaves',
    christmas: 'red and green continuous neon-flex under eaves',
    halloween: 'orange and purple continuous neon-flex under eaves',
    holiday: 'multicolor continuous neon-flex under eaves',
  };
  return map[scheme] || 'warm-white #fff3d6 thin continuous neon-flex under eaves, blue-hour dusk, subtle local gable wash, photorealistic permanent lighting look';
}

function describeColors(scheme, customColors) {
  if (scheme === 'bright-dim-1-3') {
    return describeBrightDim1_3(customColors);
  }
  if (scheme === 'custom' && Array.isArray(customColors) && customColors.length) {
    const names = customColors
      .map((c) => (c && c.name ? `${c.name} (${c.hex})` : c && c.hex ? c.hex : null))
      .filter(Boolean);
    if (names.length === 1) {
      return `All bulbs ${names[0]}. ${BULB_GLOW} Even colored glow onto facade.`;
    }
    if (names.length) {
      return `Permanent LED bulbs in a STRICT repeating sequence along every lit edge: ${names.join(', then ')}, then repeat — exactly that order without interruption. ${STRICT_NO_ADJACENT} ${STRICT_TRACK} ${BULB_GLOW}`;
    }
  }
  return SCHEME_DESC[scheme] || SCHEME_DESC['warm-white'];
}

function shortColor(scheme, customColors) {
  if (scheme === 'bright-dim-1-3') return shortBrightDim1_3(customColors);
  if (scheme === 'custom' && Array.isArray(customColors) && customColors.length) {
    const names = customColors.map((c) => (c && c.name ? c.name : c && c.hex ? c.hex : null)).filter(Boolean);
    if (names.length) return 'strict alternating ' + names.join(' and ');
  }
  return SHORT_COLOR[scheme] || 'warm white';
}

const PRESERVE_HOUSE = [
  'Edit this exact photo. Do NOT redesign, restyle, or reimagine the house or yard.',
  'PRESERVE EXACTLY: house shape, roof lines, garage, windows, doors, siding/stucco color and texture, driveway, walkways, plants, trees, shrubs, mulch beds, palm trees, and camera angle. The outdoor garden and landscaping must stay pixel-identical in layout — do not replace, remove, or redesign plants.',
  'CRITICAL ROOF LOCK: keep the exact source roof geometry — same peaks, hips, ridges, gables, pitch, and silhouette. Do NOT add a new gable, second roof on top, extra peak behind an existing one, or convert a hip roof into a front gable. Do NOT raise, lower, widen, or rebuild any roof section. House number stays identical.',
].join(' ');

/** Soft preserve for Describe mode — same photo identity; homeowner text drives everything else. */
const PRESERVE_HOUSE_FOR_PROMPT = [
  'This is an image-edit task on a real house photo.',
  'Keep the same house identity and camera angle so it is clearly still this home — do not replace it with a different building or a drawing.',
].join(' ');

/** Landscape = wrap foundation bushes only. Trees stay completely dark. */
const LANDSCAPE_FRONT_BUSHES_ONLY = [
  'LANDSCAPE LIGHTING (strict): wrap existing bushes and shrubs that sit EXACTLY in front of the house — foundation plantings directly under the front windows and along the front facade — with dense string/net lights matching the roofline color.',
  'CRITICAL — TREES STAY COMPLETELY DARK: do NOT wrap, uplight, sparkle, or add any lights to trees of any kind (large yard trees, leafless deciduous trees, evergreens, palms, or small trees). Trunks and branches must remain unlit natural silhouettes.',
  'FORBIDDEN: lighting bushes that are not exactly in front of the house (garage-end, side-yard, driveway-end, or far-left/far-right yard shrubs stay unlit).',
  'Keep existing path/stake lights along the driveway or walk if adding landscape lighting. Do not add new plants or redesign landscaping.',
].join(' ');

/** Sanitize optional free-text direction from the Describe mode. */
export function sanitizeUserPrompt(raw) {
  if (raw == null) return '';
  const text = String(raw).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.slice(0, 800);
}

/** Fully dynamic prompt mode: homeowner text is the brief. */
function buildFromUserPrompt(userText, short = false) {
  if (short) {
    return [
      'edit this exact house photo',
      'follow this request exactly: ' + userText,
      'photorealistic, same house recognizable',
    ].join(', ');
  }
  return [
    PRESERVE_HOUSE_FOR_PROMPT,
    'PRIMARY INSTRUCTION — follow this homeowner request as literally and completely as possible. Add, change, or style whatever they describe (lights, decor, weather, season, furniture accents, colors, mood, time of day, etc.):',
    `"${userText}"`,
    'Include every detail they named. Do not ignore parts of the request. Do not fall back to a default holiday-bulb look unless they asked for that.',
    'Output a photorealistic edited photo of this same home matching their request.',
  ].join(' ');
}

/** Full prompt for a strong editing model (Gemini) — Light Launch style: edit lights only. */
export function buildRenderPrompt({ scheme, customColors, landscape, decor, decorColor, serviceType = 'permanent', userPrompt, lightStyle = 'classic' }) {
  const custom = sanitizeUserPrompt(userPrompt);
  if (custom) return buildFromUserPrompt(custom, false);

  const isNeon = lightStyle === 'neon';
  const colorText = isNeon ? describeNeonColors(scheme, customColors) : describeColors(scheme, customColors);
  const isPermanent = serviceType === 'permanent';
  const isChristmas = serviceType === 'christmas' || scheme === 'christmas';
  const isCoolWhite = scheme === 'cool-white';
  const isBrightDim = !isNeon && scheme === 'bright-dim-1-3';
  const rooflineInstructions = isNeon
    ? (isChristmas ? CHRISTMAS_NEON_FASCIA : NEON_ROOFLINE)
    : isChristmas
      ? CHRISTMAS_FASCIA
      : isPermanent
        ? (isBrightDim ? PERMANENT_ROOFLINE_BRIGHT_DIM : PERMANENT_ROOFLINE)
        : DECORATIVE_ROOFLINE;
  const brightDimHex = isBrightDim && Array.isArray(customColors) && customColors[0]
    ? normalizeHex(customColors[0].hex)
    : null;
  const brightDimIsDark = brightDimHex && hexLuma(brightDimHex) != null && hexLuma(brightDimHex) < 0.08;
  const brightDimIsCustomColor = Boolean(brightDimHex && brightDimHex !== '#fff3d6');

  // For bright-dim, lead with color + pattern so the model doesn't fall back to dual C9 + warm cans.
  // For neon, lead with geometry lock so the model does not rebuild the roof when adding continuous tubes.
  const lines = isBrightDim
    ? [
      PRESERVE_HOUSE,
      colorText,
      rooflineInstructions,
    ]
    : isNeon
      ? [
        PRESERVE_HOUSE,
        rooflineInstructions,
        colorText,
      ]
      : [
        PRESERVE_HOUSE,
        rooflineInstructions,
        colorText,
      ];
  // Same daytime→evening ambient for classic and neon (neon only differs in roofline tube vs pins).
  let ambientEvening = isCoolWhite
    ? 'Shift ambient light to blue-hour dusk with a deep blue evening sky. Preserve the source sky dynamically: if the original photo has clouds, keep those same clouds; if the original sky is clear with no clouds, leave it clear — never invent clouds and never erase real ones. Use crisp neutral/cool white LEDs around 5000K with clean white wall wash; absolutely no amber, yellow, or warm tint in the exterior lights. Keep any existing window light subtle. Not daytime, not pitch-black night.'
    : isBrightDim && (brightDimIsDark || brightDimIsCustomColor)
      ? 'Shift ambient light to blue-hour dusk with a deep blue evening sky so the bulbs read clearly. Preserve the source sky dynamically: keep clouds only if they already exist in the original photo; if there are no clouds, do not add any. Keep any existing window light subtle. The ADDED roofline LED color must follow the COLOR LOCK above — do not warm-tint those LEDs to amber or warm white. Not daytime, not pitch-black night.'
      : 'Shift ambient light to blue-hour dusk with a deep blue evening sky. Soft dusk light so the house and yard stay readable, while the warm roofline LEDs remain the brightest eye-catching feature. Preserve the source sky dynamically: if the original photo has clouds, keep those same clouds; if the original sky is clear with no clouds, leave it clear — never invent clouds and never erase real ones. Keep any existing window light subtle. Natural realistic lighting — not neon, not cartoon, not daytime, not pitch-black night.';
  // Neon reuses the exact classic evening prompt; only drop the classic "not neon" ban so continuous tubes aren't blocked.
  if (isNeon) {
    ambientEvening = ambientEvening.replace(' — not neon, not cartoon,', ' — not cartoon,');
  }

  lines.push(
    ambientEvening,
    isNeon
      ? 'The thin neon-flex tube must follow the exact contour of each eave and gable rake — same path a professional permanent-lighting installer would run under the soffit.'
      : 'The LED track must follow the exact contour of each architectural line — same path a professional installer would measure with a tape measure along the eaves.',
  );
  if (isBrightDim) {
    lines.push('FINAL CHECK: single flush pin-LED soffit track; 1 bright + 3 dim; wash cones only on bright LEDs and same color as LEDs; no C9 bulbs; no extra warm-white soffit downlights.');
  }
  if (isNeon) {
    lines.push('FINAL CHECK: same house roof as source (do not rebuild top); neon-flex ONLY under soffit like classic permanent track — thin continuous tube NOT fat ribbon on the roof edge; same blue-hour evening + subtle window glow as classic; no pin LEDs.');
  } else {
    lines.push('FINAL CHECK: roof geometry must match the source photo exactly — no new gable, no second roof on top, no converted hip-to-gable; only add lights under the existing eaves.');
  }
  if (landscape) {
    lines.push(
      isBrightDim
        ? LANDSCAPE_FRONT_BUSHES_ONLY + ' Ground/plant lighting only. Do NOT add warm soffit cans, wall washes, or any second roofline system.'
        : LANDSCAPE_FRONT_BUSHES_ONLY
    );
  } else if (serviceType !== 'christmas') {
    lines.push(isNeon
      ? 'Do NOT add landscape lighting, path lights, or change the garden beds. Roofline lights only.'
      : 'Do NOT add landscape lighting, path lights, or change the garden beds. Roofline bulbs only.');
  }
  if (serviceType === 'holiday') {
    lines.push('Add tasteful holiday accents only on existing features: light garland along the front entry railing or porch if present. No inflatables, no new structures, no redesigned landscaping.');
  }
  if (decor === 'christmas' || serviceType === 'christmas') {
    const decorText = decorColor === 'multicolor' ? 'multicolor' : 'warm white';
    lines.push(`Add Christmas decor on existing features only: lit wreath on the front door, light garland on entry columns or railings with ${decorText} lights, and wrap ONLY existing bushes/shrubs sitting exactly in front of the house (foundation plantings under the front windows) with ${decorText} string lights. Do NOT wrap or light any trees. Do not add new plants, inflatables, or structures.`);
  }
  lines.push('Photorealistic output only. Same house, same garden — lights and decor on the single target house only.');
  return lines.join(' ');
}

/** Short prompt for Stable Diffusion img2img — pack in as much bulb specificity as SD allows. */
export function buildShortPrompt({ scheme, customColors, landscape, decor, decorColor, serviceType = 'permanent', userPrompt, lightStyle = 'classic' }) {
  const custom = sanitizeUserPrompt(userPrompt);
  if (custom) return buildFromUserPrompt(custom, true);

  const isNeon = lightStyle === 'neon';
  const colorText = isNeon ? shortNeonColor(scheme, customColors) : shortColor(scheme, customColors);
  const isPermanent = serviceType === 'permanent';
  const isChristmas = serviceType === 'christmas' || scheme === 'christmas';
  const isBrightDim = !isNeon && scheme === 'bright-dim-1-3';
  const bits = [
    'exact same house photo, same garden and plants unchanged, exact same roof geometry no new gables or second roof on top',
    isNeon
      ? (isChristmas
        ? 'mount continuous soft golden LED neon-flex under every fascia eave gable dormer garage and porch roof edge of the main center house, soft wash into walls beneath, never outline windows, never add landscape uplights, never individual bulbs'
        : 'exact same house roof unchanged, add thin continuous warm-white neon-flex in concealed soffit track under eaves like permanent lighting not on shingles, blue-hour dusk, restrained bloom, NOT pin LEDs, NOT fat neon ribbon')
      : isChristmas
      ? 'mount individual bright Christmas LED points directly on the visible face or lower edge of every fascia board on each eave gable dormer garage and porch roof of the main center house, consistent 8-inch centers with a clear dark gap between countable points, clean small four-point sparkle and strong festive halo, discreet wire and clips, never on shingles roof surfaces ridges walls or windows, never a solid strip merged line sagging loop icicle or oversized bulb'
      : isPermanent && isBrightDim
      ? 'ONE system only: flush pin-size permanent LEDs in concealed soffit track under eaves/gables of main center house, 8-inch spacing, STRICT 1-bright-then-3-dim pattern, only every 4th LED bright with same-color wall-wash cone, other three faint dots no wash, NEVER C9 bulbs, NEVER separate warm-white downlight row, never equal brightness, never dual lighting systems'
      : isPermanent
      ? 'only add a row of individual clearly separated pin-size permanent LED points set flush in concealed trim track tight beneath every eave and gable of the main center house, spaced about 8 inches apart with a dark gap between each dot so the points are countable, distinct dots NOT a continuous line light bar ribbon or solid strip, each LED shines at high brightness as a brilliant defined point with clean small four-point star sparkle and strong warm-white halo plus clearly visible warm trim wash, lights are the brightest feature, almost invisible physical fixtures, never merged glowing lines, downlights, recessed cans, spotlights, hanging strings, globes, or bulbs'
      : 'only add individual visible C9 LED bulbs with even factory-programmed spacing on every roofline eave gable cornice and horizontal architectural ledge of the main center house only',
    'do not light neighboring or adjacent houses — leave them completely dark',
    isNeon
      ? colorText + ', soft realistic neon bloom, photorealistic architectural neon'
      : colorText + ' LEDs, small crisp light points with restrained realistic bloom',
    'do not redesign landscaping or architecture',
    scheme === 'cool-white'
      ? 'blue-hour dusk deep blue sky, preserve original clouds or clear sky exactly, 5000K crisp white exterior lighting, clean white wall wash, no amber or yellow tint, photorealistic'
      : 'blue-hour dusk deep blue sky, preserve original clouds or clear sky exactly no invented clouds, warm LEDs eye-catching, soft dusk not pitch black, subtle existing windows, photorealistic',
  ];
  if (landscape) bits.push('string/net lights ONLY on existing bushes exactly in front of the house, NO lights on any trees, path stake lights ok, no new plants');
  if (decor === 'christmas' || serviceType === 'christmas') {
    bits.push('wreath, garland, wrap only front-of-house bushes not trees with ' + (decorColor === 'multicolor' ? 'multicolor' : 'warm white') + ' lights');
  }
  if (serviceType === 'holiday') bits.push('light garland at entry only, no new structures');
  return bits.join(', ');
}
