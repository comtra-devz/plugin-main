#!/usr/bin/env node
/**
 * Legge le notifiche admin dalla dashboard (`/api/admin?route=notifications`)
 * e le invia a un canale Discord tramite webhook.
 *
 * Uso:
 *   node scripts/notify-discord-admin-notifications.mjs
 *
 * Richiede:
 *   - ADMIN_NOTIFICATIONS_WEBHOOK_URL nel .env (URL webhook Discord per notifiche)
 *   - VITE_ADMIN_API_URL (URL deploy admin, es. https://admin.comtra.dev)
 *   - VITE_ADMIN_SECRET (stesso segreto usato dalla dashboard / API admin)
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

function loadEnvVar(name) {
  if (process.env[name]) return;
  const envPath = resolve(repoRoot, '.env');
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+?)\\s*$`));
    if (m) {
      process.env[name] = m[1].replace(/^["']|["']$/g, '').trim();
      break;
    }
  }
}

loadEnvVar('ADMIN_NOTIFICATIONS_WEBHOOK_URL');
loadEnvVar('VITE_ADMIN_API_URL');
loadEnvVar('VITE_ADMIN_SECRET');

const WEBHOOK_URL = process.env.ADMIN_NOTIFICATIONS_WEBHOOK_URL;
const ADMIN_URL = (process.env.VITE_ADMIN_API_URL || '').replace(/\/$/, '');
const ADMIN_SECRET = process.env.VITE_ADMIN_SECRET || '';

if (!WEBHOOK_URL || !WEBHOOK_URL.startsWith('https://discord.com/api/webhooks/')) {
  console.error('Imposta ADMIN_NOTIFICATIONS_WEBHOOK_URL nel .env (URL webhook Discord per notifiche admin).');
  process.exit(1);
}
if (!ADMIN_URL) {
  console.error('Imposta VITE_ADMIN_API_URL nel .env (URL deploy dashboard admin, es. https://admin.comtra.dev).');
  process.exit(1);
}
if (!ADMIN_SECRET) {
  console.error('Imposta VITE_ADMIN_SECRET nel .env (stesso valore usato dalla dashboard per accedere alle API admin).');
  process.exit(1);
}

async function main() {
  const apiUrl = `${ADMIN_URL}/api/admin?route=notifications`;
  let data;
  try {
    const res = await fetch(apiUrl, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ADMIN_SECRET}`,
        'X-Admin-Key': ADMIN_SECRET,
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Errore API admin (${res.status}): ${text || 'nessun dettaglio'}`);
    }
    data = await res.json();
  } catch (err) {
    console.error('Impossibile leggere le notifiche admin:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const items = Array.isArray(data?.items) ? data.items : [];
  if (!items.length) {
    console.log('Nessuna notifica admin da inviare.');
    return;
  }

  const lines = [];
  lines.push('📣 **Comtra — notifiche admin**');
  lines.push('');

  for (const n of items) {
    const when = n.created_at
      ? new Date(n.created_at).toLocaleString('it-IT', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';
    const sev =
      n.severity === 'critical' ? '🟥 Critico' : n.severity === 'warning' ? '🟨 Avviso' : '🟦 Info';
    lines.push(`- ${sev} — **${n.title}**`);
    if (n.description) lines.push(`  ${n.description}`);
    if (when) lines.push(`  _(creata il ${when})_`);
    lines.push('');
  }

  const content = lines.join('\n').trim();
  const toSend = content.length > 2000 ? content.slice(0, 1990) + '\n… (troncato)' : content;

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: toSend }),
  });
  if (!res.ok) {
    console.error('Discord webhook errore:', res.status, await res.text());
    process.exit(1);
  }
  console.log('Notifiche admin inviate a Discord.');
}

main().catch((err) => {
  console.error('Errore imprevisto:', err);
  process.exit(1);
});

