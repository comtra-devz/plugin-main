# Deploy Admin Dashboard su Vercel — to-do dettagliato

Guida passo-passo per pubblicare la **admin dashboard** come **secondo progetto** Vercel (stesso repo, root diversa). La dashboard resta privata: dominio dedicato, nessun link dal sito pubblico.

---

## Limite serverless function (12 su piano Hobby) — auth-deploy

Le **API admin** (stats, credits-timeline, users, affiliates) **non** sono su auth-deploy: girano sul **progetto Vercel della dashboard**. Così auth-deploy resta sotto le 12 function.

- **Progetto auth-deploy (auth.comtra.dev):** 11 serverless function (credits, trophies, figma-oauth, agents, webhooks, ecc.). Nessuna route `/api/admin`.
- **Progetto dashboard (es. admin.comtra.dev):** 1 serverless function (`api/admin.mjs`) che serve tutti i dati; la SPA chiama same-origin `/api/admin?route=...`. Nel progetto dashboard configuri **POSTGRES_URL** (stesso DB di auth-deploy) e **ADMIN_SECRET**.

---

## Prerequisiti

- [ ] Il progetto **auth-deploy** è già deployato su Vercel (auth.comtra.dev) e hai l’URL del DB (**POSTGRES_URL**) da riusare per la dashboard.
- [ ] Hai accesso al team/account Vercel dove vuoi creare il secondo progetto (dashboard).

---

## 1. Crea il progetto Vercel per la dashboard

