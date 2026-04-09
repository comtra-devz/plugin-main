# Eventual improvements — considerazioni raccolte

Documento unico di **backlog / note strategiche** emerse da discussioni su prestazioni, audit, console, prodotto, tooling esterno e architettura. Non è una roadmap vincolante; integra e non sostituisce [`GENERATION-ENGINE-ROADMAP.md`](./GENERATION-ENGINE-ROADMAP.md) e [`STABLE-RESTORE-POINT.md`](./STABLE-RESTORE-POINT.md).

---

## 1. Prestazioni end-to-end (plugin + backend)

### 1.1 Causa strutturale già affrontata (audit multi-pagina)

- DS, A11y e UX (con `file_key`) passano da **`fetchFigmaFileForAudit`** sul backend.
- Con scope **“tutte le pagine”**, il plugin invia **`page_ids`**; prima le richieste Figma REST erano **sequenziali** (`await` in un `for`), moltiplicando la latenza per numero di pagine (es. 20 pagine × centinaia di ms → molti secondi solo di rete, **prima** di Kimi o di `runA11yAudit`).
- **Mitigazione implementata:** fetch per pagina in **parallelo con concorrenza limitata** (costante tipo `FIGMA_AUDIT_PAGE_FETCH_CONCURRENCY`, es. 6), con `mapWithConcurrency` in `auth-deploy/oauth-server/app.mjs`.

### 1.2 Crediti (`GET /api/credits`)

- **`?lite=1`:** evita `getProductionStats` e `recent_transactions` (meno query, meno rischio timeout).
- **Client:** timeout distinti lite vs full, coalescing delle richieste in-flight, cache locale (es. `comtra.credits.v1`) con TTL, retry limitati invece di loop infiniti.
- **Backend:** le query su **users**, **tags**, **gift** sono state portate in **`Promise.all`**; in modalità **full**, anche **getProductionStats** e **transazioni recenti** in parallelo.
- **Problema osservato:** `AbortError` dopo timeout (es. 18s lite) indica ancora possibile lentezza rete/DB/cold start (Neon/Vercel); va verificato in produzione con log e tempi p95.

### 1.3 Trophies e caricamento pigro

- **`fetchTrophies`:** timeout dedicato, coalescing, caricamento legato all’apertura di viste specifiche (es. Stats/Profile) invece che a ogni login, per non competere con crediti e altre chiamate.

### 1.4 Crediti “full” vs tab Analytics

- Possibilità di richiedere crediti **full** quando `view === ANALYTICS` (dati ricchi) mantenendo **lite** nel resto dell’app.

### 1.5 Rami ancora potenzialmente pesanti

- **Scope `all` senza `page_ids`:** un singolo `GET` Figma “overview” con `depth` limitato può restare **molto grande** su file enormi; miglioramento eventuale: forzare sempre il percorso `page_ids` lato plugin o ridurre/adattare `depth` per quel ramo.
- **Figma rate limit:** parallelismo più alto potrebbe teoricamente urtare i limiti tier Figma; la concorrenza è volutamente **bounded**; monitorare 429 e ritoccare la costante se necessario.

---

## 2. Audit (DS, A11y, UX) — errori e diagnostica

### 2.1 `POST /api/agents/ds-audit` → HTTP 400

Dal backend (`app.mjs`), 400 tipici:

- **`file_key` o `file_json` mancanti** (raro se il flusso parte dopo `file-context-result`).
- **Errore nel fetch Figma** (`fetchFigmaFileForAudit`): messaggio mappato a 400 (diverso da 403 “Riconnetti Figma”).
- **Kimi/Moonshot** con status &lt; 500 → risposta **400** con `Kimi API error` e `details` troncati nel JSON.

**Nota storica:** regressioni percepite (“funzionava ~4 giorni fa”) possono coincidere con **token Figma**, **dimensione file**, **rate limit**, **risposta Moonshot**, non necessariamente con sole modifiche alle “regole” DS nel prompt.

**Diagnostica plugin:** log `console.warn('[Comtra] POST /api/agents/ds-audit failed', status, msg)` su risposta non OK (in `App.tsx` / `fetchDsAudit`), per leggere in console il messaggio reale senza aprire solo la tab Network.

