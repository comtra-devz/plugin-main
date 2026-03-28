# Roadmap — intelligence da Notion → migliorie prodotto

Descrizione **semplice** delle fasi. L’ordine conta: ogni fase si appoggia alle precedenti.

---

## Fase 0 — Già in piedi (baseline)

- Leggere la pagina / database **Notion** da env.
- Estrarre i **link**, filtrare rumore (es. blocchi da escludere).
- **Dedup** degli URL tra una run e l’altra (così non rifai tutto ogni volta).
- **LinkedIn**: arricchimento con **Apify** (testo post + link nel post).
- **Cron** su Vercel **ogni giorno** + **gate giorni** (default **4** nel codice; `PRODUCT_SOURCES_CRON_GATE_DAYS` per override).
- Salvataggio **Markdown** in Postgres + **Discord** + **storico** in dashboard.

---

## Fase 1 — Fetch “web” generico (non LinkedIn)

- Per gli URL **nuovi** che sono **siti normali** (http/https), fare un **download leggero** della pagina e ricavare **testo** (senza dipendenze pesanti).
- **Limiti** per run: timeout, dimensione massima, numero massimo di URL (come per LinkedIn).
- **Opt-in** con variabile d’ambiente (`PRODUCT_SOURCES_FETCH_WEB=1` sul **cron**).
- Risultato nel **report MD** in una sezione dedicata.

*Obiettivo:* avere **contenuto** anche per blog, docs competitor, articoli, ecc.

### Fase 1 bis — Stessa cosa dalla dashboard (manuale)

- Checkbox **«Fetch web + strategia tipo URL»** in *Migliorie prodotto → Scansione manuale*, oppure body API `fetchWeb: true`.
- Opzionale: `PRODUCT_SOURCES_MANUAL_FETCH_WEB_DEFAULT=1` su Vercel per avere il fetch web attivo anche senza checkbox (attenzione ai tempi di richiesta).

---

## Fase 2 — Tipi di contenuto e strategia per dominio (**implementata — baseline**)

- **Classificazione** in `lib/product-source-fetch-strategy.mjs`: `html`, `github` (preferenza URL **raw** + fallback HTML repo), `youtube` e `social_x` (**stub** testuale senza API video/thread), `pdf_path` + rilevamento **PDF** binario (messaggio “decoder non attivo”).
- **Allowlist / blocklist** hostname: `PRODUCT_SOURCES_DOMAIN_ALLOWLIST`, `PRODUCT_SOURCES_DOMAIN_BLOCKLIST` (virgole o newline). Gli stub YouTube/X **non** sono bloccati dall’allowlist (non fanno fetch di rete oltre al controllo policy); restano soggetti alla **blocklist**.
- Estensioni future: altri actor Apify, parser PDF, transcript YouTube, ecc.

*Obiettivo:* meno errori e meno sprechi; comportamento **esplicito** per tipo di link.

---

## Fase 3 — Coda e spezzamento lavoro (scale) — **implementata (baseline)**

- Tabelle Postgres: `product_sources_queue_batches`, `product_sources_queue_jobs` (migration **`006_product_sources_queue.sql`**).
- Con **`PRODUCT_SOURCES_QUEUE_MODE=1`**, ogni run che passa il gate crea job: **LinkedIn** in chunk (`PRODUCT_SOURCES_QUEUE_LINKEDIN_CHUNK`, default 10 URL per job Apify), **web** un job per URL.
- Ogni **hit** al cron elabora al massimo **`PRODUCT_SOURCES_QUEUE_MAX_JOBS`** job (default 15), poi esce; il giorno dopo (o un secondo schedule / chiamata manuale) continua.
- Se esiste un batch con job **pending**, il cron **salta il gate temporale** e il Notion extract in quel hit: solo drain coda (evita stallo).
- **Finalizzazione** (Markdown, `product_sources_cron_runs`, Discord, `seen_urls`) solo quando non restano job pending.
- Dashboard **Storico cron & documenti**: banner stato coda + API `GET /api/product-sources-queue` (admin).

*Obiettivo:* niente timeout, pipeline **affidabile** con decine/centinaia di link.

**Test:** da fare in blocco a fine lavori (come da accordo); verificare migration 006, env queue, più hit cron con molti URL.

---

## Fase 4 — Snapshot documentazione plugin (**implementata — baseline**)

