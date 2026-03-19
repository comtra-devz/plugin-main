# Migliorie prodotto — Notion, cron, Apify (LinkedIn)

## Cosa fa il sistema

1. **UI admin** — *Content Management → Migliorie prodotto (Notion)*: estrae i link da una pagina o database Notion e genera un report Markdown (`POST /api/notion-product-sources`).
2. **Cron giornaliero** — `GET /api/cron-product-sources` (Vercel, **06:00 UTC**): legge Notion dagli env, estrae i link, arricchisce i post **LinkedIn** con **Apify**, salva il report in Postgres e opzionalmente invia un riepilogo su **Discord**.
3. **Gate 3 giorni**: dopo una run **OK**, le run successive entro 72 ore vengono **saltate** (salvate come `skipped` nel DB). Così il cron può essere giornaliero senza sovraccaricare Notion/Apify.

---

## Checklist: cosa devi fare tu

### 1) Notion

1. Crea un’[integration Notion](https://www.notion.so/my-integrations) (Internal).
2. **Condividi** la pagina o il database delle fonti con l’integration (Share → Invite).
3. Copia il **secret** → su Vercel (progetto **admin-dashboard**): `NOTION_INTEGRATION_TOKEN` (o `NOTION_TOKEN`).
4. Copia l’**ID** della pagina o del database dall’URL Notion → imposta **uno** di:
   - `NOTION_PRODUCT_SOURCES_PAGE_ID`
   - `NOTION_PRODUCT_SOURCES_DATABASE_ID`  
   (Il cron usa **solo** questi env, non l’input della UI.)

### 2) Database Postgres (gate + storico report)

1. Esegui la migration sullo **stesso DB** già usato dalla dashboard (`POSTGRES_URL` / `DATABASE_URL`):
   - File: [`migrations/003_product_sources_cron.sql`](../migrations/003_product_sources_cron.sql)
2. Senza questa tabella il cron **funziona comunque** ma **non** applica il gate 3 giorni (ogni giorno esegue una run completa).

### 3) Apify (LinkedIn)

1. Crea un account [Apify](https://apify.com) e genera un **API token**.
2. Su Vercel: `APIFY_TOKEN=<token>`.
3. Scegli un **Actor** dallo Store che accetti URL di post LinkedIn (es. cerca “LinkedIn post”). Copia l’ID actor nel formato `username~nome-actor` (come in Apify Console).
4. Su Vercel: `APIFY_LINKEDIN_ACTOR_ID=username~nome-actor`.
5. Se l’actor richiede un input diverso dal default, imposta:
   - `APIFY_LINKEDIN_INPUT_MODE=postUrls` *(default)* — body `{ postUrls: [{ url }, ...] }`
   - oppure `urls` — `{ urls: ["...", ...] }`
   - oppure `startUrls` — `{ startUrls: [{ url }, ...] }`  
   Allinea il valore alla documentazione **Input** dell’actor che hai scelto.
6. Opzionale: `PRODUCT_SOURCES_MAX_LINKEDIN_PER_RUN` (default **20**) — massimo numero di URL LinkedIn processati per run.

> Il codice prova a mappare il **dataset** in testo + link; se l’actor restituisce campi con nomi diversi, potresti dover cambiare actor o adattare in seguito i campi in `lib/apify-linkedin.mjs`.

### 4) Cron Vercel + secret

1. Su Vercel deve esistere **`CRON_SECRET`** (stesso concetto di `/api/cron-notify-discord`).
2. Il file [`vercel.json`](../vercel.json) include già:
   - `"path": "/api/cron-product-sources"`, `"schedule": "0 6 * * *"` (ogni giorno 06:00 UTC).
3. Test manuale (dal browser o curl, **non** committare il secret):
   ```bash
   curl -sS "https://<tuo-dominio-vercel>/api/cron-product-sources?key=CRON_SECRET"
   ```
4. Forzare una run ignorando il gate 3 giorni (solo debug):
   ```bash
   curl -sS "https://<tuo-dominio-vercel>/api/cron-product-sources?key=CRON_SECRET&force=1"
   ```

### 5) Discord (opzionale)

- `PRODUCT_SOURCES_CRON_WEBHOOK_URL` oppure `DISCORD_PRODUCT_SOURCES_WEBHOOK_URL`  
  URL webhook `https://discord.com/api/webhooks/...`  
  Riceve un embed con statistiche e **anteprima troncata** del Markdown. Il report **completo** è in DB: `product_sources_cron_runs.report_markdown`.

### 6) UI manuale

- Continua a usare **Migliorie prodotto (Notion)** per prove senza aspettare il cron.
- La doppia conferma “Applica su Git” resta **stub** (nessuna modifica automatica al repo).

---

## API admin (estrazione solo Notion)

`POST /api/notion-product-sources` — auth admin (JWT o secret).

Body: `{ "pageId": "..." }` o `{ "databaseId": "..." }` oppure rely su env come prima.

`Antigravity` è sempre filtrato a livello di blocco (nessun link estratto da quel blocco).

---

## Consultare gli ultimi report (SQL)

```sql
SELECT id, ran_at, status, skipped, link_count, linkedin_urls_attempted,
       notion_mode, notion_source_id, left(report_markdown, 200) AS preview
FROM product_sources_cron_runs
ORDER BY id DESC
LIMIT 10;
```

---

## Non ancora implementato

- Apertura automatica di **branch/PR** sul repo plugin dopo conferma in UI.
- Fetch generico di ogni URL non-LinkedIn (solo lista link nel report).
