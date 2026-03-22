/**
 * POST /api/admin-auth — Magic link (fase 1) + login password/2FA (fase 2).
 * Magic link:
 * - request-magic-link: { email } → invia email con link, risponde sempre { ok: true } se email valida
 * - verify-magic-link: { token } → scambia token link con session JWT
 */
import { sql } from '../lib/db.mjs';
import {
  getAdminByEmail,
  verifyPassword,
  createTotpSecret,
  verifyTotp,
  getTotpUri,
  createTempToken,
  createSetupToken,
  verifyTempToken,
  createSessionToken,
  updateUserTotp,
  createMagicLinkToken,
  verifyMagicLinkToken,
} from '../lib/admin-session.mjs';
import { sendMagicLinkEmail } from '../lib/send-magic-link.mjs';
import { sanitizeAdminRedirectPath } from '../lib/sanitize-redirect.mjs';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method === 'GET') return res.status(200).json({ ok: true, service: 'admin-auth' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Vercel a volte inietta req.body già parsato; altrimenti leggi lo stream
  let body = req.body && typeof req.body === 'object' ? req.body : null;
  if (!body) body = await parseBody(req);
  const action = (body.action || '').toLowerCase();

  const allowedActions = ['request-magic-link', 'verify-magic-link', 'login', 'verify-2fa', 'setup-2fa', 'confirm-2fa'];
  if (!allowedActions.includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  const allowedEmailFromEnv = (process.env.ALLOWED_ADMIN_EMAIL || '').trim().toLowerCase();

  if (!sql && action !== 'verify-magic-link' && !(action === 'request-magic-link' && allowedEmailFromEnv)) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    if (action === 'request-magic-link') {
      const email = (body.email || '').trim().toLowerCase();
      if (!email) return res.status(400).json({ error: 'Email richiesta' });
      let sub = null;
      let emailToUse = null;
      if (allowedEmailFromEnv && email === allowedEmailFromEnv) {
        sub = 'admin';
        emailToUse = email;
      } else if (sql) {
        const user = await getAdminByEmail(email);
        if (user) {
          sub = user.id;
          emailToUse = user.email;
        }
      }
      if (!sub || !emailToUse) {
        return res.status(200).json({ ok: true });
      }
      const magicToken = await createMagicLinkToken({ sub, email: emailToUse });
      const redirectAfterLogin = sanitizeAdminRedirectPath(body.redirect || body.next || '');
      const sent = await sendMagicLinkEmail(emailToUse, magicToken, redirectAfterLogin || undefined);
      if (!sent.ok) {
        console.error('sendMagicLinkEmail', sent.error);
        return res.status(500).json({
          error: sent.error || 'Impossibile inviare l\'email. Riprova più tardi.',
        });
      }
      return res.status(200).json({ ok: true });
    }

    if (action === 'verify-magic-link') {
      const token = (body.token || '').trim();
      if (!token) return res.status(400).json({ error: 'Token richiesto' });
      const payload = await verifyMagicLinkToken(token);
      if (!payload || !payload.email) {
        return res.status(401).json({ error: 'Link non valido o scaduto. Richiedi un nuovo link.' });
      }
      const sessionToken = await createSessionToken({ sub: payload.sub, email: payload.email });
      return res.status(200).json({ token: sessionToken });
    }

    if (action === 'login') {
      const email = (body.email || '').trim().toLowerCase();
      const password = body.password;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }
      const user = await getAdminByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Credenziali non valide' });
      }
      const ok = await verifyPassword(password, user.password_hash);
      if (!ok) {
        return res.status(401).json({ error: 'Credenziali non valide' });
      }
      const tempToken = await createTempToken({ sub: user.id, email: user.email });
      if (user.totp_secret) {
        return res.status(200).json({ need2FA: true, tempToken });
      }
      return res.status(200).json({ need2FA: 'setup', tempToken });
    }

    if (action === 'setup-2fa') {
      const tempToken = (body.tempToken || '').trim();
      if (!tempToken) return res.status(400).json({ error: 'tempToken required' });
      const payload = await verifyTempToken(tempToken);
      if (!payload || payload.purpose !== '2fa') {
        return res.status(401).json({ error: 'Token non valido o scaduto' });
      }
      const secret = createTotpSecret();
      const user = await getAdminByEmail(payload.email);
      if (!user) return res.status(401).json({ error: 'Utente non trovato' });
      const qrUrl = getTotpUri({ secret, email: user.email });
      const setupToken = await createSetupToken({
        sub: user.id,
        email: user.email,
        purpose: '2fa-setup',
        pendingSecret: secret,
      });
      return res.status(200).json({ qrUrl, secret, setupToken });
    }

    if (action === 'confirm-2fa') {
      const setupToken = (body.setupToken || '').trim();
      const code = (body.code || '').trim();
      if (!setupToken || !code) {
        return res.status(400).json({ error: 'setupToken and code required' });
      }
      const payload = await verifyTempToken(setupToken);
      if (!payload || payload.purpose !== '2fa-setup' || !payload.pendingSecret) {
        return res.status(401).json({ error: 'Token non valido o scaduto' });
      }
      const valid = await verifyTotp(payload.pendingSecret, code);
      if (!valid) {
        return res.status(401).json({ error: 'Codice 2FA non valido' });
      }
      await updateUserTotp(payload.sub, payload.pendingSecret);
      const token = await createSessionToken({ sub: payload.sub, email: payload.email });
      return res.status(200).json({ token });
    }

    if (action === 'verify-2fa') {
      const tempToken = (body.tempToken || '').trim();
      const code = (body.code || '').trim();
      if (!tempToken || !code) {
        return res.status(400).json({ error: 'tempToken and code required' });
      }
      const payload = await verifyTempToken(tempToken);
      if (!payload || payload.purpose !== '2fa') {
        return res.status(401).json({ error: 'Token non valido o scaduto' });
      }
      const user = await getAdminByEmail(payload.email);
      if (!user || !user.totp_secret) {
        return res.status(401).json({ error: '2FA non configurata' });
      }
      const valid = await verifyTotp(user.totp_secret, code);
      if (!valid) {
        return res.status(401).json({ error: 'Codice 2FA non valido' });
      }
      const token = await createSessionToken({ sub: user.id, email: user.email });
      return res.status(200).json({ token });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('POST /api/admin-auth', action, err);
    return res.status(500).json({ error: 'Server error' });
  }
}
