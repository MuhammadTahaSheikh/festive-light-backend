import 'dotenv/config';

export const PORT = process.env.PORT || 3000;
export const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
console.log('[env] GEMINI_API_KEY:', GEMINI_API_KEY || '(empty)');
export const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
export const MAX_FREE_RENDERS = Number(process.env.MAX_FREE_RENDERS || 3);

export const STARTING_CREDITS = Number(process.env.STARTING_CREDITS || 5);
export const CREDITS_PER_RENDER = Number(process.env.CREDITS_PER_RENDER || 1);
export const DEFAULT_PRICE_PER_FOOT = Number(process.env.DEFAULT_PRICE_PER_FOOT || 40);
export const BILLING_MODE = (process.env.BILLING_MODE || 'demo').toLowerCase();
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

export const RENDER_PROVIDER = (process.env.RENDER_PROVIDER || '').toLowerCase();
export const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
export const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
export const CF_IMAGE_MODEL = process.env.CLOUDFLARE_IMAGE_MODEL || '@cf/runwayml/stable-diffusion-v1-5-img2img';
export const CF_STRENGTH = Number(process.env.CF_STRENGTH || 0.4);
export const CF_GUIDANCE = Number(process.env.CF_GUIDANCE || 8);

export const SUPABASE_URL = process.env.SUPABASE_URL || '';
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const LOB_API_KEY = process.env.LOB_API_KEY || '';
export const LOB_MAIL_MODE = (process.env.LOB_MAIL_MODE || 'demo').toLowerCase();
export const LOB_MAIL_ALLOW_WARNINGS = String(process.env.LOB_MAIL_ALLOW_WARNINGS || 'false').toLowerCase() === 'true';
export const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || '';

/** BatchData — optional fallback property-owner lookup (https://batchdata.com). */
export const BATCHDATA_API_KEY = process.env.BATCHDATA_API_KEY || '';
export const BATCHDATA_SKIP_TRACE = String(process.env.BATCHDATA_SKIP_TRACE || 'false').toLowerCase() === 'true';

/** AssessorSearch — optional owner name lookup (https://assessorsearch.com). */
export const ASSESSORSEARCH_API_KEY = process.env.ASSESSORSEARCH_API_KEY || '';

/** ATTOM Data — property owner lookup (https://api.developer.attomdata.com). 30-day free trial. */
export const ATTOM_API_KEY = process.env.ATTOM_API_KEY || '';

/** attom | assessorsearch | batchdata | auto */
export const OWNER_LOOKUP_PROVIDER = (process.env.OWNER_LOOKUP_PROVIDER || 'attom').toLowerCase();

export const MAIL_FROM = {
  name: process.env.MAIL_FROM_NAME || 'Festive Lighting Pros',
  line1: process.env.MAIL_FROM_LINE1 || '123 Main Street',
  city: process.env.MAIL_FROM_CITY || 'Austin',
  state: process.env.MAIL_FROM_STATE || 'TX',
  zip: process.env.MAIL_FROM_ZIP || '78701',
};
