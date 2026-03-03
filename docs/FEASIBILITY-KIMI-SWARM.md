# Studio di fattibilità: Multi-Agent Comtra con Kimi K2.5 Swarm

**Obiettivo:** valutare la fattibilità del piano d’azione multi-agente (Kimi K2.5 + Agent Swarm) **senza implementare** nulla. Questo documento sintetizza allineamento con il codebase attuale, dipendenze tecniche, rischi e raccomandazioni.

---

## 1. Executive summary

| Aspetto | Valutazione |
|--------|-------------|
| **Kimi K2.5 + Agent Swarm** | Reale: modello Moonshot (gen 2026), Swarm in beta, MCP e Skills documentati; API ~$0.60/M token. |
| **Allineamento con Comtra** | Buono: UI audit/code/generate già presente; dati audit oggi mock; manca solo il collegamento “dati Figma → backend → agenti”. |
| **Blocco principale** | Far arrivare il **documento Figma** agli agenti: richiede estensione OAuth (`file_content:read`) e nuovo flusso backend (proxy verso Figma REST + invio a Kimi). |
| **Fasi 0–2** | Fattibili con lavoro definito (setup Kimi, pipeline dati, definizione regole audit). |
| **Fasi 3–6** | Fattibili dopo Fase 1–2; dipendono da qualità e formato del JSON Figma e da capacità del modello (visual coding, euristiche UX/prototype). |

**Conclusione:** il piano è **fattibile**. Il collo di bottiglia è la **pipeline dati** (plugin → backend → Kimi) e l’**estensione OAuth**; il resto si appoggia a stack già presente (auth, credits, UI) e a tecnologie verificabili (Kimi API, Figma REST, MCP/Skills).

---

## 2. Allineamento con lo stato attuale del codebase

### 2.1 Cosa c’è già

- **Plugin Figma:** `controller.ts` espone `get-selection`, `get-pages`, `count-nodes` (batched, cap 200k). Il conteggio nodi è lato Figma e può restare così; non serve spostarlo agli agenti.
- **Audit UI:** tab Design System, A11Y, UX, Prototype; dati da `views/Audit/data.ts` (mock: `DS_ISSUES`, `A11Y_ISSUES`, ecc.). Categorie e tipi (`AuditIssue`, `AuditCategory`) sono già modellati.
- **Backend:** auth.comtra.dev (Vercel, `auth-deploy`), OAuth Figma, Postgres (credits, XP, trophies), API credits estimate/consume. **Scope OAuth attuale:** solo `current_user:read` (vedi §4.1).
- **Code / Generate:** viste e sync Storybook/GitHub/Bitbucket sono solo UI e contatori; nessuna generazione codice reale né integrazione repo.
- **AI:** `services/geminiService.ts` è uno stub; nessun audit guidato da AI oggi.

### 2.2 Cosa non c’è (e il piano presuppone)

- **“20 regole di audit che superano Beacon”:** in repo non c’è un engine di regole né riferimenti a Beacon; ci sono 20 trofei (gamification). Le “20 regole” vanno **definite e implementate** come logica (o prompt/skill) nell’agente DS Audit.
- **Dati reali dal file:** il plugin non legge il tree del documento per l’audit; non c’è chiamata a `GET /v1/files/:key`. Tutto l’audit oggi è su dati mock.
- **Integrazione Kimi/MCP/Skills:** assente; da costruire in Fase 0.

---

## 3. Fattibilità per fase

### Fase 0 — Setup infrastruttura Kimi

| Elemento | Fattibilità | Note |
|----------|-------------|------|
| **Kimi Code 2.5** | ✅ | Prodotto reale (gen 2026); disponibile via Kimi.com, app, API, Kimi Code IDE. |
| **Agent Swarm come orchestratore** | ✅ (beta) | Swarm in beta; documentato per task complessi e parallelismo (fino a ~100 agenti, 1.500 tool call per task). |
| **Skills custom per agente** | ✅ | Kimi Code CLI: skills in `~/.config/agents/skills/` o `.agents/skills/`, formato `SKILL.md` (YAML frontmatter + Markdown). Una skill per DS Audit, A11Y, UX, Prototype, Code, Generate è coerente con la guida. |
| **Tool custom per Figma** | ✅ con caveat | Tool possono essere: (1) **MCP server** (HTTP o stdio) che espone “get file”, “get nodes”, “apply fix” ecc., oppure (2) **function calling** nell’API Kimi che invoca un backend Comtra. Il backend deve avere accesso al file (vedi §4). |
| **MCP per servizi esterni** | ✅ | MCP documentato (`kimi mcp add --transport http|stdio`); adatto a GitHub, Storybook, eventuali repo framework. |

