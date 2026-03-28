# Migliorie prodotto — Notion, cron, Apify (LinkedIn)

## Roadmap in fasi (semplice)

Vedi **[PRODUCT-SOURCES-ROADMAP.md](./PRODUCT-SOURCES-ROADMAP.md)** (Fase 0 → 7).

## Cosa fa il sistema

1. **UI admin** — *Content Management → Migliorie prodotto (Notion)*: estrae i link da Notion e genera un report Markdown (`POST /api/notion-product-sources`). Opzionale: **LinkedIn Apify**, **Fetch web (Fase 2)**, **Snapshot doc (Fase 4)**, **Sintesi LLM (Fase 5)** — stessi limiti env del cron dove applicabile; richieste lunghe.
2. **Cron giornaliero** — `GET /api/cron-product-sources` (Vercel, orario in `vercel.json`, es. **09:00 UTC**): legge **automaticamente** Notion dagli env (`NOTION_PRODUCT_SOURCES_PAGE_ID` / `DATABASE_ID`), estrae **tutti** i link, arricchisce i post **LinkedIn** con **Apify** (policy sotto), salva il report in Postgres (**storico dashboard**) e opzionalmente invia riepilogo + report su **Discord**.
3. **Gate temporale** (default **4 giorni** nel codice): il cron Vercel viene chiamato **ogni giorno**, ma dopo una run **OK** (non `skipped`) le chiamate successive entro **N giorni** sono **saltate** (`skipped` nel DB) — niente Notion/Apify in quel giorno. Imposta **`PRODUCT_SOURCES_CRON_GATE_DAYS`** su Vercel solo se vuoi un valore diverso da 4 (o più frequente, es. `3`).

---

## Requisiti prodotto (fonte di verità — non perdere)

Questa sezione fissa **cosa deve fare la pipeline** (indipendentemente da thread / NanoClaw / Vercel). Il codice può essere incompleto: qui resta il **bersaglio**.

### Decisioni confermate

| Tema | Indicazione |
|------|-------------|
| **LinkedIn / Apify** | **Niente commenti** sui post LinkedIn. L’actor Apify configurato va bene: ci interessano **post (testo) + link outbound** presenti nel dataset, non i commenti. |
| **Output “documento”** | Il report non è solo per DB o copia manuale: deve essere **leggibile e utile anche su Discord** (struttura, titoli, messaggio che si capisce in channel). Oggi Discord riceve un **embed con anteprima troncata**; il testo completo è in `product_sources_cron_runs.report_markdown` — migliorare l’esperienza Discord resta in backlog se serve più che anteprima. |
| **Limitazioni (scope)** | Solo **link** estratti da Notion (blocchi + proprietà URL/testo con link). **Ignorare** blocchi/testo che contengono **Antigravity**. Niente “suggerimenti di codice” non ancorati a URL. Non espandere lo scope oltre quanto richiesto. |

### Indicazioni da rispettare (obiettivo funzionale)

1. **Link** — Identificare **tutti** i link rilevanti da Notion (dedup per URL normalizzato **dentro** la run).
2. **Sessioni future** — Nelle run successive **non ri-esaminare** gli URL già processati (dedup **persistente** tra run, indipendente dal gate giornaliero sul cron).
3. **Fetch** — Per **LinkedIn**: fetch via Apify come oggi (senza commenti). Per **altri URL**: policy esplicita (solo elenco da Notion vs fetch pagina) da allineare al requisito “fetch di ogni link” se confermato (oggi: **non** fetchati).
4. **Documento ruleset / docs** — Un testo che aiuti a capire **cosa può migliorare** ruleset e documentazioni da cui attingono le funzioni (richiede sintesi strutturata e/o LLM se non banale).
5. **Chiarezza e sicurezza** — In linguaggio semplice: **cosa andrà toccato** (aree/ sezioni). **Guardrail espliciti**: migliorie sì; niente peggioramenti, cambiamenti confusionari o breaking non voluti.

### Stato rispetto al codice attuale (snapshot)

