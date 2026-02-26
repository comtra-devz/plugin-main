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
| `REDIS_URL` | URL Redis (OAuth) | già fatto |
| `POSTGRES_URL` | URL connessione Postgres (Supabase) | **da aggiungere** — vedi sotto |
| `JWT_SECRET` | Stringa segreta lunga (es. `openssl rand -hex 32`) | **da aggiungere** |
| `LEMON_SQUEEZY_WEBHOOK_SECRET` | Signing secret del webhook Lemon Squeezy (6–40 caratteri) | **da aggiungere** per affiliate |

Dopo ogni modifica alle variabili: **Redeploy**.

---

## 2. Postgres (Supabase) — aggiunto tramite Vercel

**Supabase** l’hai aggiunto **tramite Vercel** (Storage / Integrations → Supabase → Create). Il piano free è capiente (500 MB DB, 50K MAU, ecc.).

1. **Connect**: nella modale "Connect Project" seleziona il **progetto Vercel** che serve auth.comtra.dev (quello con Root Directory = `auth-deploy`). Tieni spuntati gli ambienti che usi (es. Production, Preview). Nel campo **Custom Prefix** imposta **`POSTGRES`** così Vercel creerà una variabile tipo **`POSTGRES_URL`** (il nostro backend la usa con questo nome). Clicca **Connect**.
2. **POSTGRES_URL**: dopo il connect, in Vercel → **Settings** → **Environment Variables** dovresti vedere **`POSTGRES_URL`** (o simile). Se il nome è diverso, aggiungi manualmente **`POSTGRES_URL`** con lo stesso valore (Connection string da Supabase → Project Settings → Database).
3. **Schema** (una tantum): Supabase Dashboard → **SQL Editor** → **New query** → incolla **l’intero** contenuto di **`auth-deploy/schema.sql`** (include `users`, `credit_transactions`, `affiliates`) → **Run**.

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

## 4. Lemon Squeezy (affiliate)

Documentazione flusso e riferimenti codice: **[../docs/AFFILIATE.md](../docs/AFFILIATE.md)**.

1. **Webhook in Lemon Squeezy**: Dashboard Lemon Squeezy → **Settings** → **Webhooks** → Add endpoint:
   - **URL**: `https://auth.comtra.dev/api/webhooks/lemonsqueezy`
   - **Eventi**: seleziona almeno **Order created**
   - **Signing secret**: genera/copia il secret (6–40 caratteri) e mettilo in Vercel come **`LEMON_SQUEEZY_WEBHOOK_SECRET`**.
2. **Registrazione affiliati (automatica)**: l’utente dal plugin va su **Profilo → Affiliate Program** e clicca **Ottieni il tuo codice affiliato**. Il backend crea una riga in `affiliates` con il suo `user_id` (Figma) e un codice univoco generato automaticamente. Non serve più inserire affiliati a mano. (In casi particolari puoi ancora fare `INSERT INTO affiliates (user_id, affiliate_code) VALUES (...)` da SQL.)
   Il plugin invia sia `?aff=CODICE` sia `checkout[custom][aff]=CODICE` così il webhook riceve il codice in `meta.custom_data.aff` e incrementa `total_referrals`. Il profilo utente (Production Metrics) mostra **AFFILIATES** = `total_referrals` letti nel callback OAuth.

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
