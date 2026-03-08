# Auth Admin: email + password + 2FA (TOTP)

## Panoramica

- **Login**: email + password (2 utenti ammessi, tabella `admin_users`).
- **2FA**: TOTP (Google Authenticator / Authy / 1Password, ecc.) a costo zero.
- **Sessione**: JWT (24h) dopo login (e 2FA se configurata).

## Backend (env e DB)

### Variabili d’ambiente (progetto Vercel / server)

- `POSTGRES_URL` o `DATABASE_URL`: connessione Postgres (già usata per le API admin).
- `ADMIN_SECRET`: (opzionale) secret statico per backward compatibility; se presente le API accettano anche `Authorization: Bearer <ADMIN_SECRET>`.
- `ADMIN_JWT_SECRET`: secret per firmare i JWT di sessione (se assente si usa `ADMIN_SECRET`).

### Database

1. Esegui la migrazione:
   ```bash
   psql "$POSTGRES_URL" -f migrations/001_admin_users.sql
   ```

2. Crea i 2 utenti admin (una tantum):
   ```bash
   export POSTGRES_URL="postgresql://..."
   export ADMIN_USER_1_EMAIL="prima-email@esempio.com"
   export ADMIN_USER_2_EMAIL="seconda-email@esempio.com"
   export ADMIN_SEED_PASSWORD="password-iniziale-min-8-caratteri"
   node scripts/seed-admin-users.mjs
   ```
   Lo script fa `INSERT ... ON CONFLICT (email) DO UPDATE`, quindi puoi rilanciarlo per aggiornare la password.

## Flusso utente

1. **Login**: l’utente inserisce email e password → il backend verifica e risponde con:
   - `need2FA: 'setup'` + `tempToken`: l’utente non ha ancora la 2FA → il frontend mostra il **setup 2FA** (QR + primo codice).
   - `need2FA: true` + `tempToken`: l’utente ha già la 2FA → il frontend chiede il **codice a 6 cifre**.

2. **Setup 2FA** (solo al primo accesso): il frontend chiama `setup-2fa` con il `tempToken`, riceve `qrUrl` e `setupToken`. Mostra il QR; l’utente scansiona con l’app e inserisce il codice → `confirm-2fa` con `setupToken` + codice → il backend salva il secret e restituisce il **token di sessione (JWT)**.

3. **Verify 2FA** (accessi successivi): l’utente inserisce il codice → il frontend chiama `verify-2fa` con `tempToken` + codice → il backend restituisce il **token di sessione (JWT)**.

4. Il frontend salva il JWT in `sessionStorage` e lo invia in `Authorization: Bearer <token>` a tutte le chiamate `/api/admin`. Il backend (in `requireAdmin`) accetta sia JWT valido sia `ADMIN_SECRET`.

## API auth

- **POST /api/admin-auth**  
  Body JSON: `{ action, ... }`.

  - `action: 'login'` → `{ email, password }` → `{ need2FA, tempToken }`
  - `action: 'setup-2fa'` → `{ tempToken }` → `{ qrUrl, secret, setupToken }`
  - `action: 'confirm-2fa'` → `{ setupToken, code }` → `{ token }`
  - `action: 'verify-2fa'` → `{ tempToken, code }` → `{ token }`

## Frontend

- Login: `AdminLogin.tsx` (step email/password → 2FA verify o 2FA setup con QR).
- Token: salvato in `sessionStorage` con chiave `admin_token`; usato da `api.ts` in `headers()` per tutte le richieste.
- Logout: `logout()` rimuove il token e ricarica la pagina.

## Dipendenze

- Backend: `bcryptjs`, `otplib`, `jose` (già in `package.json`).
- QR code: il frontend usa un servizio esterno per generare l’immagine dal `qrUrl` (otpauth); in ambienti chiusi si può sostituire con una lib locale (es. `qrcode.react`).
