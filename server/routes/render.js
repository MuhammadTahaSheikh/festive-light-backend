import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { GOOGLE_MAPS_API_KEY } from '../config/env.js';
import { RENDERS_DIR } from '../config/paths.js';
import { activeProvider, doRender } from '../services/render.js';
import { fetchStreetViewImage, geocodeAddress, placeDetails } from '../services/maps.js';
import { fetchBuildingSqft } from '../services/property.js';
import { resolveStreetViewForAddress } from '../services/streetviewValidate.js';
import { estimateRooflineFeet, wholeHouseFeet, priceFromFeet } from '../services/pricing.js';
import { saveRender, updateCampaignHome, deductCredits, addCredits } from '../db/index.js';
import { CREDITS_PER_RENDER, DEFAULT_PRICE_PER_FOOT } from '../config/env.js';
import { createdByFromReq } from '../util/createdBy.js';
import { sendDesignQuoteEmail } from '../services/email.js';
import { sendLightUpTeamsAlert } from '../services/teams.js';

function accountKey(req) {
  return req.headers['x-account-email'] || req.body?.accountEmail || 'default';
}

const router = Router();

router.post('/', async (req, res) => {
  const previewOnly = Boolean(req.body?.previewOnly);

  if (!previewOnly && activeProvider() === 'none') {
    return res.status(500).json({ error: 'server_not_configured', detail: 'No render provider configured (set Cloudflare or Gemini keys).' });
  }

  const {
    address = '',
    imageBase64 = '',
    placeId = '',
    lat = null,
    lng = null,
    pricePerFoot = 0,
    scheme = 'warm-white',
    customColors = [],
    landscape = false,
    decor = 'none',
    decorColor = 'warm-white',
    serviceType = 'permanent',
    campaignHomeId = '',
    userPrompt = '',
    lightStyle = 'classic',
  } = req.body || {};

  const resolvedLightStyle = lightStyle === 'neon' ? 'neon' : 'classic';

  let formattedAddress = address;
  let resolvedLat = lat;
  let resolvedLng = lng;

  let creditsCharged = false;
  let addressBuilding = null;
  let streetViewMeta = null;

  try {
    let srcBuffer = null;
    let srcMime = 'image/jpeg';

    if (imageBase64) {
      const m = String(imageBase64).match(/^data:(image\/[a-z0-9.+-]+);base64,(.*)$/i);
      if (m) { srcMime = m[1]; srcBuffer = Buffer.from(m[2], 'base64'); }
      else { srcBuffer = Buffer.from(imageBase64, 'base64'); }
      if (!srcBuffer || srcBuffer.length < 100) {
        return res.status(400).json({ error: 'bad_image' });
      }
      // Additive only: resolve coords for footage when a photo is used with an address.
      // Does not change Street View / address-only flow below.
      if (GOOGLE_MAPS_API_KEY && (placeId || address) && (resolvedLat == null || resolvedLng == null)) {
        try {
          if (placeId) {
            const details = await placeDetails(placeId);
            formattedAddress = details.formattedAddress || formattedAddress;
            if (details.location) {
              resolvedLat = details.location.lat;
              resolvedLng = details.location.lng;
            }
          }
          if ((resolvedLat == null || resolvedLng == null) && address) {
            const geo = await geocodeAddress(address);
            if (geo) {
              resolvedLat = geo.lat;
              resolvedLng = geo.lng;
              formattedAddress = geo.formattedAddress || address;
            }
          }
        } catch (e) {
          console.warn('[render] photo-path geocode skipped:', e.message);
        }
      }
    } else if (GOOGLE_MAPS_API_KEY) {
      if (placeId) {
        const details = await placeDetails(placeId);
        formattedAddress = details.formattedAddress || formattedAddress;
        if (details.location) {
          resolvedLat = details.location.lat;
          resolvedLng = details.location.lng;
        }
      }
      let location = (resolvedLat != null && resolvedLng != null) ? `${resolvedLat},${resolvedLng}` : null;
      if (!location && address) {
        const geo = await geocodeAddress(address);
        if (geo) {
          resolvedLat = geo.lat;
          resolvedLng = geo.lng;
          location = `${geo.lat},${geo.lng}`;
          formattedAddress = geo.formattedAddress || address;
        }
      }
      if (resolvedLat == null || resolvedLng == null) {
        return res.status(404).json({ error: 'address_not_found' });
      }
      const sv = await resolveStreetViewForAddress(
        { lat: resolvedLat, lng: resolvedLng, address: formattedAddress },
        fetchStreetViewImage,
        // Preview skips Gemini house-check + heading retries (Maps cost only).
        { skipVisualCheck: previewOnly },
      );
      if (!sv.ok) {
        const isNoHouse = sv.status === 'NO_HOUSE_VISIBLE';
        return res.status(404).json({
          error: isNoHouse ? 'no_house_found' : 'no_streetview',
          detail: isNoHouse
            ? 'No house found at this location. The view may show mostly street or empty area — try a different address or upload a photo.'
            : sv.status,
        });
      }
      srcBuffer = sv.buffer;
      srcMime = sv.mimeType;
      addressBuilding = sv.building || null;
      streetViewMeta = {
        heading: sv.heading ?? null,
        verifiedAddress: sv.verifiedAddress || null,
      };
    } else {
      return res.status(400).json({ error: 'no_photo', detail: 'Upload a photo of the home.' });
    }

    let outputBuffer = srcBuffer;
    let outputMime = srcMime;

    if (!previewOnly) {
      if (campaignHomeId) {
        try {
          await deductCredits(accountKey(req), CREDITS_PER_RENDER, 'render', { address: formattedAddress || address, campaignHomeId });
          creditsCharged = true;
        } catch (e) {
          if (e.code === 'insufficient_credits') {
            return res.status(402).json({
              error: 'insufficient_credits',
              balance: e.balance,
              required: e.required,
              detail: `You need ${e.required} credit(s) but only have ${e.balance}. Buy more credits to continue.`,
            });
          }
          throw e;
        }
      }
      const rendered = await doRender(srcBuffer, srcMime, {
        scheme, customColors, landscape, decor, decorColor, serviceType, userPrompt,
        lightStyle: resolvedLightStyle,
      });
      outputBuffer = rendered.buffer;
      outputMime = rendered.mimeType;
    }

    const ext = outputMime.includes('png') ? 'png' : 'jpg';
    const filename = `${crypto.randomUUID()}.${ext}`;
    fs.writeFileSync(path.join(RENDERS_DIR, filename), outputBuffer);

    let buildingMetrics = null;
    let buildingSqft = null;
    let roofSqft = null;
    let sqftSource = null;
    if (resolvedLat != null && resolvedLng != null) {
      try {
        const prop = addressBuilding || await fetchBuildingSqft(resolvedLat, resolvedLng);
        if (prop) {
          buildingMetrics = prop;
          buildingSqft = prop.sqft;
          roofSqft = prop.roofSqft;
          sqftSource = prop.source;
        }
      } catch (e) {
        console.warn('[render] fetchBuildingSqft failed:', e.message);
      }
    }

    const frontFeet = estimateRooflineFeet(formattedAddress || address, buildingMetrics);
    const wholeFeet = wholeHouseFeet(frontFeet);
    const rate = Number(pricePerFoot) > 0 ? Number(pricePerFoot) : (campaignHomeId ? DEFAULT_PRICE_PER_FOOT : 0);
    const frontPrice = priceFromFeet(frontFeet, rate);
    const wholePrice = priceFromFeet(wholeFeet, rate);
    const imageUrl = `/renders/${filename}`;

    let quoteId = null;
    if (!previewOnly) {
      try {
        const saved = await saveRender({
          address: formattedAddress,
          image_url: imageUrl,
          scheme,
          landscape,
          decor,
          roofline_feet: frontFeet,
          price_per_foot: rate || null,
          estimated_total: frontPrice,
          lead_email: (req.body && req.body.email) || null,
          created_by: createdByFromReq(req),
        });
        quoteId = saved?.id || null;
        if (campaignHomeId && quoteId) {
          try {
            await updateCampaignHome(campaignHomeId, {
              render_id: quoteId,
              status: 'rendered',
              estimated_total: frontPrice || null,
            });
          } catch (e) {
            console.warn('[render] link campaign home failed:', e.message);
          }
        }
        // Additive: email design + quote to the visitor. Never blocks the response.
        const leadEmail = (req.body && req.body.email) || null;
        const leadName = (req.body && req.body.name) || '';
        const leadPhone = (req.body && req.body.phone) || '';
        const quoteStats = {
          frontFeet,
          wholeFeet,
          frontPrice,
          wholePrice,
          rooflineFeet: frontFeet,
          estimatedTotal: frontPrice,
        };
        if (leadEmail && quoteId) {
          sendDesignQuoteEmail({
            to: leadEmail,
            address: formattedAddress,
            imageUrl,
            quoteId,
            stats: quoteStats,
          }).catch((e) => console.warn('[email] design quote send failed:', e.message));
        }
        // Additive: Teams channel alert for sales. Never blocks the response.
        if (quoteId) {
          sendLightUpTeamsAlert({
            address: formattedAddress,
            name: leadName,
            email: leadEmail || '',
            phone: leadPhone,
            imageUrl,
            quoteId,
            stats: quoteStats,
          }).catch((e) => console.warn('[teams] light-up alert failed:', e.message));
        }
      } catch (e) {
        console.error('[render] saveRender failed:', e.message);
      }
    }

    res.json({
      ok: true,
      preview: previewOnly,
      imageUrl,
      quoteId,
      address: formattedAddress,
      streetView: streetViewMeta,
      stats: {
        frontFeet,
        wholeFeet,
        pricePerFoot: rate || null,
        frontPrice,
        wholePrice,
        rooflineFeet: frontFeet,
        estimatedTotal: frontPrice,
        buildingSqft,
        roofSqft,
        sqftSource,
        perimeterFt: buildingMetrics?.perimeterFt ?? null,
      },
    });
  } catch (err) {
    console.error('[render] error:', err);
    if (!previewOnly && creditsCharged && err.code !== 'insufficient_credits') {
      try {
        await addCredits(accountKey(req), CREDITS_PER_RENDER, 'render_refund', { reason: String(err.message || err) });
      } catch (refundErr) {
        console.warn('[render] credit refund failed:', refundErr.message);
      }
    }
    if (err.code === 'insufficient_credits') {
      return res.status(402).json({
        error: 'insufficient_credits',
        balance: err.balance,
        required: err.required,
      });
    }
    res.status(500).json({ error: 'render_failed', detail: String(err.message || err) });
  }
});

export default router;
