# Generation Engine — Roadmap operativa (Problem 1 + orchestrazione)

Documento di lavoro unico per team e tooling interno. Integra il **piano v2.0** (PDF *COMTRA Generation Engine – Implementation Plan*), le **migliorie già in corso** nel repo, e la scelta architetturale **Orchestrator + subagenti via Kimi Agent Swarm** (solo per la parte LLM), con **validazione ed esecuzione sempre deterministiche** lato Comtra.

---

## 1. Obiettivo prodotto (Problem 1)

Generare schermate **sulla canvas Figma** usando **solo** il design system **presente nel file dell’utente**: componenti locali/pubblicati nel file, variabili, stili, slot — **senza** fingere che i cataloghi `ds_package` siano istanze Figma quando `ds_source` è il file corrente.

**Problem 2** (DS pubblici da `ds_package` + `BUILD_COMPONENT`): fuori scope da questa roadmap operativa; resta nel PDF; dipende da token resolver e vocabolario azioni diverso.

---

## 2. Principi architetturali (invarianti)

| Invariante | Implicazione |
|------------|----------------|
| **Mai inventare** componenti/token non presenti nell’indice DS inviato dal plugin | Validazione pre-crediti + repair |
| **Mai hardcodare** valori visivi se esiste variabile DS nel file (Problem 1) | Executor lega `setBoundVariable` / stili |
| **Solo nodi Figma nativi** | Nessun formato proprietario sulla canvas |
| **Strict write discipline** | Stato interno / log solo dopo API Figma riuscita |
| **Trasparenza crediti** | Fallimento prima del successo commerciale = niente addebito (o policy esplicita) |
| **Variability** | Stesso prompt → output non identico (seed / policy nel prompt) |

---

## 3. Architettura a strati

```
┌─────────────────────────────────────────────────────────────────┐
│  FIGMA PLUGIN (main thread)                                      │
│  • DS Cache + DS Context Index + hash                            │
│  • (opz.) retrieval snippet su richiesta                           │
│  • Execution engine: frame, instance by id, testo, variabili      │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS: prompt + ds_context_index + mode + …
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND (auth-deploy / oauth-server)                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  A) Kimi Agent Swarm (orchestrazione LLM)                  │  │
│  │     • Sub-routine “Layout Planner” → layout_skeleton JSON  │  │
│  │     • Sub-routine “Component Mapper” → mapping su index    │  │
│  │     Output: action plan unificato (o merge deterministico)│  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  B) Governance (NO Swarm) — codice deterministico           │  │
│  │     • Schema azioni + presenza id/key nell’indice          │  │
│  │     • Repair Kimi classico se violazioni (max N cicli)       │  │
│  └───────────────────────────────────────────────────────────┘  │
│  • consumeCredits solo se piano approvato                        │
└─────────────────────────────────────────────────────────────────┘
```

**Perché Swarm qui:** riduce prompt monolitici; isola contesti (scheletro vs dettaglio componenti). **Perché non Swarm ovunque:** governance e merge devono essere **testabili, loggabili e ripetibili** senza dipendere dal comportamento opaco dello swarm.

**Fallback:** se Swarm non disponibile, errore di configurazione, o A/B test — pipeline **degradata** a **2 chiamate `callKimi` sequenziali** (stessi ruoli Layout / Mapper, stessi schemi JSON intermedi). Stesso contratto in uscita.

---

## 4. Ruoli (mapping doc PDF ↔ implementazione)

| Ruolo nel PDF | Implementazione |
|---------------|-----------------|
| **Orchestrator** | Backend: avvia Swarm (o doppia chiamata), assembla skeleton + map → `action_plan` |
| **Layout Planner** | Agente Swarm (o call 1): solo struttura frame / sezioni / auto-layout intenzionale |
| **Component Mapper** | Agente Swarm (o call 2): solo assegnazione `component_node_id` / varianti / props ammessi dall’indice |
| **Governance Validator** | `validateActionPlan…` esteso + repair (già pattern in `app.mjs`) — **non** LLM swarm |
| **Visual Verifier** | Fase successiva (opzionale, PRO) |

---

## 5. Contratti dati (da definire in codice)

### 5.1 `ds_context_index` (dal plugin)

Oggetto compatto (~100–200 righe JSON target), es.:

- `ds_source: "file"`
- `components[]`: `{ id, name, type: COMPONENT|COMPONENT_SET, variantAxes?, propertyKeys?, slotHints? }`
- `variables_summary`: categorie + count + elenco nomi path (non tutti i valori)
- `hash`: stringa per change detection

Inviato nel body di `POST /api/agents/generate` insieme a `file_key`, `prompt`, `mode`.