### 2.2 A11y “lento” senza Kimi

- A11y **non** usa Moonshot per il core engine, ma **sì** lo stesso **`fetchFigmaFileForAudit`**; quindi il collo di bottiglia **multi-pagina sequenziale** li rallentava **tutti** allo stesso modo (ora mitigato dal parallelismo pagine).

### 2.3 Flusso contesto file (plugin)

- Per `scope === 'all'`, `get-file-context` fa `loadAllPagesAsync` e invia **`pageIds`** senza serializzare l’intero file nel messaggio (payload piccolo verso l’UI).
- Per **`current`**, si costruisce `fileJson` lato plugin (può essere pesante e chunked se supera la soglia di `postMessage`).
- **Audit body:** con `fileKey` disponibile si preferisce **`file_key`** al backend per evitare 413 e payload enormi.

---

## 3. Console browser / sintomi “rumorosi”

### 3.1 Figma / iframe (non bug Comtra)

- **`jsvm-cpp` / Emscripten:** runtime del plugin, informativo.
- **`Potential permissions policy violation`** (camera, microphone, clipboard-write, display-capture): policy restrittive dell’iframe Figma; non è la causa principale di lag o 400.
- **Blocchi `data:text/html;base64,...`:** script/tema iniettati da Figma, non il backend Comtra.

### 3.2 CORS su `/api/trophies` con `origin 'null'`

- In iframe Figma l’origine può risultare **`null`**.
- Se la risposta è errore gateway (502/504) o body vuoto, il browser può mostrare **“No Access-Control-Allow-Origin”** anche quando il problema è upstream.
- **Eventuale miglioria:** assicurarsi che **tutti** i path di errore dell’handler trophies impostino header CORS (inclusi 5xx), e verificare in Network lo **status HTTP** reale.

### 3.3 `[ds-context-index] Error`

- Origine: **`ds-context-index.ts`** (refresh in background su `documentchange`, debounced).
- **Indipendente** dalla chiamata HTTP `ds-audit` (che usa `file_key` + REST lato server).
- Possibili cause: file enorme, memoria, eccezioni nel build dell’indice. **Eventuale miglioria:** log più ricchi (scope errore), degradazione controllata, o posticipare build se non necessario.

### 3.4 `[get-ds-context-index]` nel controller

- Messaggi verso UI con `error` in `ds-context-index-result` in caso di fallimento; utile tracciare se la UI dipende dall’indice per Generate.

### 3.5 Documentazione utente (opzionale)

- Breve nota in help/docs interni: distinguere **rumore Figma** da **errori Comtra** (`[Comtra]`, status API).

---

## 4. Prodotto, crediti e modali (considerazioni passate)

### 4.1 Modale regalo crediti (“+500 crediti”)

- Problema: modale che riappareva dopo essere già stata vista.
- Direzione risolta: **`POST /api/credit-gift-seen`** aggiorna `shown_at` su `user_credit_gifts`; lato client deduplica con marker `created_at::credits_added` e **`sessionStorage`** (es. `comtra.creditGiftSeen.v1`); attenzione allo **shadowing** delle variabili `fetch` nel blocco gift (`rGift` vs `r`).

### 4.2 Piano Lemon “1w”

- Allineamento **20 → 25 crediti** ovunque: webhook LemonSqueezy, `constants` / tier limits, UI (`UpgradeModal`, `Documentation`), README, stime costi, proposta dashboard admin.
- **Admin:** etichette che accettano sia **25** sia **20** per utenti storici.

### 4.3 Dashboard admin

- Allineamento testi/varianti PRO dopo il cambio 1w (vedi commit e doc admin).

---

## 5. UI — tab Code (considerazioni passate)

- **Padding esterno:** mantenere coerenza con altre tab (es. root **`p-4 pb-16`** come Audit/Generate), senza “attaccare” il box ai bordi.
- **Padding interno “Deep Sync”:** ridurre padding fantasma (es. rimozione `BRUTAL.card` dove creava `p-4` inutile); area Storybook e sub-tab con **`py-3 px-2`** / **`px-2 py-2`** per allineamento con tab Tokens/Target/Sync.

