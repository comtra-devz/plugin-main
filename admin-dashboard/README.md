# Comtra — Admin Dashboard

Interfaccia **riservata al team** per vedere cosa succede nel prodotto: utenti, crediti, richieste, contenuti e — da poco — la **pipeline “fonti da Notion”** (link, report, opzionale LLM).

Le **API** girano **nello stesso progetto Vercel** della dashboard (cartella `admin-dashboard/` nel monorepo). Così non appesantiscono il limite di funzioni su altri deploy (es. auth).

---

## In due parole: cosa c’è dentro

| Area | A cosa serve (semplice) |
|------|-------------------------|
| **Home / grafici** | Numeri e trend d’uso (crediti, esecuzioni, …). |
| **Utenti** | Elenco e dettaglio account collegati al backend. |
| **Crediti & token** | Consumi, ricariche, stime costi lato API. |
| **Affiliati, sconti, notifiche** | Gestione commerciale / messaggi agli utenti. |
| **Supporto & sicurezza** | Richieste, log sensibili, health check. |
| **Esecuzioni** | Traccia run degli agenti / job lato server. |
| **A/B test (Generate)** | Esperimenti sulla tab Generate. |
| **Contenuti → Documentazione** | Testi/help editabili serviti al plugin (se configurato). |
| **Contenuti → Migliorie prodotto (Notion)** | Estrae **link** da una pagina/database Notion, opzionalmente arricchisce (LinkedIn, web, doc interne, **sintesi LLM**), salva **report Markdown** in database e può avvisare **Discord**. |
| **Brand awareness** | Metriche e funnel touchpoint (se attivi). |

Nessuna delle funzioni sopra **apre PR su GitHub da sola**: il passaggio “metto il report nel repo” resta **manuale** (sicurezza), con guida in `docs/PRODUCT-SOURCES-GIT-WORKFLOW.md` nel monorepo plugin.

---

## Documentazione da leggere

| File | Contenuto |
|------|-----------|
| **[`docs/DASHBOARD-PLUGIN-COMUNICAZIONI.md`](../docs/DASHBOARD-PLUGIN-COMUNICAZIONI.md)** | Come dialogano dashboard e plugin Figma (nessun canale diretto “segreto”). |
| **[`docs/NOTION-PRODUCT-SOURCES.md`](docs/NOTION-PRODUCT-SOURCES.md)** | Guida completa Notion + cron + env (Apify, web, snapshot doc, **Gemini/Kimi**, Fase 6 leggera, **MCP** opzionale, Discord, Postgres). |
| **[`docs/PRODUCT-SOURCES-ROADMAP.md`](docs/PRODUCT-SOURCES-ROADMAP.md)** | Roadmap a fasi (0→7) del progetto “intelligence da Notion”. |
| **[`docs/PRODUCT-SOURCES-GIT-WORKFLOW.md`](../docs/PRODUCT-SOURCES-GIT-WORKFLOW.md)** | Fase 7: dal report Markdown al branch/PR nel repo. |
| **[`../docs/ADMIN-DASHBOARD-500-E-RIEPILOGO-SEZIONI.md`](../docs/ADMIN-DASHBOARD-500-E-RIEPILOGO-SEZIONI.md)** | Perché a volte le API rispondono 500 e riepilogo sezioni. |

---

## Accesso (login)

- **Flusso principale:** **magic link** via email (`POST /api/admin-auth`) + opzionale **2FA** (TOTP), sessione **JWT** poi inviata come `Authorization: Bearer …` alle API.
- Serve **email configurata** (tabella admin su DB) oppure, in emergenza, **`ALLOWED_ADMIN_EMAIL`** uguale alla tua email (senza dover creare la riga a mano).
- **Resend:** `RESEND_API_KEY` (e opzionalmente `RESEND_FROM`, `ADMIN_DASHBOARD_URL`) per inviare il link.
- **`ADMIN_DASHBOARD_URL`:** URL pubblico **canonico** della dashboard (es. `https://admin.comtra.dev`, senza slash finale). Oltre al magic link, serve ai campi **`open_url`** delle notifiche API e ai **link cliccabili** nel messaggio Discord del cron (`/api/cron-notify-discord`). Se manca, in produzione si usa `https://$VERCEL_URL` (spesso diverso dal dominio custom).
- **Compatibilità:** alcune integrazioni accettano ancora **`ADMIN_SECRET`** come Bearer (stesso valore per tutte le chiamate “da script”).

Dettaglio variabili: vedi **[`.env.example`](.env.example)**.

---

## Database (Postgres)

La dashboard legge/scrive sul **solito Postgres** usato dal backend Comtra (`POSTGRES_URL` / `DATABASE_URL` su Vercel).

**Migration utili per “Migliorie prodotto” e cron:**

| File | Cosa aggiunge (semplice) |
|------|---------------------------|
| `migrations/003_product_sources_cron.sql` | Storico delle run cron + gate “non ripetere troppo spesso”. |
| `migrations/004_product_sources_seen_urls.sql` | URL già visti (dedup tra un cron e l’altro). |
| `migrations/005_product_sources_git_discord.sql` | Stato Discord + **URL PR GitHub** registrato a mano. |
| `migrations/006_product_sources_queue.sql` | **Coda** di job (LinkedIn/web spezzati) se abiliti la modalità coda. |

