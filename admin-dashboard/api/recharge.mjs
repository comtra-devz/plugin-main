/**
 * POST /api/recharge – richiesta PIN (step request) e conferma ricarica (step confirm).
 * Solo admin. Body: { step: 'request'|'confirm', user_id, amount [, pin] }.
 * request: genera PIN, salva hash, invia email a admin@comtra.dev, ritorna { ok, expires_at }.
 * confirm: verifica PIN, incrementa credits_total, log in credit_transactions, cooldown 12h, crea user_credit_gifts.
 */
import { createHash } from 'crypto';
import { sql } from '../lib/db.mjs';
import { requireAdmin } from '../lib/admin-auth.mjs';
import { sendRechargePinEmail } from '../lib/send-magic-link.mjs';

const PIN_LENGTH = 6;
const PIN_TTL_MINUTES = 5;
const COOLDOWN_HOURS = 12;

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
}

function maskEmail(email) {
  if (!email || typeof email !== 'string') return '—';
  const t = email.trim();
  if (!t) return '—';
  const at = t.indexOf('@');
  if (at <= 0) return t.slice(0, 2) + '***';
  const local = t.slice(0, at);
  const domain = t.slice(at);
  if (local.length <= 2) return local + '***' + domain;
  return local.slice(0, 2) + '***' + domain;
}

function generatePin() {
  const digits = '0123456789';
  let s = '';
  for (let i = 0; i < PIN_LENGTH; i++) s += digits[Math.floor(Math.random() * digits.length)];
  return s;
}

function hashPin(pin) {
  return createHash('sha256').update(String(pin).trim()).digest('hex');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await requireAdmin(req, res))) return;

  if (!sql) return res.status(503).json({ error: 'Database not configured' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const step = (body.step || '').toLowerCase();
  const userId = (body.user_id || '').trim();
  const amount = Math.max(0, Math.floor(Number(body.amount) || 0));

  if (!userId) return res.status(400).json({ error: 'user_id required' });
  if (amount <= 0) return res.status(400).json({ error: 'amount must be positive' });

  if (step === 'request') {
    // Cooldown 12h: non creare nuovo PIN se ultima ricarica < 12h fa
    const userRow = await sql`
      SELECT last_admin_recharge_at, email FROM users WHERE id = ${userId} LIMIT 1
    `;
    const u = userRow?.rows?.[0];
    if (!u) return res.status(404).json({ error: 'User not found' });
    const lastAt = u.last_admin_recharge_at ? new Date(u.last_admin_recharge_at) : null;
    if (lastAt) {
      const cooldownEnd = new Date(lastAt.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000);
      if (new Date() < cooldownEnd) {
        return res.status(429).json({
          error: 'Ricarica consentita solo dopo 12 ore dall\'ultima',
          cooldown_until: cooldownEnd.toISOString(),
        });
      }
    }

    const pin = generatePin();
    const pinHash = hashPin(pin);
    const expiresAt = new Date(Date.now() + PIN_TTL_MINUTES * 60 * 1000);

    await sql`
      INSERT INTO admin_recharge_pins (user_id, amount, pin_hash, expires_at)
      VALUES (${userId}, ${amount}, ${pinHash}, ${expiresAt})
    `;

    const emailResult = await sendRechargePinEmail(
      pin,
      amount,
      maskEmail(u.email),
      expiresAt
    );
    if (!emailResult.ok) {
      return res.status(500).json({ error: emailResult.error || 'Invio email fallito' });
    }

    return res.status(200).json({ ok: true, expires_at: expiresAt.toISOString() });
  }

  if (step === 'confirm') {
    const pin = (body.pin || '').trim();
    if (!pin) return res.status(400).json({ error: 'pin required' });

    const pinHash = hashPin(pin);
    const now = new Date();

    const pins = await sql`
      SELECT id, user_id, amount FROM admin_recharge_pins
      WHERE user_id = ${userId} AND amount = ${amount} AND pin_hash = ${pinHash} AND expires_at > ${now}
      LIMIT 1
    `;
    const row = pins?.rows?.[0];
    if (!row) {
      return res.status(400).json({ error: 'PIN non valido o scaduto' });
    }

    const userRow = await sql`SELECT credits_total, credits_used FROM users WHERE id = ${userId} LIMIT 1`;
    const user = userRow?.rows?.[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const newTotal = (Number(user.credits_total) || 0) + amount;
    const used = Number(user.credits_used) || 0;
    const creditsRemaining = Math.max(0, newTotal - used);

    await sql`UPDATE users SET credits_total = ${newTotal}, last_admin_recharge_at = NOW(), updated_at = NOW() WHERE id = ${userId}`;
    await sql`
      INSERT INTO credit_transactions (user_id, action_type, credits_consumed)
      VALUES (${userId}, 'admin_recharge', ${-amount})
    `;
    await sql`
      INSERT INTO user_credit_gifts (user_id, credits_added) VALUES (${userId}, ${amount})
    `;
    await sql`DELETE FROM admin_recharge_pins WHERE id = ${row.id}`;

    return res.status(200).json({
      ok: true,
      credits_total: newTotal,
      credits_remaining: creditsRemaining,
    });
  }

  return res.status(400).json({ error: 'step must be request or confirm' });
}
