/**
 * Lemon Squeezy webhook: order_created
 * 1) Aggiorna l'acquirente: plan=PRO, credits_total, plan_expires_at (match per email da custom_data o attributes.user_email)
 * 2) Incrementa total_referrals per l'affiliato se meta.custom_data.aff è presente
 *
 * Variabili: LEMON_SQUEEZY_WEBHOOK_SECRET (signing secret del webhook in LS)
 */
import crypto from 'node:crypto';
import { sql } from '@vercel/postgres';

export const config = { api: { bodyParser: false } };

// variant_id (Lemon) -> { credits_total, days } per plan_expires_at
const VARIANT_TO_PRO = {
  '1345293': { credits_total: 20, days: 7 },   // 1w
  '1345303': { credits_total: 100, days: 30 }, // 1m
  '1345310': { credits_total: 800, days: 180 }, // 6m
  '1345319': { credits_total: 2000, days: 365 }, // 1y
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function verifySignature(rawBody, signature, secret) {
  if (!secret || !signature) return false;
  const hmac = crypto.createHmac('sha256', secret);
  const computed = hmac.update(rawBody).digest('hex');
  if (computed.length !== signature.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('LEMON_SQUEEZY_WEBHOOK_SECRET not set');
    res.status(500).json({ error: 'Webhook not configured' });
    return;
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (e) {
    console.error('Webhook read body', e);
    res.status(400).json({ error: 'Invalid body' });
    return;
  }

  const signature = req.headers['x-signature'] || '';
  if (!verifySignature(rawBody, signature, secret)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  const eventName = payload?.meta?.event_name;
  if (eventName !== 'order_created') {
    res.status(200).json({ ok: true, ignored: eventName });
    return;
  }

  const attrs = payload?.data?.attributes || {};
  if (attrs.status !== 'paid') {
    res.status(200).json({ ok: true, status: attrs.status });
    return;
  }

  const customData = payload?.meta?.custom_data || {};
  const affCode = typeof customData.aff === 'string' ? customData.aff.trim() : null;
  const buyerEmail = (typeof customData.email === 'string' ? customData.email.trim() : null) || (typeof attrs.user_email === 'string' ? attrs.user_email.trim() : null) || null;

  const firstItem = attrs.first_order_item;
  const variantId = firstItem?.variant_id != null ? String(firstItem.variant_id) : null;
  const proConfig = variantId ? VARIANT_TO_PRO[variantId] : null;

  const result = { ok: true, buyer_updated: false, affiliate_updated: false };

  try {
    // 1) Aggiorna acquirente (plan PRO + crediti + scadenza) se abbiamo email e variant riconosciuto
    if (buyerEmail && proConfig) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + proConfig.days);
      const expiresIso = expiresAt.toISOString();
      const r = await sql`
        UPDATE users
        SET plan = 'PRO',
            credits_total = ${proConfig.credits_total},
            credits_used = 0,
            plan_expires_at = ${expiresIso},
            updated_at = NOW()
        WHERE LOWER(TRIM(email)) = LOWER(TRIM(${buyerEmail}))
        RETURNING id
      `;
      if (r.rowCount > 0) result.buyer_updated = true;
    }

    // 2) Incrementa referral affiliato se presente
    if (affCode) {
      const r = await sql`
        UPDATE affiliates
        SET total_referrals = total_referrals + 1,
            updated_at = NOW()
        WHERE affiliate_code = ${affCode}
        RETURNING user_id, total_referrals
      `;
      if (r.rowCount > 0) result.affiliate_updated = true;
    }

    res.status(200).json(result);
  } catch (err) {
    console.error('Webhook lemonsqueezy', err);
    res.status(500).json({ error: 'Database error' });
  }
}