---

## 6. Deploy e verifiche operative

- Assicurarsi che **produzione** esponga backend con **`GET /api/credits?lite=1`** e build plugin recente.
- In caso di timeout crediti persistenti: log Vercel, tempi query Postgres, cold start.
- Per **ds-audit 400:** confrontare body risposta (Network o log `[Comtra]`) con validazione in `app.mjs`.
- Per **trophies:** verificare status + body e CORS su handler dedicato (`credits-trophies` / route in `app.mjs`).

---

## 7. Punto stabile Git

- Tag **`stable/2026-04-07`** e guida in **[`STABLE-RESTORE-POINT.md`](./STABLE-RESTORE-POINT.md)** (checkout, promozione nuovi tag, contenuto della baseline prestazioni).
- Il tag non sostituisce release semver; serve come **checkpoint** interno e per confronti/bisect.

---

## 8. Generation Engine (puntatore + migliorie concettuali)

- Roadmap dettagliata: **[`GENERATION-ENGINE-ROADMAP.md`](./GENERATION-ENGINE-ROADMAP.md)** (Problem 1, orchestrator + swarm LLM, validazione deterministica, crediti trasparenti).
- **Eventual improvements** collegati:
  - test/benchmark **headless** dove possibile, senza dipendere dalla sola automazione GUI;
  - documentazione “skill-like” per API interne e contratti plugin↔backend, per agenti e contributor;
  - telemetria token (es. `kimi_usage_log`) già menzionata nel codice audit — estendere analisi prodotto se serve pricing/capacity.

---

## 9. CLI-Anything (HKUDS) — analisi e potenzialità per Comtra

