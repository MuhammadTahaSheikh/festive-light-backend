import { Router } from 'express';
import {
  PACKAGE_CARDS,
  SLIDER_MIN,
  SLIDER_MAX,
  SLIDER_STEP,
  LOW_BALANCE_THRESHOLD,
  quotePurchase,
  validatePromoCode,
} from '../services/creditPackages.js';
import {
  getCreditBalance,
  addCredits,
  listCreditTransactions,
} from '../db/credits.js';
import {
  STARTING_CREDITS,
  CREDITS_PER_RENDER,
  BILLING_MODE,
  STRIPE_SECRET_KEY,
} from '../config/env.js';
import {
  stripeEnabled,
  createCreditCheckoutSession,
  fulfillCheckoutSession,
} from '../services/stripeCheckout.js';

const router = Router();

function accountKey(req) {
  return req.headers['x-account-email'] || req.body?.accountEmail || 'default';
}

router.get('/balance', async (req, res) => {
  try {
    const key = accountKey(req);
    const acct = await getCreditBalance(key, STARTING_CREDITS);
    res.json({
      ok: true,
      balance: acct.balance,
      lowBalance: acct.balance <= LOW_BALANCE_THRESHOLD,
      lowBalanceThreshold: LOW_BALANCE_THRESHOLD,
      creditsPerRender: CREDITS_PER_RENDER,
      billingMode: BILLING_MODE,
      stripeEnabled: Boolean(STRIPE_SECRET_KEY),
    });
  } catch (err) {
    res.status(500).json({ error: 'credits_failed', detail: String(err.message || err) });
  }
});

router.get('/packages', (_req, res) => {
  const cards = PACKAGE_CARDS.map((p) => {
    const q = quotePurchase(p.credits);
    return { ...p, ...q };
  });
  res.json({
    ok: true,
    cards,
    slider: { min: SLIDER_MIN, max: SLIDER_MAX, step: SLIDER_STEP },
    creditsPerRender: CREDITS_PER_RENDER,
  });
});

router.post('/quote', (req, res) => {
  const { credits = SLIDER_MIN, promoCode = '' } = req.body || {};
  const promo = validatePromoCode(promoCode);
  const q = quotePurchase(credits, promo?.percentOff || 0);
  res.json({ ok: true, quote: q, promo: promo || null });
});

router.post('/purchase', async (req, res) => {
  const { credits = SLIDER_MIN, promoCode = '', demoConfirm = false } = req.body || {};
  const key = accountKey(req);
  const promo = validatePromoCode(promoCode);
  const q = quotePurchase(credits, promo?.percentOff || 0);

  if (BILLING_MODE === 'demo' || demoConfirm) {
    try {
      const result = await addCredits(key, q.credits, 'purchase', {
        total: q.total,
        promo: promo?.code || null,
        demo: true,
      });
      res.json({ ok: true, purchased: q.credits, balance: result.balance, quote: q, demo: true });
    } catch (err) {
      res.status(500).json({ error: 'purchase_failed', detail: String(err.message || err) });
    }
    return;
  }

  if (!stripeEnabled()) {
    return res.status(402).json({
      error: 'payment_required',
      detail: 'Set STRIPE_SECRET_KEY (sk_test_...) and BILLING_MODE=stripe in .env, or BILLING_MODE=demo for instant test purchases.',
      quote: q,
    });
  }

  try {
    const checkout = await createCreditCheckoutSession(
      { accountKey: key, quote: q, promoCode: promo?.code || '' },
      req,
    );
    res.json({ ok: true, checkoutUrl: checkout.checkoutUrl, sessionId: checkout.sessionId, quote: q });
  } catch (err) {
    res.status(500).json({ error: 'stripe_checkout_failed', detail: String(err.message || err), quote: q });
  }
});

router.post('/purchase/confirm', async (req, res) => {
  const { sessionId = '' } = req.body || {};
  if (!sessionId) {
    return res.status(400).json({ error: 'session_required', detail: 'Missing Stripe session id.' });
  }
  if (!stripeEnabled()) {
    return res.status(400).json({ error: 'stripe_not_configured', detail: 'Stripe is not configured.' });
  }
  try {
    const result = await fulfillCheckoutSession(sessionId);
    if (!result.ok) {
      return res.status(402).json({ error: 'payment_incomplete', detail: 'Payment not completed yet.', ...result });
    }
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: 'confirm_failed', detail: String(err.message || err) });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const txs = await listCreditTransactions(accountKey(req));
    res.json({ ok: true, transactions: txs });
  } catch (err) {
    res.status(500).json({ error: 'credits_failed', detail: String(err.message || err) });
  }
});

export default router;
