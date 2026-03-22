/**
 * Invia email con magic link (Resend).
 * Env: RESEND_API_KEY, RESEND_FROM (es. "Comtra Admin <noreply@tudominio.com>"), ADMIN_DASHBOARD_URL (base URL della dashboard).
 */
import { Resend } from 'resend';
import { sanitizeAdminRedirectPath } from './sanitize-redirect.mjs';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM || 'Comtra Admin <onboarding@resend.dev>';
const BASE_URL = process.env.ADMIN_DASHBOARD_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

export function canSendEmail() {
  return !!resend && !!BASE_URL;
}

/**
 * Invia magic link all'email. Restituisce { ok: true } o { ok: false, error }.
 */
export async function sendMagicLinkEmail(toEmail, magicLinkToken, redirectPath) {
  if (!resend) return { ok: false, error: 'RESEND_API_KEY non configurato' };
  if (!BASE_URL) return { ok: false, error: 'ADMIN_DASHBOARD_URL o VERCEL_URL non configurato' };

  const safeRedirect = sanitizeAdminRedirectPath(redirectPath || '');
  const q = new URLSearchParams({ token: magicLinkToken });
  if (safeRedirect) q.set('redirect', safeRedirect);
  const link = `${BASE_URL.replace(/\/$/, '')}/auth/verify?${q.toString()}`;

  const { data, error } = await resend.emails.send({
    from: FROM,
    to: [toEmail],
    subject: 'Link per accedere alla dashboard Comtra Admin',
    html: `
      <p>Ciao,</p>
      <p>È stato richiesto un link per accedere alla dashboard Comtra Admin.</p>
      <p><a href="${link}" style="font-weight:bold;">Clicca qui per accedere</a></p>
      <p>Il link scade tra 15 minuti. Se non hai richiesto tu l'accesso, ignora questa email.</p>
      <p>— Comtra Admin</p>
    `,
  });

  if (error) {
    return { ok: false, error: 'Impossibile inviare l\'email. Riprova più tardi.' };
  }
  return { ok: true };
}

const ADMIN_RECHARGE_EMAIL = 'admin@comtra.dev';

/**
 * Invia il PIN per conferma ricarica crediti admin a admin@comtra.dev.
 * Restituisce { ok: true } o { ok: false, error }.
 */
export async function sendRechargePinEmail(pin, amount, userEmailMasked, expiresAt) {
  if (!resend) return { ok: false, error: 'RESEND_API_KEY non configurato' };

  const expiresFormatted = expiresAt ? new Date(expiresAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '5 min';

  const { data, error } = await resend.emails.send({
    from: FROM,
    to: [ADMIN_RECHARGE_EMAIL],
    subject: `[Comtra Admin] PIN ricarica crediti: ${amount} crediti – scade tra 5 min`,
    html: `
      <p>È stata richiesta una ricarica crediti da dashboard.</p>
      <p><strong>Utente:</strong> ${userEmailMasked || '—'}</p>
      <p><strong>Crediti:</strong> ${amount}</p>
      <p><strong>PIN (valido 5 minuti):</strong> <code style="font-size:1.2em;background:#eee;padding:4px 8px;">${pin}</code></p>
      <p>Scadenza: ${expiresFormatted}. Inserisci il PIN nella modale per confermare.</p>
      <p>— Comtra Admin</p>
    `,
  });

  if (error) {
    return { ok: false, error: 'Impossibile inviare l\'email. Riprova più tardi.' };
  }
  return { ok: true };
}
