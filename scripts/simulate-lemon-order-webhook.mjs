#!/usr/bin/env node
/**
 * Simula un webhook Lemon Squeezy `order_created` (pagamento completato) verso auth.comtra.dev.
 * Aggiorna DB come un acquisto reale: plan PRO, crediti, scadenza, opzionale referral.
 *
 * Richiede che esista già una riga in `users` con la stessa email del checkout (come dopo OAuth).
 *
 * Uso:
 *   LEMON_SQUEEZY_WEBHOOK_SECRET='...' BUYER_EMAIL='utente@example.com' node scripts/simulate-lemon-order-webhook.mjs
 *
 * Opzioni env:
 *   AUTH_BACKEND_URL | COMTRA_AUTH_URL  default https://auth.comtra.dev
 *   BUYER_EMAIL       obbligatorio (match `users.email`)
 *   VARIANT_ID        default 1450304 (6m; altri: 1450263 1w, 1450299 1m, 1450315 1y)
 *   AFF_CODE          opzionale (incrementa total_referrals se il codice esiste in `affiliates`)
 *   DRY_RUN=1         stampa body e firma senza POST
 *
 * npm: npm run simulate:lemon-order
 */
import crypto from 'node:crypto';

const BASE = (process.env.AUTH_BACKEND_URL || process.env.COMTRA_AUTH_URL || 'https://auth.comtra.dev').replace(
  /\/$/,
  ''
);
const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
const buyerEmail = (process.env.BUYER_EMAIL || '').trim();
const variantId = String(process.env.VARIANT_ID || '1450304').trim();
const affCode = (process.env.AFF_CODE || '').trim();
const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

function buildPayload() {
  const customData = { email: buyerEmail };
  if (affCode) customData.aff = affCode;

  const vid = /^\d+$/.test(variantId) ? Number(variantId) : variantId;

  return {
    meta: {
      event_name: 'order_created',
      custom_data: customData,
    },
    data: {
      type: 'orders',
      id: `sim-${Date.now()}`,
      attributes: {
        status: 'paid',
        user_email: buyerEmail,
        first_order_item: {
          variant_id: vid,
        },
      },
    },
  };
}

function signRawBody(rawBody, signingSecret) {
  return crypto.createHmac('sha256', signingSecret).update(rawBody, 'utf8').digest('hex');
}

async function main() {
  if (!secret) {
    console.error('Manca LEMON_SQUEEZY_WEBHOOK_SECRET (deve coincidere con Vercel e con Lemon webhook).');
    process.exit(1);
  }
  if (!buyerEmail) {
    console.error('Manca BUYER_EMAIL (email di un utente già presente in users dopo login OAuth).');
    process.exit(1);
  }

  const payload = buildPayload();
  const rawBody = JSON.stringify(payload);
  const signature = signRawBody(rawBody, secret);
  const url = `${BASE}/api/webhooks/lemonsqueezy`;

  console.log(`Target: POST ${url}`);
  console.log(`Variant: ${variantId} | Buyer: ${buyerEmail}${affCode ? ` | aff: ${affCode}` : ''}\n`);

  if (dryRun) {
    console.log('--- DRY_RUN body ---');
    console.log(rawBody);
    console.log('\nX-Signature (hex):', signature);
    return;
  }

  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signature,
    },
    body: rawBody,
  });

  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  console.log(`HTTP ${r.status}`);
  console.log(typeof json === 'object' ? JSON.stringify(json, null, 2) : json);

  if (!r.ok) process.exit(1);
  if (json && json.buyer_updated === false) {
    console.error(
      '\nAttenzione: buyer_updated=false → nessuna riga users con questa email, o variant_id non in mappa webhook.'
    );
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
