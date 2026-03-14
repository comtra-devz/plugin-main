# Login con Figma – setup e verifica

Guida unica per il flusso OAuth del plugin (Login with Figma). Il deploy usa la cartella **auth-deploy** su un **progetto Vercel dedicato** (stesso repo **plugin-main**, Root Directory = `auth-deploy`).

**Flusso utente:** click "Login with Figma" → Figma apre il browser per il consenso → dopo l’autorizzazione redirect a `auth.comtra.dev`, che mostra la pagina "Login completato" e dopo qualche secondo reindirizza/chiude tornando a Figma; il plugin riceve l’utente via poll e mostra la dashboard.

---

## Regole per un nuovo Vercel (obbligatorie)

| Impostazione | Valore | Note |
|--------------|--------|------|
| **Repository** | `comtra-devz/plugin-main` | Questa repo. |
| **Root Directory** | `auth-deploy` | Solo questa cartella viene deployata. |
| **Framework Preset** | **Other** | Non usare Vite. |
| **Build Command** | (vuoto o default) | Nessun build: solo le API in `api/`. |
| **Output Directory** | (vuoto) | Non impostare. |
| **Dominio** | `auth.comtra.dev` | Già presente per questo servizio; verificare che sia associato al progetto. |
| **Variabili** | Vedi sotto §3 | FIGMA_CLIENT_ID, FIGMA_CLIENT_SECRET, BASE_URL, REDIS_URL. |

Se Root Directory non è `auth-deploy` o Framework è Vite, le route `/api/figma-oauth/*` non vengono deployate e il login restituirà 404.

---

## 1. Progetto Vercel per auth.comtra.dev

1. **Vercel** → **Add New** → **Project**.
2. **Import** il repository **comtra-devz/plugin-main** (questa repo).
3. Nome progetto: es. **comtra-auth**.
4. **Root Directory**: **Edit** → imposta **`auth-deploy`**.
5. **Framework Preset**: **Other**.
6. Crea il progetto.

---

## 2. Dominio e DNS

**auth.comtra.dev** è già il dominio del servizio. Nel progetto → **Settings** → **Domains** verifica che **auth.comtra.dev** sia presente e **Valid**. Se il CNAME era già configurato in passato, non serve rifare il DNS.

---

## 3. Variabili d’ambiente

Nel progetto Vercel (comtra-auth) → **Settings** → **Environment Variables**:

| Nome | Valore |
|------|--------|
| `FIGMA_CLIENT_ID` | Dalla [OAuth app Figma](https://www.figma.com/developers/apps) → Client ID |
| `FIGMA_CLIENT_SECRET` | Stessa app → Client secret |
| `BASE_URL` | `https://auth.comtra.dev` (senza slash finale) |
| `REDIS_URL` | URL Redis (es. da Redis Labs / Vercel Storage) |

Dopo aver modificato le variabili: **Redeploy**.

---

## 4. Redis (stato del login)

Il server deve ricordare lo stato OAuth tra init, callback e poll. Senza store condiviso il login non completa.

- Crea un database **Redis** (Vercel Storage, Redis Labs, ecc.) e collegalo al progetto Vercel (**Connect**).
- Imposta la variabile **`REDIS_URL`** (o le variabili KV se usi Vercel KV).

---

## 5. Figma

- [Figma → Your apps](https://www.figma.com/developers/apps) → la tua OAuth app.
- **App name**: imposta il nome dell’app su **Comtra** (così nella schermata di consenso l’utente vedrà “Comtra would like to access...” invece di “OAuth would like to access...”).
- **Redirect URL**: aggiungi **`https://auth.comtra.dev/auth/figma/callback`**.
- **Scopes**: almeno **current_user:read**.

---

## 6. Verifica

Dalla **root del plugin** (non da auth-deploy):

```bash
npm run check-auth
```

Tutti i check devono essere **OK**. Poi prova **Login with Figma** dal plugin in Figma.

---

## Checklist rapida

- [ ] Progetto Vercel con Root Directory = **auth-deploy** (repo plugin-main).
- [ ] Dominio **auth.comtra.dev** associato al progetto e Valid (già presente).
- [ ] Variabili: **FIGMA_CLIENT_ID**, **FIGMA_CLIENT_SECRET**, **BASE_URL**, **REDIS_URL**.
- [ ] Redis collegato al progetto (o REDIS_URL impostata).
- [ ] Figma: Redirect URL = `https://auth.comtra.dev/auth/figma/callback`.
- [ ] `npm run check-auth` tutto OK → prova login dal plugin.

---

## Login funziona solo con un account / “altre email” no

Se con un account Figma il login va a buon fine e con un altro (altra email) vedi "OAuth app with client id … doesn't exist", **il blocco è su Figma**, non nel nostro backend. Vedi **[FIGMA-OAUTH-OTHER-ACCOUNTS.md](./FIGMA-OAUTH-OTHER-ACCOUNTS.md)** per il flusso completo, perché succede e come verificarlo.
