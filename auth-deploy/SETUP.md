# Deploy OAuth su auth.comtra.dev (secondo progetto Vercel)

Questo progetto serve **solo** per il login Figma. Così il progetto principale può restare su **Vite** e funziona tutto.

## Passi (una tantum)

### 1. Nuovo progetto su Vercel

1. Vercel Dashboard → **Add New** → **Project**.
2. **Import** lo **stesso repository** (comtra-devz/plugin-main-private).
3. Nome progetto: es. **comtra-auth** (o come preferisci).
4. **Root Directory**: clicca **Edit** e imposta **`auth-deploy`** (solo questa cartella).
5. **Framework Preset**: **Other** (non Vite).
6. Non serve **Build Command** particolare (lascia default o vuoto).
7. Crea il progetto.

### 2. Dominio auth.comtra.dev

1. Nel **progetto principale** (plugin-main-private): **Settings** → **Domains** → rimuovi **auth.comtra.dev** (se c’è).
2. Nel **nuovo progetto** (comtra-auth): **Settings** → **Domains** → **Add** → **auth.comtra.dev**.
3. Segui le istruzioni DNS (CNAME per `auth` che punta a cname.vercel-dns.com o quanto indicato).

### 3. Variabili d’ambiente (nuovo progetto)

Nel progetto **comtra-auth** → **Settings** → **Environment Variables**, aggiungi:

| Nome            | Valore                    |
|-----------------|---------------------------|
| `FIGMA_CLIENT_ID`  | (dalla app Figma)        |
| `FIGMA_CLIENT_SECRET` | (dalla app Figma)   |
| `BASE_URL`      | `https://auth.comtra.dev` |
| `REDIS_URL`     | (la tua URL Redis)        |

Poi **Redeploy** del progetto comtra-auth.

### 4. Verifica

Dalla root del plugin (non da auth-deploy):

```bash
npm run check-auth
```

Tutti i check devono essere **OK**. Poi prova il login dal plugin Figma.

---

**Riepilogo:** Due progetti sullo stesso repo. Il **primo** (root) = plugin, Framework **Vite**. Il **secondo** (root = `auth-deploy`) = solo API OAuth, dominio **auth.comtra.dev**.