| Requisito | Stato approssimativo |
|-----------|----------------------|
| Link da Notion + filtri Antigravity / solo URL | **Fatto** (estrazione + report). |
| Dedup URL **tra run** (“già esaminati”) | **Fatto** (tabella `product_sources_seen_urls` + Apify solo su LinkedIn **nuovi**). |
| LinkedIn post + outbound, **no commenti** | **Allineato** con actor attuale + mapping dataset. |
| Fetch di ogni link non-LinkedIn | **Parziale** (opt-in: cron `PRODUCT_SOURCES_FETCH_WEB` + manuale `fetchWeb`; strategia tipo URL Fase 2 in `product-source-fetch-strategy.mjs`). |
| Documento tipo “migliora ruleset” + cosa toccherà + guardrail | **Parziale** (Fase 4 snapshot + Fase 5 LLM opt-in + euristica “area ruleset”). |
| Discord come **canale del documento** | **Migliorato** (riepilogo + report spezzato in più messaggi/embed). |

*Aggiorna questa tabella quando implementi una voce.*

---

## Checklist: cosa devi fare tu

### 1) Notion

1. **Stesso workspace:** l’integration e le pagine dei link devono stare nello **stesso spazio di lavoro Notion** (stesso account/team).
2. Crea un’[integration interna](https://www.notion.so/my-integrations), copia il **secret** → Vercel: `NOTION_INTEGRATION_TOKEN`.
3. **Collega** l’integration alla pagina o al database delle fonti (menu **Condividi** → connessioni / invito all’integration) con permesso di **lettura**.
4. Copia l’**ID** (UUID) dalla URL della risorsa → **un solo** env tra `NOTION_PRODUCT_SOURCES_PAGE_ID` e `NOTION_PRODUCT_SOURCES_DATABASE_ID` (dettaglio sotto nella guida Notion).
5. Il **cron** legge solo questi env; la UI admin può incollare ID diversi per prove manuali.

### 2) Database Postgres (gate + storico report + dedup URL)

1. Esegui le migration sullo **stesso DB** già usato dalla dashboard (`POSTGRES_URL` / `DATABASE_URL`):
   - [`migrations/003_product_sources_cron.sql`](../migrations/003_product_sources_cron.sql) — storico run + supporto al gate temporale (giorni configurabili via env)
   - [`migrations/004_product_sources_seen_urls.sql`](../migrations/004_product_sources_seen_urls.sql) — **URL già esaminati** (dedup tra run; Apify solo su LinkedIn nuovi)
   - [`migrations/006_product_sources_queue.sql`](../migrations/006_product_sources_queue.sql) — **Fase 3:** coda batch/job (opzionale; serve se usi `PRODUCT_SOURCES_QUEUE_MODE`)
2. Senza `003` il cron **funziona comunque** ma **non** applica il gate temporale / storico strutturato.
3. Senza `004` il cron logga un warning e **non** deduplica (comportamento precedente: Apify su tutti i LinkedIn fino al cap).

**Dove finiscono i Markdown:** ogni run OK scrive il report in **`product_sources_cron_runs.report_markdown`** (una riga per run). La prima passata è di solito la più lunga; le successive sono spesso più brevi perché elencano soprattutto **link nuovi** e una lista compatta di **già visti**.

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
6. Opzionale: `PRODUCT_SOURCES_MAX_LINKEDIN_PER_RUN` (default **20**) — massimo URL LinkedIn per **singolo batch Apify** in una run. **Non è un limite di prodotto assoluto:** è un default **ingegneristico** (timeout serverless, costi Apify, affidabilità). Con piano Vercel e budget adeguati puoi portarlo a **50**, **100**, ecc. e valutare **run spezzate** o **code** se superi i minuti di `maxDuration`.
7. Opzionale: `PRODUCT_SOURCES_LINKEDIN_REFETCH_ALL=1` — a ogni run **completa** (quando il gate lo consente, es. ogni ~4 gg con default), Apify riceve **tutti** i LinkedIn unici presenti in Notion (nell’ordine dell’estrazione), fino al cap del punto 6. **Default (assente/falso):** Apify solo su LinkedIn **nuovi** rispetto a `product_sources_seen_urls` (risparmio costi).
8. Opzionale: `APIFY_LINKEDIN_WAIT_SECONDS` — secondi di **waitForFinish** verso Apify (default nel codice **300**). Deve essere **inferiore** al tempo massimo della funzione Vercel (vedi sotto) meno il tempo impiegato da Notion/DB.
9. Opzionale: `PRODUCT_SOURCES_SKIP_LINKEDIN=1` — non chiama Apify; i link LinkedIn restano in elenco con messaggio “saltato” (utile per testare Notion/Postgres su piani con timeout bassi).

### 3b) Fetch web + strategia tipo URL (Fase 1–2)

**Cron:** opt-in **`PRODUCT_SOURCES_FETCH_WEB=1`**. Solo URL **nuovi** nel dedup (come LinkedIn Apify).

**Manuale:** checkbox in UI oppure `"fetchWeb": true` nel body. Opzionale default sempre attivo: **`PRODUCT_SOURCES_MANUAL_FETCH_WEB_DEFAULT=1`** (attenzione ai tempi).

Comportamento (modulo `lib/product-source-fetch-strategy.mjs` + `fetch-generic-web.mjs`):

| Tipo | Cosa fa |
|------|---------|
| **html** | GET + HTML → testo grezzo |
| **github** | Preferenza `raw.githubusercontent.com` per path `/blob/`; se fallisce, fallback pagina HTML |
| **youtube** | Stub Markdown (nessuna trascrizione automatica) |
| **social_x** | Stub (X/Twitter; nessun fetch thread) |
| **pdf** / **.pdf** | Rilevamento `Content-Type` o firma `%PDF-` — messaggio “decoder non attivo” |

**Limiti (condivisi cron + manuale):**

- `PRODUCT_SOURCES_MAX_WEB_FETCH_PER_RUN` (default **15**, max **100**)
- `PRODUCT_SOURCES_WEB_FETCH_TIMEOUT_MS` (default **18000**)
- `PRODUCT_SOURCES_WEB_FETCH_MAX_CHARS` (default **48000**)
- `PRODUCT_SOURCES_FETCH_USER_AGENT` (opzionale)

**Policy hostname:**

- **`PRODUCT_SOURCES_DOMAIN_BLOCKLIST`** — host da non processare (virgole o newline). Vale anche per stub YouTube/X.
- **`PRODUCT_SOURCES_DOMAIN_ALLOWLIST`** — se **non vuota**, solo questi host ricevono **GET HTTP** reale. Gli stub **YouTube / X** non sono soggetti all’allowlist (nessun GET esterno oltre ai controlli), ma restano soggetti alla **blocklist**.

> Siti **SPA / anti-bot / login** spesso restituiscono poco testo → backlog Apify actor dedicati.

> Il codice Apify **LinkedIn** mappa il dataset in `lib/apify-linkedin.mjs` (indipendente da questa sezione).

#### Vercel: errore 500 / `FUNCTION_INVOCATION_FAILED` (pagina generica)

Succede spesso quando la funzione viene **terminata dal runtime** prima che risponda (non è un `catch` JavaScript).

- **Causa tipica:** Apify viene chiamato con attesa fino a **300s**; su **Vercel Hobby** le funzioni serverless hanno un limite di circa **10s**. Scade il tempo → crash senza JSON.
- **Cosa fare:**
  1. **Controlla i log** (Vercel → Deployment → Functions → `cron-product-sources`) per conferma (timeout / killed).
  2. **Piano Pro (o superiore):** in [`vercel.json`](../vercel.json) è impostato `maxDuration: 300` per `api/cron-product-sources.mjs` così la run può attendere Apify.
  3. **Piano Hobby / test rapido:** imposta `PRODUCT_SOURCES_SKIP_LINKEDIN=1` **oppure** non configurare `APIFY_TOKEN` (il cron salta l’arrichimento ma dovresti ricevere **JSON** `200` con i link Notion).
  4. **Webhook Discord:** sono accettati sia `https://discord.com/api/webhooks/...` sia `https://discordapp.com/api/webhooks/...`.

### 3c) Coda Fase 3 (opzionale — molti URL)

- **`PRODUCT_SOURCES_QUEUE_MODE=1`** — spezza LinkedIn (chunk Apify) e fetch web (1 job per URL) su più invocazioni cron.
- **`PRODUCT_SOURCES_QUEUE_MAX_JOBS`** (default **15**, max **80**) — job elaborati per singolo GET `/api/cron-product-sources`.
- **`PRODUCT_SOURCES_QUEUE_LINKEDIN_CHUNK`** (default **10**) — quanti URL LinkedIn per **singola** chiamata Apify in un job.
- Con batch **pending**, il cron **non** applica il gate giorni e **non** rilegge Notion in quel hit: consuma solo la coda (così non resta bloccata).
- Report + Discord + `seen_urls` solo a **coda vuota** (stessa run logica della pipeline inline).
- **Dashboard:** scheda *Storico cron & documenti* mostra un avviso se c’è batch attivo; **`GET /api/product-sources-queue`** (admin) elenco batch.
- Per svuotare la coda in poche ore: secondo **cron** Vercel sullo stesso path o chiamate manuali con `?key=CRON_SECRET`.

### 3d) Snapshot documentazione plugin (Fase 4)

Obiettivo: ancorare le fonti Notion al **contesto ufficiale** del plugin (rules, ruleset, messaggi errore, ecc.) dentro lo stesso report Markdown (e in futuro input LLM).

| Variabile | Ruolo |
|-----------|--------|
| `PRODUCT_SOURCES_DOC_FETCH_URLS` | Uno o più URL (virgole o newline), es. `https://raw.githubusercontent.com/org/repo/main/docs/GENERATION-ENGINE-RULESET.md` — ideale su **Vercel** senza filesystem repo |
| `PRODUCT_SOURCES_DOC_REPO_ROOT` | Path **assoluta** alla root del monorepo sul processo che esegue il cron (spesso solo **locale** o runner self-hosted) |
| `PRODUCT_SOURCES_DOC_PATHS` | Path relativi opzionali (virgole/newline); se vuoto si usa una **lista default** in codice (`docs/GENERATION-ENGINE-RULESET.md`, `.cursor/rules/generation-engine.mdc`, …) |
| `PRODUCT_SOURCES_DOC_SNAPSHOT_MAX_TOTAL` | Caratteri massimi nel corpo snapshot (default ~450k) |
| `PRODUCT_SOURCES_DOC_SNAPSHOT_MAX_FILE` | Max caratteri per singolo file/URL (default ~180k) |
| `PRODUCT_SOURCES_DOC_FETCH_TIMEOUT_MS` | Timeout per ogni URL (default 20000) |
| `PRODUCT_SOURCES_PLUGIN_DOC_SNAPSHOT_DISABLE` | `1` = nessuno snapshot |

**Manuale:** checkbox *Snapshot documentazione plugin* oppure `"includeDocSnapshot": true`; env `PRODUCT_SOURCES_MANUAL_DOC_SNAPSHOT_DEFAULT=1` per default on.

### 3e) Sintesi LLM (Fase 5)

Modulo `lib/product-sources-llm.mjs`. **Opt-in costi:** `PRODUCT_SOURCES_LLM_SYNTHESIS=1` (altrimenti nessuna chiamata API).

| Variabile | Ruolo |
|-----------|--------|
| `PRODUCT_SOURCES_LLM_PROVIDER` | `moonshot` (default, Kimi), `openai`, `custom`, **`gemini`** (Google AI Studio), **`groq`** ([Groq](https://console.groq.com), API compatibile OpenAI) |
| `PRODUCT_SOURCES_LLM_API_KEY` | Secret API (Moonshot/OpenAI/custom/**Groq** se non usi `GROQ_API_KEY`); Moonshot accetta anche `KIMI_API_KEY` |
| `GEMINI_API_KEY` / `GOOGLE_AI_API_KEY` | Chiave da [Google AI Studio](https://aistudio.google.com/apikey) se `PROVIDER=gemini` |
| `GROQ_API_KEY` | Chiave Groq se `PROVIDER=groq` (consigliato; altrimenti fallback su `PRODUCT_SOURCES_LLM_API_KEY`) |
| `PRODUCT_SOURCES_LLM_MODEL` | Modello (Gemini default: **`gemini-2.5-flash`** — evitare `gemini-2.0-flash`, deprecato; Groq default: `llama-3.3-70b-versatile`; Moonshot: `kimi-k2-0905-preview` / `KIMI_MODEL`; OpenAI: `gpt-4o-mini`) |
| `PRODUCT_SOURCES_GEMINI_API_VERSION` | `v1` (default, API stabile) o `v1beta` se serve un modello solo in beta |
| `PRODUCT_SOURCES_LLM_BASE_URL` | Solo **custom** (es. `https://api.example.com/v1`); opzionale override per openai |
| `PRODUCT_SOURCES_LLM_MAX_BUNDLE_CHARS` | Max caratteri inviati nel prompt utente (default ~100k) |
| `PRODUCT_SOURCES_LLM_MAX_TOKENS` / `PRODUCT_SOURCES_LLM_TEMPERATURE` | Parametri generazione |
| `PRODUCT_SOURCES_LLM_EXECUTION` | `server` (default) = chiamata API dal cron/Vercel; **`mcp`** o **`client`** = nessuna chiamata sul deploy: il report include un fence `product-sources-llm-bundle` da passare al MCP locale (stesso effetto di `PRODUCT_SOURCES_LLM_MCP=1`) |

Il cron e la scansione manuale appendono al report la sezione **«Sintesi proposte (LLM, Fase 5)»** quando c’è output (o messaggio di errore/config in Markdown se la sintesi è richiesta ma manca la key).

**Gemini — quota free tier:** se Google risponde con rate limit / `RESOURCE_EXHAUSTED`, il report include un messaggio esplicito e **nessun intervento**: alla **prossima run** la sintesi viene **riprovata** automaticamente (stessi env), senza flag o DB. Se ottieni risposte vuote o 404 sul modello, aggiorna a **`gemini-2.5-flash`** e **`PRODUCT_SOURCES_GEMINI_API_VERSION=v1`** (valori default nel codice).

**Groq:** stesso flusso di sintesi via `/chat/completions`; limite e modelli sono quelli del piano Groq. Utile se Gemini risulta instabile o esaurito sul free tier.

**Manuale:** checkbox *Sintesi LLM* oppure `"includeLlmSynthesis": true`.

#### MCP + Kimi (zero inferenza su Vercel)

- Imposta `PRODUCT_SOURCES_LLM_SYNTHESIS=1` e **`PRODUCT_SOURCES_LLM_EXECUTION=mcp`**: su Vercel **non** serve `KIMI_API_KEY`; il Markdown conterrà istruzioni + JSON bundle.
- In **Cursor**, aggiungi il server MCP in `mcp/product-sources-synthesis/` (vedi **README** in quella cartella): lì configuri `KIMI_API_KEY` e invochi il tool **`kimi_synthesize_product_sources`** quando vuoi la sintesi (token Moonshot solo in quel momento, dalla tua macchina).

### 3f) Run leggera senza URL nuovi (Fase 6)

Modulo `lib/product-sources-phase6.mjs` (solo **cron** con dedup). Se **nessun URL nuovo**, **nessun** batch LinkedIn Apify e **nessun** URL web da fetchare, la run **salta** Apify e fetch web. Lo **snapshot Fase 4** non viene costruito (risparmio I/O) salvo `PRODUCT_SOURCES_SNAPSHOT_ON_NO_NEW=1`.

| Variabile | Ruolo |
|-----------|--------|
| `PRODUCT_SOURCES_SKIP_HEAVY_IF_NO_NEW_URLS` | Default: attivo; imposta `0` o `false` per eseguire sempre fetch/Apify anche senza novità |
| `PRODUCT_SOURCES_SNAPSHOT_ON_NO_NEW` | `1` = includi comunque lo snapshot anche in run “solo già visti” |

Il report include una sezione **«Run leggera (Fase 6)»** quando applicabile.

### 3g) Repo Git / archivio docs (Fase 7)

Workflow **manuale** dal report al plugin repo (nessuna automazione server):

- Guida unica nel monorepo: **`docs/PRODUCT-SOURCES-GIT-WORKFLOW.md`** (branch, naming `docs/product-sources/archive/YYYY-MM-DD-cron-{id}.md`, checklist PR, segreti da non committare).
- Dopo la PR su GitHub: **Storico cron & documenti** → **Imposta URL PR** (`set_pr_url`).

### 4) Cron Vercel + secret

1. Su Vercel deve esistere **`CRON_SECRET`** (stesso concetto di `/api/cron-notify-discord`).
2. Opzionale: **`PRODUCT_SOURCES_CRON_GATE_DAYS`** (default **4** nel codice, max **30**) — giorni minimi tra due run **complete** non saltate. Il cron resta **giornaliero**; i giorni “vuoti” sono `skipped`.
3. Il file [`vercel.json`](../vercel.json) include già:
   - `"path": "/api/cron-product-sources"`, `"schedule": "0 9 * * *"` (**09:00 UTC** ogni giorno ≈ **10:00 ora italiana invernale (CET)**; con CEST sarà **11:00** locale — regola su fuso o sposta il cron).
4. Test manuale (dal browser o curl, **non** committare il secret):
   ```bash
   curl -sS "https://<tuo-dominio-vercel>/api/cron-product-sources?key=CRON_SECRET"
   ```
5. Forzare una run ignorando il gate temporale (solo debug):
   ```bash
   curl -sS "https://<tuo-dominio-vercel>/api/cron-product-sources?key=CRON_SECRET&force=1"
   ```

### 5) Discord (opzionale)

- `PRODUCT_SOURCES_CRON_WEBHOOK_URL` oppure `DISCORD_PRODUCT_SOURCES_WEBHOOK_URL`  
  URL webhook `https://discord.com/api/webhooks/...` (accettato anche `discordapp.com`)
- **Comportamento:** primo messaggio = **embed riepilogo** (nuovi vs già visti, LinkedIn Apify, sorgente). Poi **uno o più messaggi** con il Markdown in blocchi `md` (fino a 10 embed per richiesta; il report molto lungo genera più POST in sequenza). Il report **completo** resta sempre in DB: `product_sources_cron_runs.report_markdown`.
- `PRODUCT_SOURCES_DISCORD_SUMMARY_ONLY=1` — invia **solo** il riepilogo (utile se il canale viene sommerso o per test).
- Il documento deve restare **comprensibile anche in Discord** (vedi **Requisiti prodotto**).

### 6) UI admin — scansione + storico

- **Content Management → Migliorie prodotto (Notion)** ha due schede:
  - **Scansione manuale Notion** — `POST /api/notion-product-sources` (solo URL da Notion; con `enrichLinkedIn: true` anche Apify su LinkedIn).
  - **Storico cron & documenti** — tabella run da `product_sources_cron_runs`: anteprima, **Leggi** / **Scarica .md**, stato **Discord** e tracciamento **Git/PR** (tutto **manuale** per sicurezza: nessuna PR automatica).
- API elenco/dettaglio: `GET /api/product-sources-runs` (auth admin JWT), `GET /api/product-sources-runs?id=<id>` per Markdown completo.
- Azioni POST (auth admin): `request_pr_stub` (segna «in lavorazione»), `set_pr_url` (URL `https://github.com/...` dopo PR aperta a mano), `reset_git`.
- Migration stato Discord/Git: [`migrations/005_product_sources_git_discord.sql`](../migrations/005_product_sources_git_discord.sql) (dopo la `003`).

### 7) UI manuale (promemoria)

- La doppia conferma “Applica su Git” nella scheda scansione è solo un **promemoria**: **nessuna** integrazione che apra PR in automatico è prevista (scelta di sicurezza). Per le run cron usa **Segna PR** nello storico dopo aver aperto la PR a mano su GitHub.

---

## Guida dettagliata: dove trovare ogni token / ID

Sotto trovi **dove cliccare** e **cosa copiare**. Le variabili vanno aggiunte nel progetto Vercel della **admin-dashboard** (Settings → Environment Variables), salvo dove indicato diversamente.

### Notion — creare l’integration e ottenere `NOTION_INTEGRATION_TOKEN`

Usa lo **stesso account Notion** (e lo **stesso workspace**) dove hai creato le pagine con i link.

1. Apri **[https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)**.
2. Clicca **+ New integration** (o **Crea nuova integrazione**).
3. Compila:
   - **Name:** es. `Comtra fonti prodotto`
   - **Associated workspace:** il workspace corretto (menu a tendina)
   - **Type:** **Internal** (non “Public”)
4. Clicca **Submit** / **Salva**.

Nella pagina dell’integration appena creata:

5. Trova **Internal Integration Secret** (a volte sotto la voce di menu **Secrets** nella barra laterale sinistra dell’integration).
6. Clicca **Show**, poi **Copy** (icona copia).
7. Incolla in Vercel come **`NOTION_INTEGRATION_TOKEN`** (in alternativa il codice accetta anche **`NOTION_TOKEN`**).

**Capabilities (se presenti nella schermata):** attiva la lettura del contenuto, es. **Read content** / **Can read content**. Non servono permessi “utente” o email per questo flusso.

**Se perdi il secret:** Notion non te lo mostra di nuovo in chiaro → usa **Reset** / rigenera secret e aggiorna Vercel.

**Regola d’oro:** anche con pagina “Pubblica sul web”, l’API che usiamo richiede **sempre** questo secret **e** la pagina/database **condivisa** con l’integration (vedi sotto).

---

### Notion — collegare l’integration alla pagina o al database (obbligatorio)

Senza questo passo il token è valido ma le API rispondono **404 / object not found**.

**Cosa condividere**

| Situazione | Cosa aprire in Notion | Cosa condividere |
|------------|------------------------|------------------|
| Link in una pagina normale (titoli, paragrafi, elenchi) | Quella pagina | La **pagina** |
| Link in un **database** (tabella/lista/board) come contenitore principale | Il database a schermo intero | Il **database** (è una pagina con UUID proprio) |

**Procedura (web o app desktop)**

1. Apri la **pagina** o il **database** (clic sul nome nella sidebar così l’URL in alto corrisponde a quella risorsa).
2. In alto a destra: **Share** (Condividi).
3. Aggiungi l’integration in uno di questi modi (dipende dalla lingua/versione Notion):
   - **Add connections** / **Aggiungi connessioni** → nell’elenco scegli il **nome** dell’integration che hai creato;  
   - oppure nel campo invito: digita il nome dell’integration; se non compare, apri il selettore e passa a **Integrations** / **Integrazioni** (non solo persone via email).
4. Conferma. L’integration deve comparire nell’elenco delle connessioni con accesso (tipicamente equivalente a **Can read** / **Può leggere**).

**Errore comune:** l’integration è nel workspace giusto ma la pagina è in un **altro** workspace → sposta la pagina o crea un’integration nel workspace giusto.

---

### Notion — `NOTION_PRODUCT_SOURCES_PAGE_ID` (pagina singola)

Ti serve l’**ID** (32 caratteri esadecimali, spesso dopo l’ultimo `-` del titolo nella URL). Puoi incollarlo **con o senza trattini** (`xxxxxxxx-xxxx-...` o tutto attaccato): il backend lo normalizza.

**Metodo consigliato**

1. Apri la pagina a tutto schermo.
2. **Share** → **Copy link** (Copia link).
3. Incolla il link in Blocco note. Esempi realistici:
   - `https://www.notion.so/Mie-fonti-1a2b3c4d5e6f7890abcd1234567890ab`
   - `https://www.notion.so/Mie-fonti-1a2b3c4d5e6f7890abcd1234567890ab?v=...`
   - `https://www.notion.so/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (solo UUID nel path)
4. L’ID è il gruppo di **32 caratteri** `0-9` e `a-f` (maiuscole o minuscole):
   - nell’URL con titolo, è di solito **dopo l’ultimo trattino** del segmento finale, **prima** di `?`;
   - es.: da `.../Mie-fonti-1a2b3c4d5e6f7890abcd1234567890ab` → `1a2b3c4d5e6f7890abcd1234567890ab`.
5. Copia **solo** quell’ID in Vercel → **`NOTION_PRODUCT_SOURCES_PAGE_ID`**.
6. Lascia **vuoto** `NOTION_PRODUCT_SOURCES_DATABASE_ID` se usi solo questa pagina.

---

### Notion — `NOTION_PRODUCT_SOURCES_DATABASE_ID` (database)

Il database Notion è una **pagina** con un proprio UUID (non confondere con l’ID di una **riga** del database).

1. Nella sidebar, clicca sul **titolo del database** (non su una singola riga) così si apre il DB a tutta larghezza.
2. **Share** → **Copy link** oppure leggi l’URL nella barra del browser.
3. Estrai i **32 caratteri esadecimali** come per la pagina (stessa logica: ultimo segmento significativo prima di `?`).
4. Valore in Vercel → **`NOTION_PRODUCT_SOURCES_DATABASE_ID`**.
5. Lascia **vuoto** `NOTION_PRODUCT_SOURCES_PAGE_ID` se il cron deve usare **solo** il database.

**Cosa legge il codice in modalità database:** tutte le **pagine-riga** del database + le **proprietà** (URL, testo con link, titolo, ecc.), quindi i link possono stare nelle colonne o nel corpo di ogni riga.

---

### Notion — un solo env tra PAGE_ID e DATABASE_ID

Se valorizzi **entrambi** `NOTION_PRODUCT_SOURCES_PAGE_ID` e `NOTION_PRODUCT_SOURCES_DATABASE_ID`, in assenza di ID nel body della richiesta il codice preferisce la **pagina** e ignora il database. Per il cron, imposta **solo uno** dei due env per evitare confusione.

### Vercel — dove mettere le variabili

1. [vercel.com](https://vercel.com) → progetto **comtra-admin-dashboard** (o nome equivalente).
2. **Settings** → **Environment Variables**.
3. Aggiungi nome variabile, valore, ambiente **Production** (e **Preview** se vuoi testare deploy di branch).
4. **Save** → **Redeploy** l’ultimo deploy (o un commit nuovo) così le funzioni serverless leggono i nuovi valori.

`POSTGRES_URL` / `DATABASE_URL` e `ADMIN_SECRET` di solito ci sono già: il cron e Notion/Apify vanno aggiunti nello stesso progetto.

### Postgres — migration `003` e `POSTGRES_URL`

- **Dove sta il connection string:** stesso valore che usi già per la dashboard (Vercel → env `POSTGRES_URL` o `DATABASE_URL`). Non è un “token” separato: è l’URL completo `postgres://user:pass@host:5432/db`.
- **Come eseguire la migration:**
  - **Neon / Supabase / altri:** SQL console → esegui in ordine [`003_product_sources_cron.sql`](../migrations/003_product_sources_cron.sql) poi [`004_product_sources_seen_urls.sql`](../migrations/004_product_sources_seen_urls.sql).
  - **CLI locale:** `psql "$POSTGRES_URL" -f migrations/003_product_sources_cron.sql` e poi `-f migrations/004_product_sources_seen_urls.sql`.

### Apify — `APIFY_TOKEN`

1. Vai su **[console.apify.com](https://console.apify.com)** → login.
2. **Settings** (ingranaggio utente) oppure **Integrations** → **API tokens**.
3. **Create new token** → copia il token (inizia spesso per caratteri alfanumerici lunghi).
4. Incollalo in Vercel come `APIFY_TOKEN`.

### Apify — `APIFY_LINKEDIN_ACTOR_ID` e input (`APIFY_LINKEDIN_INPUT_MODE`)

1. Vai su **[Apify Store](https://apify.com/store)** e cerca es. `LinkedIn post` (scegli un actor che accetti **URL di singoli post**).
2. Apri la scheda dell’actor → tab **API** o **Input**: lì vedi il formato JSON atteso.
3. **ID actor:**
   - Dalla URL della scheda: spesso `https://apify.com/username/actor-name` → nel codice si usa `username~actor-name` (tilde).
   - Oppure in Console: **Actors** → il nome mostrato di solito è già nel formato `user~actor`.
4. Confronta l’**Input** con le nostre modalità:
   - `postUrls` → `{ "postUrls": [ { "url": "https://..." }, ... ] }`
   - `urls` → `{ "urls": [ "https://...", ... ] }`
   - `startUrls` → `{ "startUrls": [ { "url": "https://..." }, ... ] }`  
   Imposta `APIFY_LINKEDIN_INPUT_MODE` di conseguenza.

**Test rapido:** nella Apify Console, **Try for free** / **Start** con un URL LinkedIn reale; se il run produce un **Dataset** con righe, l’actor è adatto. Poi controlla i **nomi dei campi** nelle righe: se il testo del post non compare nel report, potrebbe servire un actor diverso o un adattamento in `lib/apify-linkedin.mjs`.

### Vercel Cron — `CRON_SECRET`

- Non lo “scarichi” da un sito: è una **stringa segreta che definisci tu** (lungo, casuale), uguale a quella che usi già per `/api/cron-notify-discord` se lo hai già configurato.
- Esempio generazione: password manager “genera password” 32+ caratteri, oppure `openssl rand -hex 32`.
- Valore unico in Vercel: `CRON_SECRET`.
- Vercel, quando invoca i cron, può inviare `Authorization: Bearer <CRON_SECRET>` (dipende dalla config del piano/documentazione aggiornata). Il nostro endpoint accetta anche **`?key=<CRON_SECRET>`** per test manuali e compatibilità.

### Discord — webhook (`PRODUCT_SOURCES_CRON_WEBHOOK_URL` / `DISCORD_PRODUCT_SOURCES_WEBHOOK_URL`)

1. Discord → il **server** dove vuoi i messaggi.
2. **Impostazioni server** → **Integrazioni** → **Webhooks** → **Nuovo webhook**.
3. Scegli canale, nome webhook, **Copia URL webhook**.
4. L’URL deve iniziare con `https://discord.com/api/webhooks/` (o `discordapp.com` reindirizzato).
5. Incollalo in Vercel come `PRODUCT_SOURCES_CRON_WEBHOOK_URL` (o l’alias documentato).

Se non imposti il webhook, il cron funziona comunque: report solo in database (e log Vercel in caso di errori).

### Admin dashboard — login API (per la UI “Migliorie prodotto”)

Per chiamare `POST /api/notion-product-sources` dal browser serve la sessione admin (JWT dopo login + 2FA) oppure, in dev, `VITE_ADMIN_SECRET` allineato a `ADMIN_SECRET` (come da resto della dashboard). Non è un token Notion: è **solo** auth Comtra admin.

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

## Non ancora implementato / fuori scope

- **PR automatiche:** volutamente **non** in roadmap (sicurezza); solo tracciamento manuale in dashboard.
- Fetch generico di ogni URL non-LinkedIn (solo lista link nel report).
