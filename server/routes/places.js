import { Router } from 'express';
import { GOOGLE_MAPS_API_KEY } from '../config/env.js';
import { autocompleteAddress, placeDetails } from '../services/maps.js';

const router = Router();

router.get('/autocomplete', async (req, res) => {
  const input = String(req.query.q || '').trim();
  if (input.length < 3) return res.json({ suggestions: [] });
  try {
    const suggestions = await autocompleteAddress(input);
    res.json({ suggestions });
  } catch (err) {
    res.status(502).json({ error: 'places_error', detail: err.detail || String(err) });
  }
});

router.get('/details', async (req, res) => {
  if (!GOOGLE_MAPS_API_KEY) {
    return res.status(500).json({ error: 'server_not_configured', detail: 'GOOGLE_MAPS_API_KEY is missing.' });
  }
  const placeId = String(req.query.placeId || '').trim();
  if (!placeId) return res.status(400).json({ error: 'missing_place_id' });
  try {
    const details = await placeDetails(placeId);
    res.json(details);
  } catch (err) {
    res.status(502).json({ error: 'places_error', detail: err.detail || String(err) });
  }
});

export default router;
