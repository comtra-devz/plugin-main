#!/usr/bin/env node
/**
 * Verifica configurazione invio email (Resend) per magic link.
 * Carica .env dalla cartella admin-dashboard se esiste.
 * Uso: node scripts/verify-email-config.mjs [email_di_test]
 *      oppure imposta TEST_EMAIL e lancia: node scripts/verify-email-config.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Resend } from 'resend';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Carica .env dalla root admin-dashboard
function loadEnv() {
  const envPath = join(__dirname, '..', '.env');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) {
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      process.env[m[1].trim()] = val;
    }
  });
}

loadEnv();

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'Comtra Admin <onboarding@resend.dev>';
const BASE_URL = process.env.ADMIN_DASHBOARD_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
const TEST_EMAIL = process.argv[2] || process.env.TEST_EMAIL;

function mask(s) {
  if (!s || s.length < 8) return '(non impostato)';
  return s.slice(0, 4) + '…' + s.slice(-4);
}

console.log('--- Verifica configurazione email (Resend) ---\n');

let ok = true;

if (!RESEND_API_KEY) {
  console.log('❌ RESEND_API_KEY: mancante');
  ok = false;
} else {
  console.log('✅ RESEND_API_KEY:', mask(RESEND_API_KEY));
}

console.log('✅ RESEND_FROM:', RESEND_FROM || '(usa default onboarding@resend.dev)');

if (!BASE_URL) {
  console.log('❌ ADMIN_DASHBOARD_URL / VERCEL_URL: mancante (serve per il link nell\'email)');
  ok = false;
} else {
  console.log('✅ Base URL:', BASE_URL);
}

if (!ok) {
  console.log('\nImposta le variabili mancanti e riprova.');
  process.exit(1);
}

if (!TEST_EMAIL || !TEST_EMAIL.includes('@')) {
  console.log('\n⚠️  Per provare l\'invio, passa un\'email: node scripts/verify-email-config.mjs tua@email.com');
  console.log('   Oppure imposta TEST_EMAIL e rilancia.');
  process.exit(0);
}

console.log('\nInvio email di test a:', TEST_EMAIL);

const resend = new Resend(RESEND_API_KEY);
const { data, error } = await resend.emails.send({
  from: RESEND_FROM,
  to: [TEST_EMAIL],
  subject: 'Test configurazione - Comtra Admin',
  html: `
    <p>Questa è un’email di test.</p>
    <p>Se la ricevi, la configurazione Resend per il magic link è corretta.</p>
    <p>— Comtra Admin</p>
  `,
});

if (error) {
  console.error('\n❌ Errore Resend:', error.message);
  process.exit(1);
}

console.log('\n✅ Email inviata con successo. Controlla la casella (e lo spam) di', TEST_EMAIL);
process.exit(0);
