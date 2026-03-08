# Accesso con Magic Link

## Flusso

1. L’utente apre la dashboard → vede solo il campo **Email**.
2. Inserisce una delle **due email abilitate** (quelle in tabella `admin_users`) e clicca **Invia link**.
3. Il server invia un’email (via Resend) con un link che scade in **15 minuti**.
4. L’utente clicca il link → arriva su `/auth/verify?token=...` → il frontend scambia il token con un **JWT di sessione** (scadenza **24 ore**) e lo salva → redirect alla home della dashboard.

## Variabili d’ambiente (backend)

- **POSTGRES_URL** (o DATABASE_URL): già usato per le API.
- **ADMIN_JWT_SECRET**: per firmare magic link e session JWT.
- **RESEND_API_KEY**: chiave API Resend (crea un account su resend.com).
- **RESEND_FROM**: mittente dell’email, es. `Comtra Admin <noreply@tudominio.com>`. Su Resend va verificato il dominio; in sviluppo puoi usare `onboarding@resend.dev`.
- **ADMIN_DASHBOARD_URL**: URL base della dashboard (es. `https://admin.tuosito.com`). Su Vercel puoi non impostarla: si usa **VERCEL_URL** (impostato da Vercel) per costruire il link.

## Chi può richiedere il link

Solo gli utenti presenti in **admin_users** (stessa tabella usata prima per email+password). Se l’email non è in tabella, la risposta è comunque `{ ok: true }` (nessun messaggio tipo “email non abilitata”) per non rivelare quali email sono abilitate.

## Scadenze

- **Magic link** (link nell’email): **15 minuti**.
- **Sessione** (dopo click sul link): **24 ore**.

## 2FA

Il flusso con password e 2FA è ancora nel codice ma non usato dall’interfaccia; si può riattivare in una fase successiva.