**Rischio Fase 0:** dipendenza da documentazione/limiti della beta Swarm (es. limiti di concorrenza o di dimensioni contesto). **Mitigazione:** proof-of-concept con un solo agente + un tool (es. “get file summary”) prima di investire su tutti gli agenti.

---

### Fase 1 — Orchestratore + Design System Audit Agent

| Elemento | Fattibilità | Note |
|----------|-------------|------|
| **Orchestratore riceve input dal plugin** | ✅ | Il plugin può inviare al backend: `fileKey`, `scope` (all / page / selection), `pageId` o `nodeIds`. L’orchestratore (es. servizio che chiama Kimi Swarm API) riceve questo + JWT; non deve “leggere” direttamente da Figma. |
| **Smistamento a DS Audit Agent** | ✅ | Con Swarm, un task “audit design system per file X” può essere delegato a un agente con skill DS; stesso pattern per altri agenti. |
| **Ghost node detection** | ✅ | Richiede albero documento (nodi senza figli visibili / non referenziati). Dati da Figma REST (document tree). |
| **Token consistency (hardcoded vs variables)** | ✅ | Figma REST espone `fills`, `styles`, `boundVariables`; `plugin_data` / `sharedPluginData` per token (es. Tokens Studio). Logica da implementare in skill o tool che analizzano il JSON. |
| **Naming, orphan, variant structure** | ✅ | Da document + `components` / `componentSets` nel response Figma. Regole da definire (naming convention, orphan detection, variant structure). |
| **“20 regole che superano Beacon”** | ⚠️ Da definire | Non esiste in codice; va creata una lista di 20 regole (o N) e implementata come checklist/prompt nella skill DS Audit. Nessun blocco tecnico. |

**Conteggio nodi:** resta a Figma (già in `controller.ts`); l’agente non deve contare, solo analisi qualitativa. **Fattibile.**

---

### Fase 2 — Accessibility Audit Agent

| Elemento | Fattibilità | Note |
|----------|-------------|------|
| **Contrast ratio WCAG AA/AAA** | ✅ | Colori da `fills` (hex/rgba) nel JSON; calcolo ratio e confronto con soglie WCAG è deterministico. |
| **Touch target size** | ✅ | Da `absoluteBoundingBox` (width/height); soglia tipica 44×44 px. |
| **Heading structure / Alt text** | ✅ | Nomi layer e testo (nodi TEXT) possono essere usati per euristiche (heading, alt); non c’è DOM, quindi non è “vero” HTML. |
| **Color blindness simulation** | ✅ | Trasformazioni colore (es. deuteranopia) su `fills`; fattibile lato agente o tool. |
| **axe-core / API open-source** | ⚠️ Parziale | axe-core lavora su **DOM** (HTML renderizzato). Sul **file Figma** (JSON) non si può usare axe direttamente. Due strade: (1) **Audit su design:** regole custom che leggono colori/dimensioni/testo dal JSON (come sopra); (2) **Audit su codice generato (Fase 3):** dopo il Code Agent si può far girare axe sul markup generato. Per “integrazione axe” in Fase 2 va inteso come ispirazione regole o uso downstream sul codice, non lettura diretta del file Figma. |
| **Localization stress testing** | ✅ | Euristiche su lunghezza testo, caratteri speciali, layout (es. overflow) da bounds e testo nel JSON. |

**Conclusione Fase 2:** fattibile; differenziatore forte. Stack Comtra su codice: axe-core + HTML_CodeSniffer + Lighthouse + OKLCH (tutti open source). Dettaglio: docs/A11Y-AUDIT-PLAN.md. Chiarire in fase di design se “integrazione axe” è solo regole WCAG-like su design o anche step post-export su HTML.

---

### Fase 3 — Code Agent + Pipeline