**Riferimento:** [github.com/HKUDS/CLI-Anything](https://github.com/HKUDS/CLI-Anything) — slogan *“Making ALL Software Agent-Native”*, hub [clianything.cc](https://clianything.cc/).

### 9.1 Cos’è

- Plugin/metodologia per **agenti di coding** (Claude Code, Pi, OpenCode, OpenClaw, Codex, Copilot CLI, ecc.).
- **Pipeline in 7 fasi:** analisi sorgente → design CLI → implementazione **Click** (Python) → test → documentazione → pubblicazione; output **`--json`**, REPL, **`SKILL.md`** auto-generato per scoperta da parte di altri agenti.
- **CLI-Hub:** catalogo di CLI installabili (`pip`), più **meta-skill** per far scegliere all’agente quale CLI usare.

### 9.2 Perché la CLI come interfaccia (dal loro README)

- Strutturata, componibile, adatta agli LLM; `--help` auto-documentante; meno fragile della **UI automation** (screenshot, click).

### 9.3 Allineamento con Comtra

| Aspetto | Rilevanza |
|--------|-----------|
| Plugin Figma (Comtra) | **Integrazione diretta bassa:** CLI-Anything mira a **repo/sorgente** e invocazione da shell; il plugin è **sandbox JS** + API Plugin/REST. |
| Idee “agent-native” | **Alta:** output strutturato, skill scopribili — stessa famiglia di MCP e skill Cursor. |
| Tooling interno | **Media:** incapsulare script deploy/migrazioni/health check con **`--json`** e doc tipo skill. |
| Design tooling | Nel repo esiste harness **Sketch**; Figma **chiuso** non è un target naturale di `/cli-anything ./figma`. |
| Servizi generici | Harness per **Ollama**, **ComfyUI**, **Dify**, **Exa**, ecc. — riusabili lato **server/worker** se Comtra orchestrasse pipeline oltre al plugin. |

### 9.4 Potenzialità concrete (ordinate)

1. **Documentazione skill-like** per le API Comtra (anche senza generare Python).
2. **CLI interne** (o manuali ispirate a **HARNESS.md**) per DevOps e diagnostica backend.
3. **Benchmark / test ripetibili** senza dipendere dal canvas quando non necessario.
4. **CLI-Hub** come dipendenze opzionali per integrazioni (ricerca, LLM locale, …).
5. **Contributo community** se un tool open source Comtra-adiacente diventa harness nel registry.

### 9.5 Limiti

- Richiede **sorgente** analizzabile (o API ben documentate); binari chiusi degradano la qualità.
- Modelli **deboli** producono harness incompleti (lo dicono esplicitamente).
- Spesso servono **run iterativi** `/refine`.
- **Licenza:** verificare il file `LICENSE` nel repo (in alcune viste GitHub/README compaiono indicazioni diverse; controllare prima di fork/redistribuzione).

### 9.6 Nota roadmap loro

- Supporto **Cursor** indicato come “coming soon” nel README; il pattern **opencode-commands** è citato come riferimento per altre piattaforme.

---

## 10. Tabella riassuntiva — voci ancora aperte o da monitorare

| Area | Cosa fare / monitorare |
|------|-------------------------|
| Produzione | Deploy backend + plugin allineati a `lite=1` e fix parallelismo |
| Crediti | p95 latenza `GET /api/credits`; cold start DB |
| ds-audit 400 | Leggere body; distinguere Figma vs Kimi |
| Trophies | Status reale + CORS su tutti i codici di risposta |
| ds-context-index | Errori su file grandi; logging e strategia di defer |
| Figma overview | Ramo `all` senza `page_ids` su file enormi |
| Rate limit Figma | 429 con concorrenza pagine |
| Utenti | Opzionale: testo che spiega rumore console Figma vs Comtra |
| Stitch / art direction | Vedere §12 — valutare API, costi GCP, privacy; MCP solo lato dev/agent o backend |

---

## 11. Manutenzione di questo documento

- Aggiornare quando una voce passa da “eventuale” a “fatto” (o spostarla nella CHANGELOG/README dedicati).
- Le decisioni architetturali vincolanti restano nelle roadmap e nelle `.cursor/rules` pertinenti.

---

## 12. Google Stitch (MCP) — art direction più mirata in Generate

**Riferimento ufficiale setup MCP:** [stitch.withgoogle.com/docs/mcp/setup](https://stitch.withgoogle.com/docs/mcp/setup). Contesto prodotto Google (“Design with AI”, integrazione con agenti tramite Model Context Protocol). Materiale correlato Google: es. codelab [Design-to-Code with Antigravity and Stitch MCP](https://codelabs.developers.google.com/design-to-code-with-antigravity-stitch).

### 12.1 Cosa offre (in sintesi)

- **Stitch** genera output di design / UI da prompt (ecosistema Google Cloud / progetto Stitch).
- Il **server MCP** espone agli agenti (Cursor, Claude Code, Gemini CLI, ecc.) **strumenti** invocabili da chat — in letteratura community compaiono nomi tipo generazione schermate da testo, estrazione contesto design, lista progetti/schermate, recupero codice associato a uno screen. L’installazione tipica passa da `npx` / proxy con autenticazione (**API key** da impostazioni Stitch o **OAuth/gcloud** a progetto con billing).

### 12.2 Vincolo architetturale per Comtra

- Il **plugin Figma** (iframe, sandbox) **non** può montare un server MCP come fa Cursor: **MCP ≠ runtime plugin**.
- Quindi “usare Stitch dentro Generate” non significa incollare MCP nell’UI Figma, ma una di queste strade:

| Approccio | Dove vive Stitch | Ruolo per Generate |
|-----------|-------------------|-------------------|
| **A — Solo team / sviluppo** | Cursor o altro client MCP | Prototipare **prompt di art direction**, estrarre **design context** o reference, alimentare manualmente doc e template che poi il backend Comtra usa come system prompt o few-shot. |
| **B — Backend Comtra** | Chiamate alle **API Google/Stitch** (se esposte oltre MCP; da verificare su documentazione e ToS), non necessariamente tramite MCP | Prima della pipeline Kimi, un passo opzionale “**direction enrichment**”: testo/struttura derivata da Stitch → sezione fissa nel prompt (`art_direction`, palette, layout intent). Richiede **chiavi**, **billing**, **GDPR/consenso**, costi per richiesta. |
| **C — Input utente nel plugin** | Nessuna integrazione live Stitch | Campo **“Art direction (incolla)”** o allegato JSON/markdown esportato da Stitch a mano: zero dipendenza runtime da Google nel plugin; il backend inietta quel blocco nel prompt. |

### 12.3 Allineamento con Generation Engine

- La [`GENERATION-ENGINE-ROADMAP.md`](./GENERATION-ENGINE-ROADMAP.md) impone **vincoli DS nel file** (Problem 1): Stitch non deve **sostituire** il design system Figma dell’utente, ma può **orientare** mood, gerarchia visiva, copy di esempio, spaziatura “feel”, accessibilità dichiarata — sempre **filtrato** dalla validazione deterministic su indice DS / executor.
- Rischio da gestire: Stitch propone componenti o token **non presenti** nel file → va **esplicitato nel prompt** che l’output finale deve mappare solo su ciò che l’indice DS consente.

### 12.4 Prossimi passi se si vuole seriare

1. Leggere ToS e limiti d’uso API / MCP per **uso commerciale** in un prodotto che genera su Figma.
2. Verificare se esiste **endpoint REST stabile** adatto al backend (MCP spesso è un adapter per agenti, non l’unica interfaccia).
3. Prototipo **A** (zero rischio prodotto): MCP in Cursor sul repo Comtra per migliorare i prompt in `prompts/` e le variabili “direction”.
4. Se **B**: spike tecnico su Vercel (timeout, cold start) + stima costo per generazione; feature flag e opt-in utente.

### 12.5 MCP vs CLI per Stitch — “meglio”?

**In parole povere**

- **MCP** e **CLI** sono due modi di **chiedere a Google/Stitch la stessa cosa** (come due citofoni diversi per lo stesso ufficio). Non è che uno sia “più intelligente” dell’altro di default.
- **Nel plugin Figma** non puoi installare né MCP né CLI: il plugin gira in un ambiente chiuso. Stitch si usa **fuori** dal plugin (sul tuo computer, su Cursor, o su un **server** che parla con Google).
- **Per gli utenti finali**, il modo più pulito è: il **server Comtra** chiama Google con una **normale richiesta web** (API), quando esiste. Lanciare un **programma a riga di comando** a ogni click “Genera” sul server è spesso **lento** e **complicato da mantenere**.
- **Per te che sviluppi**: in Cursor va bene **MCP** (comodo per l’AI). Per script automatici a volte va meglio la **CLI**. Sono scelte da **sviluppatore**, non “la versione migliore del prodotto”.

---

**Versione tecnica (breve):** spesso MCP e CLI (es. `npx … stitch-mcp proxy` o altri entrypoint documentati) sono **due facce** dello stesso servizio Google: sotto c’è autenticazione + **API** (o RPC interno). Cambia solo **chi** orchestra la chiamata (host MCP vs shell vs codice che fa `spawn`).

| Criterio | MCP | CLI |
|----------|-----|-----|
| **Uso in Cursor / agenti IDE** | Ottimo: tool con schema, parametri tipizzati, meno parsing ad hoc | Va bene: l’agente esegue comandi in shell; serve output **stabile** (`--json` se esiste) |
| **CI / script / Docker** | Serve un client MCP o è scomodo | Spesso **più naturale**: job che lanciano un binario |
| **Backend Comtra in produzione** | Di solito **sconsigliato** avviare un server MCP per richiesta | **CLI via `spawn`/`npx`** su ogni `POST /generate`: pesante (cold start, bundle, sandbox), fragile, timeout Vercel; **preferire HTTP diretto** verso API ufficiali Stitch se documentate |
| **Manutenzione** | Config nel JSON MCP per sviluppatore | Version pinning del pacchetto npm, secrets in env |

**Sintesi pratica per Comtra**

- **Sviluppo interno:** MCP *oppure* CLI — scegli in base a dove lavori (Cursor → MCP comodo; script → CLI).
- **Prodotto utente:** né MCP né CLI è ideale come strato principale; l’obiettivo è **`fetch` verso API REST** (o SDK ufficiale) con chiavi lato server. CLI/MCP restano utili per **prototipi** o tooling che non gira sul path critico di ogni generazione.

---

*Ultimo aggiornamento contenuti: prestazioni, audit, console, stabile, prodotto, Code UI, CLI-Anything, Google Stitch (MCP/CLI/API) / art direction (Generate).*
