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

Dopo ogni modifica alle variabili: **Redeploy**.

---

## 2. Postgres (Supabase) — aggiunto tramite Vercel

**Supabase** l’hai aggiunto **tramite Vercel** (Storage / Integrations → Supabase → Create). Il piano free è capiente (500 MB DB, 50K MAU, ecc.).

1. **Connect**: nella modale "Connect Project" seleziona il **progetto Vercel** che serve auth.comtra.dev (quello con Root Directory = `auth-deploy`). Tieni spuntati gli ambienti che usi (es. Production, Preview). Nel campo **Custom Prefix** imposta **`POSTGRES`** così Vercel creerà una variabile tipo **`POSTGRES_URL`** (il nostro backend la usa con questo nome). Clicca **Connect**.
2. **POSTGRES_URL**: dopo il connect, in Vercel → **Settings** → **Environment Variables** dovresti vedere **`POSTGRES_URL`** (o simile). Se il nome è diverso, aggiungi manualmente **`POSTGRES_URL`** con lo stesso valore (Connection string da Supabase → Project Settings → Database).
3. **Schema** (una tantum): Supabase Dashboard → **SQL Editor** → **New query** → incolla il contenuto di **`auth-deploy/schema.sql`** → **Run**.

Contenuto minimo da eseguire (è in `auth-deploy/schema.sql`):

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
```

---

## 3. JWT_SECRET

Se non l’hai già messa: genera una stringa segreta (es. `openssl rand -hex 32`) e aggiungila in Vercel come **`JWT_SECRET`**. Serve per firmare i token delle API credits.

---

## 4. Redeploy e verifica

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

---

**Guida OAuth dettagliata:** [../docs/OAUTH-FIGMA.md](../docs/OAUTH-FIGMA.md)