| Elemento | Fattibilità | Note |
|----------|-------------|------|
| **Lettura file Figma e generazione codice** | ✅ | Input = JSON file (o sottoalbero); Kimi K2.5 ha capacità di visual coding (benchmark citati). |
| **Framework: React, Vue, Liquid, Swift** | ✅ | Scelta di target e prompt/skill per framework; nessun blocco. |
| **Linting/formatting post-generazione** | ✅ | Tool o step separato (es. ESLint/Prettier via MCP o backend). |
| **Sync Storybook** | ⚠️ Da implementare | UI e contatori già pronti; manca integrazione reale (API Storybook o repo). MCP o backend possono inviare storie generate. |
| **Semantic HTML** | ✅ | Da includere in prompt/skill del Code Agent. |
| **Costo 10x inferiore / margini** | ✅ da validare | API Kimi ~$0.60/M token; confronto con Claude/GPT va fatto su volumi reali (token per file, numero di scan). |

**Rischio:** qualità e stabilità del codice generato (variabile per framework). **Mitigazione:** iniziare con un target (es. React + Tailwind) e lint obbligatorio prima del sync.

---

### Fase 4 — UX Audit Agent

Euristiche Nielsen, spacing/alignment, navigazione, breakpoint, flow completeness: tutte **fattibili** a partire dal JSON (nodi, bounds, nomi, gerarchia). Richiedono definizione operativa delle regole (es. “allineamento a griglia 8px”, “pattern navigazione”). Nessun blocco tecnico.

---

### Fase 5 — Prototype Agent

Dead-end, missing interaction, flow completeness, Smart Animate, connection graph: Figma REST espone **prototype** (transizioni, connection tra nodi) nel documento. L’agente può analizzare questo sottografo. Fattibile; dipende dalla completezza dell’API Figma per i dati di prototipo (da verificare nella documentazione node types e prototype-specific).

---

### Fase 6 — Generate Agent

Wireframe da token, varianti da componenti base, layout suggestions: coerente con il piano “Refine, Don’t Redraw”. Input = file + eventuali token/variabili; output = suggerimenti o nuovi frame. Fattibile come estensione delle skill e dei tool già previsti per Fase 1 e 3.

---

## 4. Dipendenze critiche: come arrivano i dati Figma agli agenti

### 4.1 OAuth: scope mancante

