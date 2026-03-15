# Sync — Caso comune: Storybook pubblico, privato con token, push via Git

Documento per il **caso d’uso normale** (non Enterprise/SSO): **Storybook pubblico** o **Storybook privato con Bearer token**, e **push** delle correzioni tramite **Opzione A (Git)** il più seamless possibile. Include il **requisito Git** e il suggerimento di creare un repo se manca.

---

## 1. Storybook pubblico vs Storybook privato con Bearer token

### 1.1 Storybook pubblico

- Lo Storybook è **deployato su un URL raggiungibile da chiunque** (es. Vercel, Netlify, GitHub Pages, Chromatic con link pubblico).
- In Comtra: l’utente inserisce **solo l’URL** e clicca Connect. Il backend chiama quell’URL (es. `GET <url>/api/stories`) **senza** inviare credenziali.
- Casi tipici: progetti open source, staging condiviso, Chromatic con visibilità pubblica.

### 1.2 Storybook privato con Bearer token

- Lo Storybook (o un reverse proxy davanti) è **protetto**: le richieste HTTP devono essere **autenticate**.
- **Cosa significa “Bearer token”?**  
  È uno standard HTTP: il client invia l’header  
  `Authorization: Bearer <token>`  
  Il server controlla il token e, se valido, restituisce i dati; altrimenti risponde 401. In Comtra l’utente incolla il token nel campo “Access token (optional)”; il backend lo invia in ogni richiesta allo Storybook. Non c’è login nel browser: è un token (API key, token di servizio, ecc.) che l’utente ottiene dalla piattaforma dove ha deployato lo Storybook (es. Chromatic, server con auth, gateway).
- In Comtra: l’utente inserisce **URL + token** (opzionale). Se il token è presente, il backend lo invia come `Authorization: Bearer <token>` quando chiama `/api/stories`, `/api/components`, ecc.
- Casi tipici: Storybook su Chromatic privato, server interno con API key, proxy con Bearer.

**Riassunto:** Il caso comune coperto è: **solo URL** (pubblico) oppure **URL + token** (privato con Bearer). Non rientra in questo caso lo Storybook protetto **solo da SSO/login nel browser** (vedi `docs/SYNC-ENTERPRISE-SSO.md`).

---

## 2. Push: Opzione A (Git) e flusso seamless

- **Opzione A:** Le correzioni (Sync Fix / Sync All) vengono **scritte nel codice** e **pushate nel repository Git** (GitHub o Bitbucket). Storybook si aggiorna quando il repo viene buildato (CI o locale).
- **Flusso seamless che vogliamo:**
  1. Connect **Storybook** (URL ± token) per **leggere** e fare drift scan.
  2. Connect **Git** (GitHub o Bitbucket) per **scrivere**: Sync Fix / Sync All = generiamo le modifiche (file storie, token, ecc.) e le inviamo al repo (commit o PR).
  3. L’utente vede “Drift Detected” → clic “Sync Fix” o “Sync All” → le modifiche appaiono nel repo; al prossimo build, Storybook riflette il codice.

Obiettivo: minimizzare passi (una volta connessi Storybook + Git, il push è un click) e dare feedback chiaro (es. “PR created” o “Changes pushed”).

---

## 3. Requisito Git: è realistico il caso senza Git?

- **In pratica no.** Lo Storybook è quasi sempre **costruito da sorgente**: i file `.stories.*` e i componenti vivono in un **repository Git**. Senza repo non c’è “codice da aggiornare”; al massimo possiamo mostrare diff/codice da copiare (export/copy), ma non un vero “push”.
- **Quindi:** per il flusso **push (Opzione A)** richiediamo che ci sia **un repository** (GitHub o Bitbucket) collegato. L’UI e la doc devono essere chiare: “Per inviare le correzioni al codice serve una connessione Git.”
- **Se l’utente non ha un repo:** possiamo **suggerire di crearne uno** e collegare lo Storybook a quel repo (es. “Create a GitHub repo, add your Storybook project, then connect it here. Your Storybook is usually built from this repo.”). In questo modo il caso “senza Git” diventa “primo setup: crea repo → connetti Storybook (build da repo) → connetti Git in Comtra”.

---

## 4. Come sapere se l’URL funziona — quale URL usare

