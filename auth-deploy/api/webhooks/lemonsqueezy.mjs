/**
 * Lemon Squeezy webhook: order_created → incrementa total_referrals per l'affiliato
 * (codice in meta.custom_data.aff, passato da checkout con checkout[custom][aff] e ?aff=)
 *
 * Variabili: LEMON_SQUEEZY_WEBHOOK_SECRET (signing secret del webhook in LS)
 */
import crypto from 'node:crypto';
import { sql } from '@vercel/postgres';

export const config = { api: { bodyParser: false } };

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

  const affCode = payload?.meta?.custom_data?.aff;
  if (!affCode || typeof affCode !== 'string') {
    res.status(200).json({ ok: true, no_affiliate: true });
    return;
  }

  const code = affCode.trim();
  if (!code) {
    res.status(200).json({ ok: true });
    return;
  }

  try {
    const r = await sql`
      UPDATE affiliates
      SET total_referrals = total_referrals + 1,
          updated_at = NOW()
      WHERE affiliate_code = ${code}
      RETURNING user_id, total_referrals
    `;
    if (r.rowCount > 0) {
      res.status(200).json({ ok: true, affiliate_user_id: r.rows[0].user_id, total_referrals: r.rows[0].total_referrals });
    } else {
      res.status(200).json({ ok: true, no_match: true });
    }
  } catch (err) {
    console.error('Webhook affiliates update', err);
    res.status(500).json({ error: 'Database error' });
  }
}
