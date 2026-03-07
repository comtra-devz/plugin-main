# Generation Engine — Fattibilità tecnica e costi (Kimi, senza Claude)

Verifica della fattibilità del piano tecnico per la sezione **Generate**, con **Kimi come unico LLM** e valutazione dell’opportunità di introdurre Claude (sconsigliata per costi).

---

## 1. Riepilogo

| Aspetto | Esito |
|--------|--------|
| **Kimi come unico motore** | Fattibile e consigliato. Vision (screenshot), contesto lungo, streaming e output strutturato sono supportati. |
| **Implementare Claude come fallback** | Sconsigliato: costo 6–11× superiore; margini Generation si erodono. |
| **Strategia fallback** | Retry Kimi (1–2 volte) + messaggio chiaro all’utente in caso di fallimento. Opzionale: fallback su modello economico (es. stesso provider, altro tier) solo se serve SLA enterprise. |
| **Stack già presente** | Backend già chiama Moonshot (DS Audit); pipeline file_key → Figma JSON → Kimi collaudata. Manca solo endpoint Generate + prompt + esecuzione action plan nel plugin. |

---

## 2. Cosa c’è già in codebase

- **Backend (auth-deploy):**
  - `KIMI_API_KEY`, `KIMI_MODEL` (es. `kimi-k2-0905-preview`), chiamata a `https://api.moonshot.ai/v1/chat/completions`.
  - Pattern: system prompt da file (`.md`), user message con payload, estrazione JSON da risposta (`extractJsonFromContent`), telemetria token (`kimi_usage_log`).
- **Pipeline dati:** `file_key` + JWT → backend → Figma REST `GET /v1/files/:key` → JSON inviato a Kimi (usato per DS Audit). Per Generate servirà lo stesso flusso (contesto DS) + prompt utente + eventuale screenshot (base64) o link Figma.
- **Plugin:** UI Generate (placeholder), crediti estimate/consume, Design System selector. Manca: chiamata a nuovo endpoint, invio contesto DS + prompt, ricezione action plan JSON, esecuzione Figma Plugin API.
- **Ruleset:** `docs/GENERATION-ENGINE-RULESET.md` (modi, governance, schema azioni, validazione, crediti).

Nessun uso di Claude/Anthropic nel repo; è citato solo nella ruleset come fallback.

---

## 3. Capacità Kimi (Moonshot) per Generation

