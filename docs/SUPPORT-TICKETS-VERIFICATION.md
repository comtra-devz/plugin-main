# Verifica ticket di supporto (Discard + Open Support Ticket)

Due flussi nel plugin scrivono nella tabella **`support_tickets`** sul database Postgres usato da **auth-deploy** (`POST /api/support/ticket`):

| Flusso | Dove | `type` nel body |
|--------|------|-----------------|
| Discard / Bad fix | Audit → modale feedback | `AUDIT` |
| Documentation | “Open Support Ticket” | `BUG`, `FEATURE` o `LOVE` |

La pagina admin **Supporto** (`/support`) legge i dati con `GET /api/admin?route=support-feedback` e fa `SELECT` su **`support_tickets`** usando il **`POSTGRES_URL`** (o equivalente) configurato sul **progetto Vercel della dashboard admin**, non su auth.

## Perché il plugin “funziona” ma Supporto è vuoto?

Se **`POSTGRES_URL` della dashboard ≠ database dell’auth**, le `INSERT` vanno su un DB e la dashboard ne legge un altro → lista sempre vuota anche con risposta `200 OK` dal plugin.

**Azione:** allinea le variabili d’ambiente (stesso Postgres / stesso Supabase project) su entrambi i deploy, oppure replica i dati (non consigliato per semplicità).

## Checklist rapida (plugin)

1. Apri **Developer console** nel contesto del plugin (Figma → plugin → Inspect se disponibile, o build web per test).
2. Invia un ticket (Discard con “Send Feedback” o Documentation → Send Ticket).
3. Cerca in console:
   - **`[Comtra] POST /api/support/ticket ok`** → HTTP ok lato client; la riga contiene `source` (`audit-discard`, `audit-bad-fix`, `documentation`).
   - **`[Comtra] POST /api/support/ticket failed`** → leggi `status` e `body` (es. `401`, `503`, `500`).
   - **`network error`** → URL auth errato, CORS, o rete.

4. In **Network**, filtra `support/ticket`:
   - **Request URL** deve essere `${AUTH_BACKEND_URL}/api/support/ticket` (es. `https://auth.comtra.dev/...`).
   - Risposta attesa: **`200`** con body `{"ok":true}`.

## Checklist dashboard admin

1. Vai su **Supporto** e clicca **Aggiorna** (ricarica la lista).
2. Cerca righe **Origine = `Support Ticket`**; per Discard il messaggio inizia con **`[DISCARD]`** e **Variante = `AUDIT`**.
3. Se la pagina è ancora vuota ma il plugin logga **`ok`**:
   - confronta **stringa di connessione Postgres** auth vs dashboard;
   - esegui sul DB che usa **l’auth**:  
     `SELECT id, type, left(message, 80), created_at FROM support_tickets ORDER BY created_at DESC LIMIT 10;`  
     Se qui compaiono le righe ma la dashboard no → conferma mismatch DB sulla dashboard.

## Migrazione tabella

La tabella è creata da `auth-deploy/migrations/003_support_tickets.sql` (e in `auth-deploy/schema.sql`). Se l’auth risponde `503` / errore DB al POST, verifica che la migration sia stata applicata sul database effettivo.

### `POST /api/support/ticket` → **500** con Discard (type `AUDIT`)

Le prime versioni della tabella avevano un `CHECK` su `type` solo per `BUG`, `FEATURE`, `LOVE`. Il plugin per **Discard / Bad fix** invia **`type: AUDIT`**, quindi l’`INSERT` violava il vincolo e il server rispondeva **500** (`Server error`).

**Fix:** eseguire sullo stesso Postgres dell’auth la migration **`auth-deploy/migrations/009_support_tickets_audit_type.sql`** (estende il `CHECK` con `AUDIT`). Dopo il deploy, riprova il Discard: dovresti vedere **`[Comtra] POST /api/support/ticket ok`** in console.
