# Deploy auth.comtra.dev – passi completi

La cartella **auth-deploy** va deployata come **un solo progetto Vercel** (Root Directory = `auth-deploy`).

---

## Già fatto insieme (da non rifare)

Questi elementi sono già stati configurati insieme; usa questa sezione solo per riferimento o verifica:

- **Progetto Vercel** per auth.comtra.dev, con **Root Directory** = **`auth-deploy`**
- **Dominio** **auth.comtra.dev** associato al progetto (DNS/CNAME già ok)
- **Redis** (stato OAuth) — aggiunto/collegato da Vercel, variabile **REDIS_URL**
- **Figma OAuth**: app con Redirect URL `https://auth.comtra.dev/auth/figma/callback`, **FIGMA_CLIENT_ID** e **FIGMA_CLIENT_SECRET** in Vercel
- **BASE_URL** = `https://auth.comtra.dev` nelle variabili

---

## Da fare / da verificare (credits)

Resta da aggiungere solo quanto serve per il **sistema credits**: Postgres (Supabase) e JWT.

---

## 1. Variabili d’ambiente (riferimento completo)

Elenco di tutte le variabili usate (quelle già impostate insieme a te restano; da aggiungere solo **POSTGRES_URL** e **JWT_SECRET** se non già presenti):

| Nome | Valore | Stato |
|------|--------|--------|
| `FIGMA_CLIENT_ID` | Dalla OAuth app Figma | già fatto |
| `FIGMA_CLIENT_SECRET` | Stessa app Figma | già fatto |
| `BASE_URL` | `https://auth.comtra.dev` (senza slash finale) | già fatto |
| `REDIS_URL` | URL Redis (OAuth **+** limite globale concorrenza chiamate Kimi tra utenti) | già fatto |
| `POSTGRES_URL` | URL connessione Postgres (Supabase) | **da aggiungere** — vedi sotto |
| `JWT_SECRET` | Stringa segreta lunga (es. `openssl rand -hex 32`) | **da aggiungere** |
| `LEMON_SQUEEZY_WEBHOOK_SECRET` | Signing secret del webhook Lemon Squeezy (6–40 caratteri) | **da aggiungere** per affiliate |
| `LEMON_SQUEEZY_API_KEY` | API key Lemon Squeezy (Settings → API) | **da aggiungere** per codici sconto livello (gamification) |
| `LEMON_SQUEEZY_STORE_ID` | ID dello store Lemon Squeezy (per creare discount via API) | **da aggiungere** con API key |
| *(alias)* `LEMON_API_KEY` | Stesso valore dell’API key | Se in Vercel usi questo nome al posto di `LEMON_SQUEEZY_API_KEY`, va bene: il backend lo accetta. |
| *(alias)* `LEMON_STORE_ID` | Stesso valore dello store id | Stesso discorso al posto di `LEMON_SQUEEZY_STORE_ID`. |
| `LEMON_VARIANT_1Y` | ID della **variant** del piano **Annual (1y)** in Lemon | Obbligatorio per legare gli sconti livello al prodotto giusto. Se hai solo nomi tipo `LEMON_VARIANT_SV` / `AZ` / `TZ` / `SN`, copia l’**ID numerico** della variant Annual da Lemon e incollalo qui (o aggiungi questa variabile accanto alle altre). |
| `KIMI_API_KEY` | API key da [platform.moonshot.ai](https://platform.moonshot.ai) (Console → API Keys) | **obbligatoria** per DS Audit e altri agenti |
| `KIMI_MODEL` | Modello di default per Generate, UX audit, ecc. (opzionale) | Default backend: `kimi-k2.6`. |
| `KIMI_DS_AUDIT_MODEL` | Modello **solo** per `POST /api/agents/ds-audit` | Default nel codice: `kimi-k2-0905-preview` (latenza storica). Per usare di nuovo **Kimi 2.6** sull’audit DS senza toccare il resto: `kimi-k2.6`. |
| `KIMI_GLOBAL_MAX_CONCURRENT` | (Opzionale) Max chiamate **Kimi in parallelo** su tutta l’istanza, se c’è **REDIS_URL** | Default **16**. Abbassa se vedi TPM troppo spesso; alza (es. 32–48) solo se Moonshot permette più throughput e Redis c’è. |
| `KIMI_QUEUE_MAX_WAIT_MS` | Attesa massima in coda per un “slot” Kimi (ms) | Default **90000**. |
| `KIMI_LEASE_MS` | Dopo quanto uno slot Redis scade se il worker muore (ms) | Default **180000**. |

Dopo ogni modifica alle variabili: **Redeploy**.

*(Le API admin della dashboard girano sul **progetto Vercel della dashboard**, non qui; lì servono `POSTGRES_URL` e `ADMIN_SECRET`.)*

---

## 2. Postgres (Supabase) — aggiunto tramite Vercel

**Supabase** l’hai aggiunto **tramite Vercel** (Storage / Integrations → Supabase → Create). Il piano free è capiente (500 MB DB, 50K MAU, ecc.).

1. **Connect**: nella modale "Connect Project" seleziona il **progetto Vercel** che serve auth.comtra.dev (quello con Root Directory = `auth-deploy`). Tieni spuntati gli ambienti che usi (es. Production, Preview). Nel campo **Custom Prefix** imposta **`POSTGRES`** così Vercel creerà una variabile tipo **`POSTGRES_URL`** (il nostro backend la usa con questo nome). Clicca **Connect**.
2. **POSTGRES_URL**: dopo il connect, in Vercel → **Settings** → **Environment Variables** dovresti vedere **`POSTGRES_URL`** (o simile). Se il nome è diverso, aggiungi manualmente **`POSTGRES_URL`** con lo stesso valore (Connection string da Supabase → Project Settings → Database).
3. **Schema** (una tantum): Supabase Dashboard → **SQL Editor** → **New query** → incolla **l’intero** contenuto di **`auth-deploy/schema.sql`** (include `users`, `credit_transactions`, `affiliates`, `xp_transactions`, `trophies`, `user_trophies`, `figma_tokens` e colonne gamification) → **Run**. Se il DB esiste già, esegui solo le parti nuove (es. `CREATE TABLE IF NOT EXISTS figma_tokens ...`) per la pipeline agenti.

Contenuto minimo (è in `auth-deploy/schema.sql`):

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  name TEXT,
  img_url TEXT,
  plan TEXT NOT NULL DEFAULT 'FREE',
  plan_expires_at TIMESTAMPTZ,
  credits_total INTEGER NOT NULL DEFAULT 25,
  credits_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  credits_consumed INTEGER NOT NULL,
  file_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at);

