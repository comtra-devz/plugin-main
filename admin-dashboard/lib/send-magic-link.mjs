/**
 * Invia email con magic link (Resend).
 * Env: RESEND_API_KEY, RESEND_FROM (es. "Comtra Admin <noreply@tudominio.com>"), ADMIN_DASHBOARD_URL (base URL della dashboard).
 */
import { Resend } from 'resend';

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
export async function sendMagicLinkEmail(toEmail, magicLinkToken) {
  if (!resend) return { ok: false, error: 'RESEND_API_KEY non configurato' };
  if (!BASE_URL) return { ok: false, error: 'ADMIN_DASHBOARD_URL o VERCEL_URL non configurato' };

  const link = `${BASE_URL.replace(/\/$/, '')}/auth/verify?token=${encodeURIComponent(magicLinkToken)}`;

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