- Modulo `lib/plugin-doc-snapshot.mjs`: legge **URL** (`PRODUCT_SOURCES_DOC_FETCH_URLS`, es. raw GitHub) e/o file sotto **`PRODUCT_SOURCES_DOC_REPO_ROOT`** (path assoluta alla root del repo sul runner).
- Lista default di path relativi (ruleset, error messages, cursor rule, maintaining rules, …) se non imposti `PRODUCT_SOURCES_DOC_PATHS`.
- Limite dimensione: `PRODUCT_SOURCES_DOC_SNAPSHOT_MAX_TOTAL`, `MAX_FILE`, timeout fetch `DOC_FETCH_TIMEOUT_MS`.
- Il testo è incluso nel **report Markdown** (sezione dedicata) su ogni **cron** e opzionalmente in **scansione manuale** (checkbox / `includeDocSnapshot` / env default).
- `PRODUCT_SOURCES_PLUGIN_DOC_SNAPSHOT_DISABLE=1` per disattivare.

*Obiettivo:* il confronto non è nel vuoto, è **contro la doc reale**; in Fase 5 lo stesso blocco sarà input LLM.

---

## Fase 5 — Sintesi intelligente (LLM) — **implementata (opt-in)**

- Modulo `lib/product-sources-llm.mjs`; abilitazione: **`PRODUCT_SOURCES_LLM_SYNTHESIS=1`** + key/model (`PRODUCT_SOURCES_LLM_PROVIDER` moonshot | openai | custom | **gemini** | **groq**). **Gemini:** default `gemini-2.5-flash`, API `v1`. **Groq:** `GROQ_API_KEY`. Se quota/rate limit Gemini → messaggio nel report e retry automatico.
- Input: URL **nuovi** Notion, estratti **LinkedIn/web**, **snapshot doc** (se presente e non skipped).
- Output: sezione Markdown **«Sintesi proposte (LLM, Fase 5)»** nel report (struttura fissa: priorità, idee tecniche/strategiche, rischi, fonti).
- **Guardrail** in prompt: niente proposte “peggiorative”, niente breaking non richiesti, incertezza esplicita.
- **Manuale:** checkbox / `includeLlmSynthesis: true` su `POST /api/notion-product-sources`.
- **MCP (opzionale):** `PRODUCT_SOURCES_LLM_EXECUTION=mcp` — nessuna chiamata LLM su Vercel; bundle nel report + server `mcp/product-sources-synthesis` (Kimi dalla macchina di sviluppo).

*Obiettivo:* il report diventa un **backlog da revisionare**, non solo link e copia-incolla.

---

## Fase 6 — “Niente di nuovo, niente lavoro pesante” — **implementata (cron)**

- Modulo `lib/product-sources-phase6.mjs`: se **nessun URL nuovo** nel dedup **e** nessun lavoro LinkedIn (batch Apify) **e** nessun URL web da fetchare → **salta** Apify, fetch web e (salvo env) **non** costruisce lo snapshot doc.
- **`PRODUCT_SOURCES_SKIP_HEAVY_IF_NO_NEW_URLS=0`** disattiva lo skip.
- **`PRODUCT_SOURCES_SNAPSHOT_ON_NO_NEW=1`** forza lo snapshot anche senza URL nuovi.
- La **LLM** non viene chiamata se non c’è materiale utile (`PRODUCT_SOURCES_LLM_SYNTHESIS` resta disattivo di default).

*Obiettivo:* rispetto del ciclo (es. ogni 4 giorni) **senza** costi inutili.

---

## Fase 7 — Integrazione Git / docs — **implementata (baseline manuale)**

- **Workflow documentato** nel repo plugin: **`docs/PRODUCT-SOURCES-GIT-WORKFLOW.md`** (path archivio, naming file, checklist PR, link a storico dashboard).
- **Cartella versionabile:** **`docs/product-sources/archive/`** (`.gitkeep` + README) per snapshot opzionali dei report.
- **Dashboard:** già presenti `request_pr_stub`, **`set_pr_url`**, `reset_git` su `product_sources_cron_runs` (migration `005`).
- **UI:** scheda *Migliorie prodotto* — modale “Applica modifiche” con checklist Fase 7 e riferimento al doc.
- **Opzionale dopo:** branch + commit + PR **automatica** (non in scope: policy, secret, GitHub App).

---

## Dove siamo adesso

- **Fase 0** ok.
- **Fase 1** — fetch web opt-in nel cron + sezione report.
- **Fase 1 bis** — fetch web da API manuale + checkbox UI.
- **Fase 2** — strategia tipo URL + allow/block list + GitHub raw + stub social/video + PDF rilevato (senza parser binario).
- **Fase 3** — coda Postgres + chunk cron + bypass gate se pending + UI/API stato.
- **Fase 4** — snapshot docs/rules nel report (URL + filesystem configurabile).
- **Fase 5** — sintesi LLM opt-in nel report (cron + API/UI manuale).
- **Fase 6** — skip lavoro pesante cron quando non ci sono URL nuovi / batch LinkedIn / web da processare.
- **Fase 7** — doc Git/workflow + cartella `docs/product-sources/archive/` + checklist in UI; PR manuali, tracciamento URL in storico.
