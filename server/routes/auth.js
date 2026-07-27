import { Router } from 'express';
import { authSignUp, authSignIn } from '../db/index.js';

const router = Router();

router.post('/signup', async (req, res) => {
  const { email = '', password = '', name = '' } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'missing_fields' });
  if (password.length < 6) return res.status(400).json({ error: 'weak_password', detail: 'Use at least 6 characters.' });
  try {
    await authSignUp({ email, password, name });
    const session = await authSignIn({ email, password });
    res.json({ ok: true, ...session });
  } catch (err) {
    res.status(400).json({ error: 'signup_failed', detail: String(err.message || err) });
  }
});

router.post('/login', async (req, res) => {
  const { email = '', password = '' } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'missing_fields' });
  try {
    const session = await authSignIn({ email, password });
    res.json({ ok: true, ...session });
  } catch (err) {
    res.status(401).json({ error: 'login_failed', detail: String(err.message || err) });
  }
});

export default router;