Oggi lo scope Figma è **solo** `current_user:read` (in `auth-deploy/oauth-server/app.mjs`). Per leggere il contenuto del file serve **`file_content:read`** ([Figma scopes](https://www.figma.com/developers/api#access-tokens)).

- **Impatto:** senza questo scope il backend non può chiamare `GET /v1/files/:key` (né `/nodes`, `/images`).
- **Azioni:** (1) estendere lo scope nella URL di autorizzazione a `current_user:read file_content:read`; (2) utenti già loggati dovranno **ri-autorizzare** per concedere accesso ai file; (3) comunicazione chiara in UI (perché serve l’accesso al file).

### 4.2 Flusso dati consigliato

1. **Plugin:** l’utente avvia “Scan”; il plugin ha accesso a `figma.fileKey` (e a `figma.currentPage.selection`, `figma.root.children`). Invia al backend: `fileKey`, `scope` (all | page | selection), opzionali `pageId` o lista `nodeIds`, più JWT.
2. **Backend:** con l’access token Figma dell’utente (memorizzato a seguito OAuth o recuperato da refresh) chiama:
   - `GET /v1/files/:key` (con `depth` e/o `ids` per limitare dimensione), oppure
   - `GET /v1/files/:key/nodes?ids=...` per una selection.
3. **Backend → Kimi:** invia il JSON (o un sottoinsieme/sintesi) al servizio Kimi (Swarm o singolo agente) come contesto; gli agenti usano tool/MCP per “leggere” parti del file se serve (es. “get node by id”).
4. **Risultato:** gli agenti restituiscono issue (e eventuali fix); il backend mappa le risposte al formato `AuditIssue` esistente e le invia al plugin per la UI.

**Alternativa “tutto dal plugin”:** il plugin potrebbe traversare l’albero (come per `count-nodes`) e serializzare nodi (nome, tipo, bounds, fills, ecc.) e inviare al backend. Pro: non serve `file_content:read`. Contro: limite dimensione messaggio, complessità di serializzazione, possibili dati mancanti (styles, component sets). La soluzione **REST dal backend** è più pulita e scalabile.

### 4.3 Dimensione payload e costi

- File grandi (molte pagine, profondità piena) possono produrre JSON di diversi MB. Opzioni: (1) inviare solo un sottoalbero (`depth=2` o `ids` di pagine selezionate); (2) chunking lato backend prima di inviare a Kimi (rispettando limiti contesto modello); (3) “summary” o primo livello e richiesta on-demand per dettaglio (tool “get node”).
- Kimi: contesto 256K token; costo input ~$0.60/M. Stimare token per file medio e moltiplicare per scan per validare “costo per scan bassissimo”.

---

## 5. Rischi e gap

| Rischio | Impatto | Mitigazione |
|--------|---------|-------------|
| **Agent Swarm in beta** | Limitazioni non documentate, cambi API | PoC con un agente; design modulare per poter usare singolo agente se Swarm non è stabile. |
| **Utenti devono ri-autorizzare OAuth** | Friction, possibile drop-off | Messaggio chiaro (“Comtra ha bisogno di leggere il file per l’audit”); richiesta solo al primo scan dopo l’upgrade scope. |
| **Dimensione file / rate limit Figma** | File enormi, Tier 1 limits | Scope ridotto (pagina/selection), `depth` limitato, eventuale coda e retry. |
| **“20 regole” e Beacon** | Non esiste in codice | Creare documento di specifica delle regole e implementarle nella skill DS Audit (e nelle altre dove applicabile). |
| **axe-core su design** | axe è per DOM | Usare regole WCAG-like su JSON Figma; riservare axe al codice generato (Fase 3). |
| **Sync Storybook/GitHub non implementato** | Fase 3 promette sync | Pianificare come step separato (API Storybook, GitHub API) o via MCP. |

---

## 6. Mappatura piano ↔ guida Kimi

La tabella del piano si regge su documentazione verificata:

- **Agent Swarm (punto 5):** orchestratore che lancia audit in parallelo — coerente con capacità Swarm (parallelismo, multi-agente).
- **Skills (punto 8):** una skill per agente (DS, A11Y, UX, Prototype, Code, Generate) — formato SKILL.md supportato.
- **Tool (punto 9):** tool custom per Figma (e Storybook/GitHub) — realizzabili con MCP o function calling verso backend Comtra.
- **MCP (punto 10):** servizi esterni — supportato (HTTP/stdio).
- **Kimi in Claude Code (punto 11):** fallback/ibrido — possibile a livello di architettura (altro orchestratore o step complessi).
- **Costi/benchmark (punto 13):** validazione — da fare con numeri reali (token per scan, prezzo Kimi vs Claude/GPT).

---

## 7. Raccomandazioni (senza implementazione)

1. **Priorità 1 – Pipeline dati:**  
   Estendere OAuth a `file_content:read`, aggiungere endpoint backend che riceve `fileKey` + scope e chiama Figma REST, restituisce (o inoltra) JSON. Plugin: invio `fileKey` + scope al “Scan”. Nessun agente nella prima iterazione: solo “ricevi file, opzionalmente salva/restituisci summary”.

2. **Priorità 2 – PoC Kimi:**  
   Un solo agente (es. DS Audit) con una skill minima e un tool “get file” (o ricezione file nel contesto). Verificare: qualità risposta, dimensioni contesto, costo per file medio, stabilità Swarm in beta.

3. **Priorità 3 – Specifica regole:**  
   Documento “20 regole” (o N) per Design System (e elenchi analoghi per A11Y, UX, Prototype) per allineare skill e output al prodotto “superiore a Beacon”.

4. **Fasi successive:**  
   Dopo pipeline + PoC DS, aggiungere in parallelo A11Y e UX (stesso input JSON); poi Code, Prototype, Generate in base a roadmap e risorse.

5. **Comunicazione OAuth:**  
   Preparare copy e flow per la richiesta del nuovo scope (tooltip, modal, pagina docs) prima di andare in produzione con `file_content:read`.

---

*Documento redatto per studio di fattibilità; nessuna modifica al codice è stata applicata.*
