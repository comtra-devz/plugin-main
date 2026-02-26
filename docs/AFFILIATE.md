# Affiliazione Comtra (Lemon Squeezy)

Il plugin integra un **programma affiliate** con Lemon Squeezy: l’utente ottiene un codice univoco e un link da condividere; le vendite attribuite vengono tracciate e mostrate nel profilo.

---

## Flusso utente

1. **Profilo → Affiliate Program** (dal menu sotto l’avatar).
2. Clic su **"Ottieni il tuo codice affiliato"** → il backend crea una riga in DB e assegna un codice (8 caratteri, es. `K7XN2PMQ`).
3. La view mostra **il codice** e **il link da condividere** (checkout Lemon Squeezy con `?aff=CODICE`); pulsante **Copia** per il link.
4. Chi acquista tramite quel link viene attribuito all’affiliato: il webhook Lemon Squeezy (Order created) notifica il backend, che incrementa `total_referrals`.
5. Nel **profilo** (e in STATS / Production Metrics) il contatore **AFFILIATES** mostra il numero di referral attribuiti.

L’acquirente può anche inserire il codice manualmente nella **modal di upgrade** (campo "ENTER CODE") prima di "Pay now": l’URL di checkout viene costruito con `?aff=CODICE` e `checkout[custom][aff]=CODICE` così il webhook riceve il codice in `meta.custom_data.aff`.

---

## Setup backend (auth.comtra.dev)

- **Webhook Lemon Squeezy**: URL `https://auth.comtra.dev/api/webhooks/lemonsqueezy`, evento **Order created**; variabile **`LEMON_SQUEEZY_WEBHOOK_SECRET`** in Vercel (signing secret).
- **DB**: tabella **`affiliates`** (vedi `auth-deploy/schema.sql`). Gli affiliati si registrano dal plugin; in casi particolari si può fare `INSERT` manuale in `affiliates` (user_id, affiliate_code).

Dettagli completi: **[auth-deploy/SETUP.md](../auth-deploy/SETUP.md)** (sezione "4. Lemon Squeezy (affiliate)").

---

## Riferimenti nel codice

| Cosa | Dove |
|------|------|
| Variant ID checkout (1w, 1m, 6m, 1y) | `constants.ts` → `LEMON_SQUEEZY_VARIANT_IDS` (o env `VITE_LEMON_VARIANT_*`) |
| Costruzione URL con `?aff=` | `constants.ts` → `buildCheckoutUrl(tier, affiliateCode)` |
| Vista affiliato (codice + link) | `views/Affiliate.tsx` |
| API "mio codice" / "registrami" | Backend: `GET /api/affiliates/me`, `POST /api/affiliates/register` |
| Webhook Order created | `auth-deploy/api/webhooks/lemonsqueezy.mjs` |
| Lettura `affiliatesCount` al login | `auth-deploy/oauth-server/app.mjs` (callback OAuth) |