- [ ] Vai su [vercel.com](https://vercel.com) → Dashboard → **Add New…** → **Project**.
- [ ] **Import Git Repository:** scegli lo stesso repository del plugin (es. `plugin-main-1` o il nome reale del repo). Clicca **Import**.
- [ ] **Configure Project:** nella schermata di configurazione non fare ancora Deploy; procedi con i passi sotto.

---

## 2. Imposta la Root Directory

Su Vercel **non c’è un browser di cartelle**: il percorso va **scritto a mano** nel campo Root Directory.

- [ ] Nel blocco **Root Directory** clicca **Edit** (o **Override**).
- [ ] Nel campo di testo scrivi **esattamente:** `admin-dashboard`  
  (nessuno slash iniziale, nessuno spazio; è il nome della cartella nella root del repo).
- [ ] Salva / Conferma. Vercel mostrerà qualcosa tipo “Root Directory: admin-dashboard”; i comandi di build si eseguiranno da lì.

**Se non trovi il campo:** vai dopo il deploy in **Settings → General** dello stesso progetto; in **Root Directory** trovi di nuovo il campo da editare (scrivi `admin-dashboard` e salva, poi Redeploy).

---

## 3. Variabili d’ambiente (obbligatorie per il build)

Le variabili `VITE_*` vengono **iniettate a build time** da Vite; vanno impostate nel progetto Vercel della dashboard.

- [ ] Nella stessa schermata del progetto (o dopo: **Settings → Environment Variables**), aggiungi:

  | Nome | Valore | Uso |
  |------|--------|-----|
  | `VITE_ADMIN_SECRET` | Stringa segreta (es. `openssl rand -hex 32`) | Build: SPA la invia in header. Stesso valore di `ADMIN_SECRET`. |
  | `ADMIN_SECRET` | **Stesso valore** di `VITE_ADMIN_SECRET` | Runtime: API `/api/admin` verifica l'header. |
  | `POSTGRES_URL` | **Stesso URL** del DB di auth-deploy (Supabase) | Runtime: API legge users, credit_transactions, affiliates. |

- [ ] **Non** impostare `VITE_ADMIN_API_URL` (lascialo vuoto): in produzione la SPA chiama same-origin.
- [ ] **Non** committare i secret. Dopo modifiche alle env, **Redeploy** (le `VITE_*` sono a build time).

---

## 4. Build e output (verifica automatica)

Vercel rileva di solito **Vite** e imposta:

- **Framework Preset:** Vite
- **Build Command:** `npm run build` (o `vite build`)
- **Output Directory:** `dist`
- **Install Command:** `npm install`

- [ ] In **Build & Development Settings** verifica che sia così. Se qualcosa è diverso:
  - Build Command: `npm run build`
  - Output Directory: `dist`
  - Root Directory: `admin-dashboard` (già impostata al passo 2).

---

## 5. Primo deploy

- [ ] Clicca **Deploy**. Attendi il build (install + `npm run build`).
- [ ] Controlla i **Build Logs**: devono finire con successo (es. “Build Completed”).
- [ ] Se il build fallisce: controlla che le variabili `VITE_ADMIN_API_URL` e `VITE_ADMIN_SECRET` siano impostate per l’ambiente usato (Production/Preview).

---

## 6. Dominio (consigliato: sottodominio privato)

- [ ] Vercel assegna un URL tipo `comtra-admin-dashboard-xxx.vercel.app`. Per uso interno è già sufficiente; puoi condividerlo solo con gli admin.
- [ ] **Opzionale — dominio custom:**  
  - Vai in **Settings → Domains** del progetto dashboard.  
  - Aggiungi un dominio (es. **`admin.comtra.dev`** o **`dashboard.comtra.dev`**).  
  - Nel provider DNS (dove è gestito `comtra.dev`): crea un record **CNAME** per `admin` (o `dashboard`) che punti al valore indicato da Vercel (es. `cname.vercel-dns.com`).  
  - Attendi la propagazione e la verifica in Vercel (status “Valid”).
- [ ] **Non** aggiungere il dominio della dashboard a sitemap o link pubblici del sito/plugin.

---

## 7. Verifica funzionamento

- [ ] Apri l’URL della dashboard (`.vercel.app` o il dominio custom).
- [ ] Dovresti vedere la **Home** con le card (Utenti, Crediti, Kimi, Affiliati, Funnel). Se vedi “Caricamento…” e poi **“Non autorizzato”** o errore di rete:
  - Controlla che `VITE_ADMIN_SECRET` e `ADMIN_SECRET` nel progetto dashboard siano **identici**.
  - Controlla che `POSTGRES_URL` nel progetto dashboard sia lo stesso DB di auth-deploy.
  - Fai un **Redeploy** della dashboard dopo aver corretto le env (le `VITE_*` sono bake-in al build).
- [ ] Clicca su **Utenti**, **Crediti e costi**, **Affiliati**: le pagine devono caricare dati (o “Nessun dato” se il DB è vuoto), senza 401.

---

## 8. Checklist post-deploy (sicurezza e manutenzione)

- [ ] Tieni il link della dashboard (e il dominio custom, se usato) **solo per gli admin**; non metterlo in README pubblico né nel plugin.
- [ ] Se cambi `ADMIN_SECRET` nel progetto dashboard, aggiorna anche `VITE_ADMIN_SECRET` e fai **Redeploy** (le API e la SPA usano lo stesso secret).
- [ ] Per aggiornare la dashboard: push sulla branch collegata (es. `main`); Vercel farà il redeploy automatico. Oppure **Deployments → … → Redeploy** manuale.

---

## Riepilogo comandi / riferimenti

| Cosa | Dove |
|------|------|
| API admin | **Progetto dashboard** (1 function: `api/admin.mjs`), non auth-deploy |
| Secret | Progetto dashboard: `ADMIN_SECRET` e `VITE_ADMIN_SECRET` (stesso valore) |
| DB | Progetto dashboard: `POSTGRES_URL` (stesso valore di auth-deploy) |
| Root progetto dashboard | `admin-dashboard` |
| Build | `npm run build` → output in `dist` |

Se qualcosa non torna (401, build fallito, dati non caricati), controlla: env progetto dashboard (`POSTGRES_URL`, `ADMIN_SECRET`, `VITE_ADMIN_SECRET`), redeploy dopo modifiche alle env.

---

## “Non vedo la cartella admin-dashboard” in Vercel

- **Vercel non mostra un albero di cartelle.** Non devi “scegliere” la cartella da un menu: in **Root Directory** c’è un **campo di testo**. Clicca **Edit** e scrivi a mano: `admin-dashboard`, poi salva.
- **Stai creando un progetto nuovo?** La dashboard è un **secondo** progetto (stesso repo, root diversa). Se stai guardando il progetto **auth-deploy**, lì la root è `auth-deploy`; per la dashboard crea un **nuovo** progetto dallo stesso repo e imposta root `admin-dashboard`.
- **La cartella è sul branch giusto?** Fai push della branch che Vercel usa (es. `main`): `git push origin main`. Vercel vede solo ciò che è nel repo remoto.
