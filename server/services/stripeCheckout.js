import Stripe from 'stripe';
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, PUBLIC_BASE_URL } from '../config/env.js';
import { addCredits, listCreditTransactions } from '../db/credits.js';

let stripeClient = null;

export function stripeEnabled() {
  return Boolean(STRIPE_SECRET_KEY);
}

function getStripe() {
  if (!STRIPE_SECRET_KEY) return null;
  if (!stripeClient) stripeClient = new Stripe(STRIPE_SECRET_KEY);
  return stripeClient;
}

function appBaseUrl(req) {
  if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

export async function createCreditCheckoutSession({ accountKey, quote, promoCode = '' }, req) {
  const stripe = getStripe();
  if (!stripe) throw new Error('stripe_not_configured');

  const base = appBaseUrl(req);
  const successUrl = `${base}/app/billing?purchase=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${base}/app/billing?purchase=cancelled`;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(quote.total * 100),
          product_data: {
            name: `${quote.credits.toLocaleString()} AI render credits`,
            description: 'Festive Lighting Pros — outreach campaign credits',
          },
        },
      },
    ],
    metadata: {
      account_key: accountKey,
      credits: String(quote.credits),
      promo_code: promoCode || '',
      total: String(quote.total),
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: accountKey.includes('@') ? accountKey : undefined,
  });

  return { sessionId: session.id, checkoutUrl: session.url };
}

async function alreadyFulfilled(sessionId, accountKey) {
  const txs = await listCreditTransactions(accountKey, 200);
  return txs.some((t) => t.meta?.stripeSessionId === sessionId);
}

export async function fulfillCheckoutSession(sessionId) {
  const stripe = getStripe();
  if (!stripe) throw new Error('stripe_not_configured');

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== 'paid') {
    return { ok: false, reason: 'not_paid', status: session.payment_status };
  }

  const accountKey = session.metadata?.account_key || 'default';

  if (await alreadyFulfilled(sessionId, accountKey)) {
    const { getCreditBalance } = await import('../db/credits.js');
    const acct = await getCreditBalance(accountKey);
    return { ok: true, alreadyFulfilled: true, balance: acct.balance, purchased: Number(session.metadata?.credits || 0) };
  }

  const credits = Number(session.metadata?.credits || 0);
  if (!credits || credits <= 0) throw new Error('invalid_session_metadata');

  const result = await addCredits(accountKey, credits, 'purchase', {
    stripeSessionId: sessionId,
    total: Number(session.metadata?.total || 0) || session.amount_total / 100,
    promo: session.metadata?.promo_code || null,
    stripe: true,
  });

  return { ok: true, purchased: credits, balance: result.balance, accountKey };
}

export async function handleStripeWebhook(rawBody, signature) {
  const stripe = getStripe();
  if (!stripe) throw new Error('stripe_not_configured');
  if (!STRIPE_WEBHOOK_SECRET) throw new Error('webhook_secret_missing');

  const event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.payment_status === 'paid') {
      await fulfillCheckoutSession(session.id);
    }
  }
  return { received: true, type: event.type };
}