Eseguile **in ordine** sullo stesso database della produzione.

---

## Cron su Vercel (questo progetto)

Definiti in [`vercel.json`](vercel.json):

| Path | Orario (UTC) | Ruolo |
|------|----------------|------|
| `/api/cron-notify-discord` | 08:00 | Notifiche **admin** su Discord: legge `route=notifications`, un link **Apri in dashboard** per voce (stesso `?redirect=` della SPA). Imposta **`ADMIN_DASHBOARD_URL`** per URL corretti col dominio custom. |
| `/api/cron-product-sources` | 09:00 UTC **ogni giorno** | Invocazione giornaliera; il **lavoro completo** (Notion, Apify, …) rispetta il **gate** (default **4 giorni** tra due run OK — `PRODUCT_SOURCES_CRON_GATE_DAYS`). Gli altri giorni → `skipped`. Timeout lungo (300s) se esegue tutto. |

Entrambe richiedono in genere **`CRON_SECRET`** (query `?key=` o header) — vedi commenti in cima a `api/cron-product-sources.mjs` e `api/cron-notify-discord.mjs`.

---

## API “pubbliche” della dashboard (panoramica)

Oltre a **`/api/admin`** (router unico con `?route=…`), ci sono handler dedicati:

- **`/api/admin-auth`** — Magic link, login, 2FA.
- **`/api/notion-product-sources`** — Scansione manuale Notion (POST, lenta se Apify/web/LLM).
- **`/api/cron-product-sources`** — Cron giornaliero fonti prodotto.
- **`/api/product-sources-runs`** — Lista/dettaglio run + azioni Git stub / URL PR.
- **`/api/product-sources-queue`** — Stato coda (Fase 3).
- **`/api/cron-notify-discord`** — Cron notifiche.
- **`/api/recharge`**, **`/api/doc-content`** — Altri flussi già presenti.

---

## Variabili d’ambiente (raggruppate, semplice)

**Sempre utili in produzione**

- `POSTGRES_URL` — Database.
- `ADMIN_SECRET` — Oltre al JWT: chiave per script e compatibilità.
- `CRON_SECRET` — Protezione dei cron.
- `ADMIN_NOTIFICATIONS_WEBHOOK_URL` — Webhook Discord per il cron **08:00** (notifiche admin; vedi `api/cron-notify-discord.mjs`).
- `RESEND_*` + `ADMIN_DASHBOARD_URL` — Magic link (se usi quella login).

**Notion / fonti prodotto** (solo se usi quella sezione)

- `NOTION_INTEGRATION_TOKEN`, `NOTION_PRODUCT_SOURCES_PAGE_ID` **o** `NOTION_PRODUCT_SOURCES_DATABASE_ID`
- Opzionali: Apify (`APIFY_*`), fetch web (`PRODUCT_SOURCES_FETCH_WEB`), snapshot doc plugin (`PRODUCT_SOURCES_DOC_*`), coda (`PRODUCT_SOURCES_QUEUE_MODE`), Fase 6 (`PRODUCT_SOURCES_SKIP_HEAVY_*`, `…SNAPSHOT_ON_NO_NEW`), LLM (`PRODUCT_SOURCES_LLM_*`, `GEMINI_API_KEY`), Discord webhook, ecc.

La lista completa e i default stanno in **`docs/NOTION-PRODUCT-SOURCES.md`**.

**Frontend (build Vite)**

- `VITE_ADMIN_SECRET` — Stesso segreto usato dal browser per firmare/chiamare le route admin (allineato a `ADMIN_SECRET` dove previsto).
- `VITE_ADMIN_API_URL` — In **locale** puoi puntare al deploy remoto; in **produzione** lascia **vuoto** (same-origin `/api/...`).

---

## MCP (opzionale, fuori da Vercel)

Se non vuoi chiamare l’LLM dal server (risparmio su deploy), puoi usare il server MCP in **`../mcp/product-sources-synthesis/`** con `PRODUCT_SOURCES_LLM_EXECUTION=mcp`. Istruzioni nel README di quella cartella.

---

## Sviluppo locale

```bash
cd admin-dashboard
npm install
npm run dev
```

Apri l’URL indicato dal dev server (spesso porta **3001**). Senza DB/segreti corretti, molte pagine risponderanno errore o 401 — è normale.

## Build e deploy Vercel

```bash
npm run build
```

- **Root Directory del progetto Vercel:** `admin-dashboard`
- **Dominio:** meglio un host **non pubblicizzato** (es. `admin.…`) e accesso solo al team.

---

## Riepilogo

La dashboard è il **pannello operativo** del backend Comtra; la parte **Notion** aggiunge un flusso automatico/manuale per **raccogliere fonti**, **generare un documento Markdown**, opzionalmente **sintetizzarlo con un LLM** (es. Gemini free tier), e **tracciare** su DB/Discord/Git **senza** modificare il repo da sola. Per il resto delle funzioni, usa le voci menu e la documentazione linkata sopra.