### 5.2 Output intermedio Swarm (opzionale ma consigliato per debug)

- `layout_skeleton` — JSON piccolo, solo struttura
- `component_mapping` — riferimenti solo a `id` presenti nell’indice

Merge **deterministico** in un unico `action_plan` nello schema già consumato dall’executor (estendere gradualmente verso `CREATE_INSTANCE` by id, `SET_PROPERTY`, slot).

### 5.3 `action_plan` finale

Allineato allo executor plugin; per Problem 1 le azioni devono referenziare **id reali** dove serve istanziazione.

---

## 6. Fasi di implementazione (ordine obbligatorio)

### Fase 1 — DS Cache + indice nel plugin

**Deliverable:** moduli nel bundle `controller` / `code.js` che costruiscono cache + indice + hash; evento refresh su `documentchange` (debounced).

**Performance (DS molto grandi, primo build):** ricerca e leve evidence-based in [`docs/DS-CONTEXT-INDEX-PERFORMANCE.md`](./DS-CONTEXT-INDEX-PERFORMANCE.md) (`findAllWithCriteria`, `skipInvisibleInstanceChildren`, warm-up, contratto payload).

**Catalogo unico del file (proposta):** [`docs/PLUGIN-DOCUMENT-INDEX-PLAN.md`](./PLUGIN-DOCUMENT-INDEX-PLAN.md) — documento di proposta per presentazione; per dettagli tecnici vedi anche `DS-CONTEXT-INDEX-PERFORMANCE.md`.

**Test:** file con 20+ componenti e 50+ variabili → indice sotto soglia byte/righe; hash cambia se rinomino un componente.

### Fase 2 — Trasporto indice → backend

**Deliverable:** `App.tsx` / `fetchGenerate` invia `ds_context_index` + `ds_cache_hash`; `app.mjs` legge e passa al builder del prompt.

**Test:** network mostra payload; Kimi riceve sezione `[DS CONTEXT INDEX]` nel system prompt.

### Fase 3 — Kimi Agent Swarm (Layout + Mapper)

**Deliverable:** nuovo modulo (es. `generation-swarm.mjs`) che:

1. Chiama API Swarm Kimi con istruzioni divise per ruolo (o workflow documentato Moonshot).
2. Produce `action_plan` **oppure** skeleton + mapping + merge in codice.

**Fallback:** implementare subito il percorso **2× `callKimi`** dietro flag `USE_KIMI_SWARM=0` per non bloccare merge.

**Test:** stesso prompt con file reale → piano con id componente solo se presenti nell’indice.

### Fase 4 — Governance pre-crediti

**Deliverable:** validazione che ogni `INSTANCE` / `component_id` / token citato esista nell’indice (estendere `ds-loader.mjs` o modulo dedicato).

**Test:** piano con id fittizio → 422 + nessun consumo crediti.

### Fase 5 — Executor Problem 1

**Deliverable:** `action-plan-executor.ts` risolve componenti con `getNodeByIdAsync` + `createInstance`; `setProperties`; binding variabili per id.

**Test:** login screen con componenti reali del file → nessun “Component not found” per key del manifest.

### Fase 6 — Modify mode (clone prima di modificare)

**Deliverable:** con selezione, duplicare nodi target e applicare il piano sulla copia.

**Test:** originale intatto, copia modificata.

### Fase 7 — Design Intelligence (`patterns.json`) — dopo stabilità A–F

**Deliverable:** file per file utente (inizialmente vuoto o minimo); integrazione Layout/Governance come nel PDF.

---

## 7. Stato attuale repo (post-fasi 1–7)

- **Plugin:** indice `ds_context_index` + hash, trasporto su `POST /api/agents/generate`, dual Kimi opzionale (`USE_KIMI_SWARM`), esecuzione piano con id componente / `setProperties` / modify (clone).
- **Backend:** governance su indice file (Fase 4), contesto **Design Intelligence** (`design-intelligence.mjs` + `patterns.default.json` / `COMTRA_PATTERNS_JSON_PATH`).
- **Aperti / evoluzioni:** persistenza `patterns.json` per-file su DB; API HTTP Kimi “swarm” separata (non esiste in doc Moonshot); modifica su **istanze** senza contenitore = layout sotto la copia, non dentro.

---

## 8. Riferimenti

- Piano completo e tabelle DS: PDF *COMTRA Generation Engine – Implementation Plan v2.0* (aprile 2026).
- Regole redazionali: `docs/GENERATION-ENGINE-RULESET.md`.
- Sync Storybook (altro binario): `docs/SYNC-INVESTIGATION.md`.

---

*Ultima ricomposizione roadmap: allineata a orchestrator + subagenti con **Kimi Swarm per LLM** e **governance/executor deterministici**.*
