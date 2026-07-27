import { Router } from 'express';
import { discoverInPolygon, discoverNeighbors } from '../services/discovery.js';
import { geocodeAddress } from '../services/maps.js';

const router = Router();

router.post('/area', async (req, res) => {
  const { polygon = [], limit = 500 } = req.body || {};
  const cap = Math.min(Math.max(1, Number(limit) || 500), 1500);
  try {
    const result = await discoverInPolygon(polygon, cap);
    res.json({ ok: true, ...result });
  } catch (err) {
    const code = err.code || 'discovery_failed';
    res.status(code === 'invalid_polygon' ? 400 : 500).json({
      error: code,
      detail: String(err.message || err),
    });
  }
});

router.post('/neighbors', async (req, res) => {
  const { lat, lng, address = '', count = 250 } = req.body || {};
  let resolvedLat = lat;
  let resolvedLng = lng;
  try {
    if ((resolvedLat == null || resolvedLng == null) && address.trim()) {
      const geo = await geocodeAddress(address.trim());
      if (!geo) return res.status(404).json({ error: 'address_not_found' });
      resolvedLat = geo.lat;
      resolvedLng = geo.lng;
    }
    if (resolvedLat == null || resolvedLng == null) {
      return res.status(400).json({ error: 'missing_location' });
    }
    const cap = Math.min(Math.max(1, Number(count) || 250), 1500);
    const result = await discoverNeighbors(resolvedLat, resolvedLng, cap);
    res.json({ ok: true, lat: resolvedLat, lng: resolvedLng, ...result });
  } catch (err) {
    res.status(500).json({ error: 'discovery_failed', detail: String(err.message || err) });
  }
});

export default router;