-- Tabella affiliates (referrer = user_id Figma, codice univoco, total_referrals aggiornato dal webhook)
CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  affiliate_code TEXT NOT NULL UNIQUE,
  lemon_affiliate_id TEXT,
  total_referrals INTEGER NOT NULL DEFAULT 0,
  total_earnings_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_affiliates_user_id ON affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_affiliate_code ON affiliates(affiliate_code);
```

---

## 3. JWT_SECRET

Se non l’hai già messa: genera una stringa segreta (es. `openssl rand -hex 32`) e aggiungila in Vercel come **`JWT_SECRET`**. Serve per firmare i token delle API credits.

---

## 4. Lemon Squeezy (affiliate + upgrade acquirente)

Documentazione flusso e riferimenti codice: **[../docs/AFFILIATE.md](../docs/AFFILIATE.md)**. In particolare, la sezione **Flusso acquirente (upgrade a PRO)** descrive: checkout → webhook → refresh per vedere PRO (nessuna license key).

1. **Webhook in Lemon Squeezy**: Dashboard Lemon Squeezy → **Settings** → **Webhooks** → Add endpoint:
   - **URL**: `https://auth.comtra.dev/api/webhooks/lemonsqueezy`
   - **Eventi**: seleziona almeno **Order created**
   - **Signing secret**: genera/copia il secret (6–40 caratteri) e mettilo in Vercel come **`LEMON_SQUEEZY_WEBHOOK_SECRET`**.
2. **Cosa fa il webhook** (a ogni Order created con `status = paid`): aggiorna l’**acquirente** (cerca utente per email in custom_data o in `user_email` dell’ordine, imposta `plan = 'PRO'`, `credits_total` e `plan_expires_at` in base al variant) e, se presente il codice in `meta.custom_data.aff`, incrementa **affiliato** (`total_referrals`). L’utente dopo il pagamento torna nel plugin e fa refresh per vedere PRO.
3. **Registrazione affiliati (automatica)**: l’utente dal plugin va su **Profilo → Affiliate Program** e clicca **Ottieni il tuo codice affiliato**. Il backend crea una riga in `affiliates` con il suo `user_id` (Figma) e un codice univoco. Il plugin invia `?aff=CODICE` e `checkout[custom][aff]=CODICE`; il webhook riceve il codice e incrementa `total_referrals`. Il profilo (Production Metrics) mostra **AFFILIATES** = `total_referrals` letti nel callback OAuth.