- **Quale URL inserire:** Lo **stesso URL** con cui il team apre lo Storybook nel browser (es. `https://design-system.vercel.app`, `https://main--xxx.chromatic.com`, oppure un URL ngrok per test in locale). Non serve un URL “speciale”: è l’indirizzo pubblico (o con token) dello Storybook deployato.
- **Come facciamo a sapere se esistono gli endpoint:** Al clic su **Connect Storybook** il backend prova a chiamare quell’URL su **GET /api/stories**, poi **GET /api/components**, poi **GET /index.json**. Se una di queste risponde con JSON valido (elenco storie/componenti), la connessione è **ok** e l’utente vede “Connected”. Se nessuna risponde, mostriamo un messaggio chiaro (es. “Stories API not found at this URL”) così il team capisce subito che l’URL non espone ancora l’API.
- **Come può un team ottenere un URL che funziona senza difficoltà:**
  1. **Se usano già storybook-api (npm)** nello stesso progetto Storybook: l’URL che usano per aprire Storybook è già quello giusto; le route `/api/stories` e `/api/components` sono esposte dall’addon.
  2. **Se non hanno l’API:** aggiungere **storybook-api** al progetto Storybook (o un server/export che esponga lo stesso formato). Dopo il deploy, lo stesso URL dello Storybook funziona in Comtra.
  3. **Setup minimo:** build Storybook + server o serverless che espone `/api/stories` (es. Vercel function `api/stories.js`), oppure usare **storybook-api** nel progetto Storybook.

In sintesi: **non devono indovinare**. Inseriscono l’URL che già conoscono; noi verifichiamo al Connect e, se manca l’endpoint, lo diciamo chiaramente e indichiamo come aggiungerlo. Nel plugin, un box in fondo al form “Your URL doesn’t work yet?” apre una **modale guida** (“How to expose the stories API”) con le stesse istruzioni; la guida completa è in **`docs/SYNC-STORYBOOK-URL-GUIDE.md`**.

---

## 5. Cosa fare in prodotto (UI e copy)

- **Storybook (tab):**
  - Chiarire in UI: **pubblico** = solo URL; **privato** = URL + “Access token” (spiegare in un hint: “We send it as Authorization: Bearer &lt;token&gt; when fetching your stories”).
  - Sotto la lista drift / sopra Sync Fix e Sync All: messaggio tipo “Push requires a connected Git repository. Connect GitHub or Bitbucket to push changes. Don’t have a repo? Create one and link your Storybook to it.”
- **Tab GitHub / Bitbucket:** quando le integrazioni saranno disponibili, il flusso sarà: Connect → poi Sync Fix / Sync All effettuano il push (commit/PR) in modo seamless.
- **Doc e help:** puntare a questo documento per “caso comune”, a `SYNC-ENTERPRISE-SSO.md` per SSO/Enterprise.

---

## 6. URL custom vs manifest Figma

Gli URL **non** in elenco preset (es. Storybook su Vercel/Netlify dell’utente) non possono essere raggiunti con una fetch **dal plugin** (Figma consente solo i domini in `manifest.json` → `networkAccess.allowedDomains`). Per questi URL il plugin chiama **solo il backend** (`auth.comtra.dev`), che fa la richiesta allo Storybook da server (nessun blocco CSP). Quindi gli URL custom funzionano senza aggiungerli al manifest; va solo garantito che il backend sia raggiungibile e che risponda con CORS adeguato (origin `null` per iframe Figma).

**Se aggiungi un nuovo preset Storybook:** aggiungi l’**origin** (es. `https://nuovo-host.com`) in due posti: `manifest.json` → `allowedDomains` e `views/Code/tabs/SyncTab.tsx` → `CLIENT_ALLOWED_STORYBOOK_ORIGINS`, così il check può essere fatto anche da client per quel preset.

---

## 7. Riferimenti

- **Guida “Come esporre l’API Storybook”:** `docs/SYNC-STORYBOOK-URL-GUIDE.md` (cosa serve, formato JSON, opzioni A/B/C, test locale). Nel plugin: modale da box “Your URL doesn’t work yet?”.
- **Flusso Sync:** `docs/SYNC-INVESTIGATION.md`
- **Enterprise / SSO:** `docs/SYNC-ENTERPRISE-SSO.md`