| Requisito | Supporto | Note |
|-----------|----------|------|
| **Testo lungo (contesto DS)** | Sì | Context window 256K–262K token; component index <4K token/DS come in ruleset. |
| **Vision (Mode 3: screenshot)** | Sì | Kimi K2.5 è multimodale (text + image); formato OpenAI-compatible (content con `type: image_url` o simile). Verificare su [platform.moonshot.ai](https://platform.moonshot.ai/docs) il formato esatto per le immagini. |
| **Output strutturato (action plan JSON)** | Sì | Nessun “JSON mode” esplicito in doc; stesso approccio DS Audit: system prompt che impone “restituisci solo JSON”, poi `extractJsonFromContent` + validazione schema. |
| **Streaming** | Sì | API compatibile OpenAI; streaming disponibile per ridurre latency “time to first token” e avviare esecuzione parziale se si vuole. |
| **Costo contenuto** | Sì | Input ~$0.45/M, output ~$2.20–2.50/M, cache ~$0.15–0.225/M (ruleset). |

Modello da usare: confermare in documentazione Moonshot se per **vision** serve un nome modello specifico (es. `kimi-k2.5` o `kimi-k2-turbo-preview` con supporto immagini). Se `kimi-k2-0905-preview` è solo testo, per Mode 3 (screenshot) andrà usato il modello multimodale indicato dalla doc.

---

## 4. Confronto costi: Kimi vs Claude

*(Prezzi indicativi per 1M token; verificare sempre su provider.)*

| Provider | Input / 1M | Output / 1M | Note |
|----------|------------|-------------|------|
| **Kimi K2.5** | ~$0.45 | ~$2.20–2.50 | Già in uso; vision, 262K context. |
| **Claude Sonnet 4.5** | ~$3.00 | ~$15.00 | 6–7× input, 6× output vs Kimi. |
| **Claude Opus 4.5** | ~$5.00 | ~$25.00 | 11× input, 10× output vs Kimi. |

Per una generazione “standard” (es. ~20K input + 3K output):

- **Kimi:** ~$0.009 + ~$0.0066 ≈ **~$0.016** per richiesta.
- **Claude Sonnet:** ~$0.06 + ~$0.045 ≈ **~$0.105** per richiesta (~6.5×).
- **Claude Opus:** ~$0.10 + ~$0.075 ≈ **~$0.175** per richiesta (~11×).

Introducendo Claude come fallback automatico, ogni fallback Kimi moltiplicherebbe il costo di quella richiesta di 6–11×. Con margini Generation già tarati su Kimi (ruleset §9), il fallback Claude eroderebbe il margine e andrebbe usato solo in casi eccezionali (es. enterprise con SLA).

**Raccomandazione:** non implementare Claude nella prima versione. Preferire **solo Kimi**, con retry in caso di timeout/errore, e messaggio chiaro (“Generazione non disponibile, riprova tra poco”) se tutti i retry falliscono.

---

## 5. Perché una generazione può “fallire” (casi concreti)

Non è che il motore “fallisce a caso”: ci sono **cause ben definite** per cui il flusso non arriva al canvas e non si addebitano crediti.

| Dove | Cosa può andare storto | Esempio |
|------|------------------------|---------|
| **Chiamata a Kimi** | Timeout (es. >8 s senza risposta), errore 5xx Moonshot, rate limit, problema di rete. | Il backend non riceve mai un body valido. |
| **Risposta Kimi** | Il modello restituisce testo prima/dopo il JSON, JSON troncato, sintassi non valida, struttura diversa dallo schema (es. `actions` non array). | `extractJsonFromContent` restituisce `null` o l’oggetto non ha `version` / `actions`. |
| **Validazione (V-GEN-*)** | Il JSON arriva ma **non passa** le regole: un `componentKey` non esiste nel DS, un `variableId` non è nell’indice, una combinazione di varianti non è valida, un’azione contiene valori raw (hex, px) invece di riferimenti a variabili. | Backend rifiuta l’action plan e non lo invia al plugin (opzionalmente può ri-chiedere a Kimi con prompt più stretto). |
| **Esecuzione nel plugin** | Durante l’esecuzione delle azioni (CREATE_FRAME, INSTANCE_COMPONENT, …) una chiamata Figma API fallisce: componente non trovato, variabile inesistente, nodo già eliminato, ecc. | Il plugin fa rollback (undo di tutto) e mostra errore; nessun credito addebitato. |

In sintesi: **fallisce** quando (1) non arriva una risposta valida da Kimi, (2) la risposta non è JSON utilizzabile, (3) il JSON non supera la validazione governance, oppure (4) l’esecuzione su Figma va in errore. Il retry serve soprattutto per (1) e, in parte, per (2); (3) e (4) non si “risolvono” con un altro modello, ma con validazione e rollback.

---

## 6. Strategia fallback senza Claude

1. **Retry Kimi:** in caso di timeout (>8 s), JSON malformato o errore 5xx: ritentare la stessa chiamata fino a **2 volte** (totale 3 tentativi) con backoff breve (es. 1–2 s).
2. **Validazione lato backend:** prima di restituire l’action plan al plugin, validare contro regole V-GEN-01…06 (componentKey, variableId, variant, slot, no raw values). Se la validazione fallisce, **non** passare a un altro modello: restituire errore e opzionalmente ri-chiedere a Kimi con prompt più stretto (“usa solo questi componenti: …”).
3. **UX:** se dopo retry la generazione fallisce ancora, mostrare messaggio unico (“La generazione non è andata a buon fine. Riprova tra qualche minuto.”) e **non addebitare crediti** (come da ruleset).
4. **Opzionale (fase successiva):** se si vuole un fallback per disponibilità (es. Moonshot down), valutare un **secondo modello economico** sullo stesso provider o via OpenRouter (modello a basso costo, stesso schema JSON) invece di Claude. Da decidere solo in base a metriche di uptime e SLA.

---

## 7. Fattibilità per componente

| Componente | Fattibilità | Dipendenze |
|------------|-------------|------------|
| **Backend: POST /api/agents/generate** | Alta | Stesso pattern di ds-audit: JWT, file_key, prompt, mode, ds_choice; lettura contesto DS (Figma JSON o manifest open DS); system prompt da `prompts/generate-system.md`; chiamata Moonshot; validazione action plan; return JSON. |
| **Prompt generate-system.md** | Alta | Estrarre regole da GENERATION-ENGINE-RULESET.md; includere schema JSON (version, metadata, frame, actions); istruzioni “solo JSON, nessun testo prima/dopo”. |
| **Contesto DS (Custom)** | Alta | Già disponibile: stesso flusso di DS Audit (file_key → Figma file JSON). Per Generate si invia un **sottoinsieme** (component index, variabili, slot) per tenere il contesto sotto 4K token. |
| **Contesto DS (Open)** | Media | Manifest pre-indicizzati lato server (ruleset §12.1); endpoint o storage da definire; plugin/backend carica manifest su DS selection. Non bloccante per MVP: si può partire solo con Custom. |
| **Mode 3 (screenshot)** | Alta | Upload immagine nel plugin → base64 (o URL) nel body → messaggio multimodale a Kimi. Verificare formato content type (image_url) su doc Moonshot. |
| **Mode 4 (link Figma)** | Media | Backend risolve link con Figma REST (o plugin passa nodeId/file_key già risolto); struttura del frame come contesto. Richiede permessi view sul file linkato. |
| **Plugin: esecuzione action plan** | Alta | Loop su `actions[]`: CREATE_FRAME, INSTANCE_COMPONENT, POPULATE_SLOT, SET_TEXT, SET_VARIABLE, SET_LAYOUT, NEST tramite Figma Plugin API; tutto in `figma.commitUndo()`. Lavoro di implementazione ma nessuna dipendenza da Claude. |
| **Crediti** | Alta | Stima prima (complexity_tier da prompt o da primo giro LLM); ScanReceiptModal; detrazione solo dopo canvas render riuscito. Già previsto in ruleset e in UI. |

---

## 8. Rischi e mitigazioni

| Rischio | Mitigazione |
|--------|-------------|
| Kimi K2.5 “verboso” (2–3× token vs Claude) | System prompt stringente: “Rispondi SOLO con un JSON valido, nessun markdown né testo.”; `max_tokens` limitato (es. 8K–16K per action plan). |
| Modello vision non esposto con nome attuale | Verificare su Moonshot quali model id supportano immagini; eventualmente usare `kimi-k2.5` o equivalente per Mode 3 e tenere `kimi-k2-0905-preview` per Mode 1/2/4. |
| Timeout >8 s | Retry 2 volte; se fallisce, errore utente senza addebito. Opzionale: streaming per mostrare “generazione in corso” e ridurre percezione attesa. |
| Action plan malformato o con riferimenti inventati | Validazione V-GEN-01…06 in backend; rifiuto e messaggio “Generazione non riuscita” senza chiamare il plugin con dati invalidi. |
| Costo per generazione complessa | Tier crediti (1–8 + screenshot) già in ruleset; monitorare token reali con `kimi_usage_log` e aggiustare tier se necessario. |

---

## 9. Piano implementativo sintetico (senza Claude)

1. **Backend:** nuovo endpoint `POST /api/agents/generate` (o sotto `api/agents/[...slug]` per non consumare slot Vercel). Input: `file_key`, `prompt`, `mode`, `ds_source`, opzionale `screenshot_base64` o `figma_link`. Logica: recupero contesto DS (file o manifest), build system prompt da ruleset, chiamata Moonshot, estrazione e validazione JSON, return action plan.
2. **Prompt:** creare `auth-deploy/prompts/generate-system.md` con regole estratte da GENERATION-ENGINE-RULESET.md e schema azioni (version, metadata, frame, actions).
3. **Plugin:** da `views/Generate.tsx` chiamare l’endpoint con JWT; inviare `file_key`, prompt, mode (da selection/upload/link), ds_choice; ricevere JSON; eseguire azioni con Figma API in un solo `commitUndo`; gestire errori e crediti (stima prima, consume solo su successo).
4. **Modello Moonshot:** usare `KIMI_MODEL` esistente per Mode 1/2/4; per Mode 3 (screenshot) verificare e, se necessario, introdurre variabile `KIMI_VISION_MODEL` e usarla solo quando è presente `screenshot_base64`.
5. **Niente Claude:** nessuna chiave Anthropic, nessun branch di fallback verso Claude. Documentare in GENERATION-ENGINE-RULESET.md che il fallback è “retry Kimi” e, in futuro, eventuale secondo modello economico (non Claude) se richiesto da SLA.

---

## 10. Riferimenti

- Ruleset: `docs/GENERATION-ENGINE-RULESET.md`
- Spec UI: `docs/GENERATE-TAB-SPEC.md`
- Costi DS Audit (modello Kimi): `docs/COST-ESTIMATE-DS-AUDIT.md`
- Pipeline Kimi (DS Audit): `auth-deploy/oauth-server/app.mjs` (DS Audit handler), `docs/KIMI-FOR-DUMMIES.md`
- Fattibilità multi-agente: `docs/FEASIBILITY-KIMI-SWARM.md`
- Moonshot: [platform.moonshot.ai](https://platform.moonshot.ai/docs)

---

*Documento di fattibilità tecnica; nessuna implementazione Claude consigliata per contenere i costi.*