4. **Redirect checkout (Pay now)**: il plugin apre `GET /api/checkout/redirect?tier=6m&aff=...&email=...` su auth.comtra.dev, che fa un redirect 302 al checkout Lemon Squeezy. In Vercel puoi usare:
   - formato numerico: **`LEMON_SQUEEZY_CHECKOUT_BASE`** (default `https://comtra.lemonsqueezy.com/checkout/buy`) + **`LEMON_VARIANT_1W`**, **`LEMON_VARIANT_1M`**, **`LEMON_VARIANT_6M`**, **`LEMON_VARIANT_1Y`**
   - formato share URL UUID (consigliato): **`LEMON_CHECKOUT_URL_1W`**, **`LEMON_CHECKOUT_URL_1M`**, **`LEMON_CHECKOUT_URL_6M`**, **`LEMON_CHECKOUT_URL_1Y`** (hanno priorita` sui variant ID)
5. **Codici sconto livello (gamification)**: con **`LEMON_SQUEEZY_API_KEY`** e **`LEMON_SQUEEZY_STORE_ID`** il backend crea un codice sconto univoco per utente quando raggiunge livello 5, 10, 15 o 20 (5%–20% sul piano Annual). Al passaggio di livello superiore il codice precedente viene eliminato via API. Tabella DB: `user_level_discounts` (vedi `schema.sql`). Senza queste variabili il level up funziona ma il codice non viene creato.

6. **`auth.comtra.dev` sul progetto Vercel `plugin-login`**: se il dominio punta a **`plugin-login`** e la **Root Directory** del progetto è la **root del monorepo** (non la sottocartella `auth-deploy`), le route OAuth “piene” stanno comunque sul deploy **`auth-deploy`**. In quel caso il file **`api/discounts/me.mjs`** nella root del repo fa da **proxy** verso l’upstream (default `https://auth-deploy-ten.vercel.app`). Opzionale: env **`COMTRA_AUTH_UPSTREAM_URL`** = base senza slash finale dell’istanza che espone `app.mjs` (stesso `JWT_SECRET` / stesso DB dell’upstream). Se invece la Root Directory di `plugin-login` è **`auth-deploy`**, non serve il proxy: basta il rewrite in `auth-deploy/vercel.json` e un deploy aggiornato di quel progetto.

---

## 4bis. Far comparire una nuova route (es. Verifica token)

Quando aggiungi un **nuovo file** in `auth-deploy/api/` (es. `api/figma/token-status.mjs`), quella route non esiste su auth.comtra.dev finché non rifai il deploy. Passi:

1. **Salva e committa** il nuovo file nel repo (es. `git add auth-deploy/api/figma/token-status.mjs` e `git commit`, poi `git push`).
2. **Vercel** di solito fa il deploy da solo a ogni push. Se il progetto è collegato al repo, aspetta 1–2 minuti dopo il push.
3. **Oppure** vai su [vercel.com](https://vercel.com) → il progetto che ha **Root Directory = auth-deploy** → tab **Deployments** → sui tre puntini dell’ultimo deploy clicca **Redeploy** (così usa l’ultimo codice del branch).
4. **Verifica**: apri `https://auth.comtra.dev/api/figma/token-status` nel browser. Non deve più dare 404 (potrà dare 401 se non mandi il token, ed è ok).

---

## 5. Redeploy e verifica

1. **Redeploy** del progetto (per caricare tutte le variabili).
2. Dalla **root del plugin** (non da `auth-deploy`):

   ```bash
   npm run check-auth
   ```

   Tutti i check devono essere **OK**.
3. Apri il plugin in Figma → **Login with Figma** → completa il flusso. Dopo il login, in profilo (avatar) dovresti vedere i credits (es. 25/25 se nuovo utente).

---

## Riepilogo checklist

**Già fatto insieme:** progetto Vercel, dominio auth.comtra.dev, Redis, Figma OAuth, FIGMA_*, BASE_URL, REDIS_URL.

**Da completare per i credits:**
- [ ] Supabase aggiunto **tramite Vercel** (Storage/Integrations → Supabase → Create) — fatto
- [ ] **POSTGRES_URL** in Vercel (se non iniettata da Vercel, copiarla da Supabase → Project Settings → Database → Connection string)
- [ ] **JWT_SECRET** in Vercel
- [ ] Schema **auth-deploy/schema.sql** eseguito in Supabase (SQL Editor)
- [ ] Redeploy
- [ ] `npm run check-auth` OK e login dal plugin con credits (es. 25/25)

**Per il sistema affiliate (Lemon Squeezy):**
- [ ] **LEMON_SQUEEZY_WEBHOOK_SECRET** in Vercel (signing secret del webhook)
- [ ] Webhook Lemon Squeezy puntato a `https://auth.comtra.dev/api/webhooks/lemonsqueezy`, evento **Order created**
- [ ] (Opzionale) Inserire affiliati a mano in `affiliates` solo se serve; di default si registrano dal plugin (Affiliate Program → Ottieni il tuo codice).

---

**Guida OAuth dettagliata:** [../docs/OAUTH-FIGMA.md](../docs/OAUTH-FIGMA.md)
