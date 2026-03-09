# Accesso con Magic Link

## Flusso

1. L’utente apre la dashboard → vede solo il campo **Email**.
2. Inserisce l’**email abilitata** e clicca **Invia link**.
3. Il server invia un’email (via Resend) con un link che scade in **15 minuti**.
4. L’utente clicca il link → arriva su `/auth/verify?token=...` → il frontend scambia il token con un **JWT di sessione** (scadenza **24 ore**) e lo salva → redirect alla home della dashboard.

## Variabili d’ambiente (backend)

- **ALLOWED_ADMIN_EMAIL**: l’unica email che può richiedere il magic link (es. `admin@comtra.dev`). Se la imposti, **non serve il database** per il login: tutto è gestito da questa variabile.
- **ADMIN_JWT_SECRET**: per firmare magic link e session JWT.
- **RESEND_API_KEY**: chiave API Resend (crea un account su resend.com).
- **RESEND_FROM**: opzionale; default `Comtra Admin <onboarding@resend.dev>` (per test Resend senza dominio verificato).
- **ADMIN_DASHBOARD_URL**: URL base della dashboard. Su Vercel si usa **VERCEL_URL** se non la imposti.

**POSTGRES_URL** serve solo per le altre funzioni della dashboard (statistiche, lista utenti, crediti, ecc.). Per il solo login magic link con una email fissa **non** serve.

## Chi può richiedere il link

- Se è impostata **ALLOWED_ADMIN_EMAIL**, solo quell’email può ricevere il link (nessun DB).
- Altrimenti il server controlla la tabella **admin_users** (serve POSTGRES_URL). Se l’email non è ammessa, la risposta è comunque `{ ok: true }` per non rivelare nulla.

## Scadenze

- **Magic link** (link nell’email): **15 minuti**.
- **Sessione** (dopo click sul link): **24 ore**.

## 2FA

Il flusso con password e 2FA è ancora nel codice ma non usato dall’interfaccia; si può riattivare in una fase successiva.
