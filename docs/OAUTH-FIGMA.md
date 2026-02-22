# Login con Figma – setup e verifica

Guida unica per il flusso OAuth del plugin (Login with Figma). Il deploy usa la cartella **auth-deploy** su un **progetto Vercel dedicato** (stesso repo **plugin-main**, Root Directory = `auth-deploy`).

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

1. Nel nuovo progetto → **Settings** → **Domains** → **Add** → **auth.comtra.dev**.
2. Nel **DNS** del dominio (es. OVH): crea un record **CNAME** per **auth** con il valore indicato da Vercel (es. `cname.vercel-dns.com`).

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
- [ ] Dominio **auth.comtra.dev** assegnato al progetto; DNS configurato.
- [ ] Variabili: **FIGMA_CLIENT_ID**, **FIGMA_CLIENT_SECRET**, **BASE_URL**, **REDIS_URL**.
- [ ] Redis collegato al progetto (o REDIS_URL impostata).
- [ ] Figma: Redirect URL = `https://auth.comtra.dev/auth/figma/callback`.
- [ ] `npm run check-auth` tutto OK → prova login dal plugin.
