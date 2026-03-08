# UX Logic Audit — Costi, margini e come agisce Kimi

Documento su **calcolo crediti**, **margini** e **flusso operativo** per l’UX Logic Audit (agente Kimi). Riferimenti: **audit-specs/ux-logic-audit/AGENT-DIRECTIVES.md**, **docs/COST-ESTIMATE-DS-AUDIT.md**, **docs/DS-AUDIT-WHO-DOES-WHAT.md**.

---

## 1. Formula crediti (ruleset)

Nel ruleset (**audit-specs/ux-logic-audit/AGENT-DIRECTIVES.md**) la formula è:

- **BASE_COST** = 3 crediti  
- **PER_PAGE_COST** = 1 credito per pagina  
- **COMPLEXITY multiplier** (in base ai nodi):  
  - &lt;100 nodi = 1.0×  
  - 100–500 = 1.5×  
  - 500–2000 = 2.0×  
  - &gt;2000 = 3.0×  

**TOTAL** = `ceil( (BASE_COST + pages × PER_PAGE_COST) × MULTIPLIER )`

Esempio: 5 pagine, 300 nodi → (3 + 5×1) × 1.5 = **12 crediti**.

L’agente Kimi **non calcola** i crediti: il backend li applica in base a pagine e nodi (o alla banda di complessità scelta).

---

## 2. Situazione attuale nel backend

In **auth-deploy/oauth-server/app.mjs**:

- **Stima crediti:** `estimateCreditsByAction('ux_audit', nodeCount)` restituisce **4 crediti** (valore fisso, indipendente da nodi/pagine).
- **XP:** `ux_audit: 45` (stesso blocco `XP_BY_ACTION`).

Quindi oggi **non** è ancora implementata la formula del ruleset (pagine + moltiplicatore complessità). Il valore 4 è un placeholder.

**Allineamento consigliato (quando si implementa l’endpoint UX):**

- **Opzione A — Formula ruleset:** il backend riceve `page_count` (o lo ricava dal JSON) e `node_count`; calcola `TOTAL` con BASE + PER_PAGE × pages e moltiplicatore per nodi; usa quel valore per `estimate` e `consume`.
- **Opzione B — Bande come DS (solo nodi):** come per DS Audit, bande per numero nodi (es. ≤500 → 3, ≤5k → 5, ≤50k → 8, &gt;50k → 12) e si ignora il dettaglio “per pagina”. Più semplice da integrare con il flusso esistente (count-nodes → stima → conferma → consume).

In **constants.ts** oggi **non** esiste una matrice UX (tipo `UX_SCAN_SIZE_TIERS` o `getUxCostAndSize`). Quando si collega il tab UX al backend, andrà aggiunta una matrice coerente con quella usata dal backend (e dal ruleset, se si adotta la formula).

---

## 3. Margini e costo Kimi

La logica è la stessa del DS Audit (**docs/COST-ESTIMATE-DS-AUDIT.md**):

- **Costo Kimi** = token (input + output) × prezzo per token (input ~$0.40/1M, output ~$2.00/1M).
- **Ricavo** = crediti addebitati × prezzo per credito (dai piani: es. €0,25/credito per 1m).
- **Margine** = ricavo − costo Kimi (per quell’azione). Per essere in attivo:  
  **crediti_addebitati × prezzo_credito > token_usati × costo_per_token**.

Il prompt UX è **più lungo** del DS (60 regole, 11 categorie, pipeline a 5 fasi, escalation, state matrix): quindi l’**input token** per singola chiamata sarà maggiore. L’**output** include `summary` (healthScore, badge, conteggi) + `issues` + eventuali `escalations`, quindi anche l’output può essere più lungo del DS (che restituisce solo `issues`).

**Implicazioni:**

- Per **non andare in perdita** serve che i crediti addebitati per UX (con la formula o con le bande) coprano un costo Kimi **medio** superiore a quello del DS (es. ~1,2–1,5× token input).
- **Break-even prezzo/credito:** come per DS, nell’ordine di **~$0.003–0.004 per credito**; con 4–12 crediti per run il costo Kimi per run resta nell’ordine di **~$0.01–0.05**; i piani PRO hanno prezzo/credito molto più alto (€0,12–0,35), quindi il **margine lordo vs. Kimi resta alto** (98%+).
- **Telemetria:** quando l’endpoint UX chiamerà Kimi, andrà loggato `action_type: 'ux_audit'` in `kimi_usage_log` (come per `ds_audit`) per avere **token reali** e ricalibrare crediti/costi (vedi **docs/TOKEN-USAGE-TELEMETRY.md**).

---

## 4. Come Kimi consumerà e agirà (flusso)

Kimi **non** “sceglie” i costi né legge i crediti: riceve **solo** il system prompt e il JSON del file; il **backend** gestisce crediti, stima e consumo.

### 4.1 Ruolo di Kimi

1. **Input:**  
   - **System prompt:** costruito da regole e direttive (audit-specs/ux-logic-audit/): scope UX (no prototipo), 60 regole UXL-001…064, categorie, severity, detection logic, pipeline a 5 fasi, escalation, state matrix, tono e soppressione falsi positivi (AGENT-DIRECTIVES).  
   - **User message:** JSON del file Figma (o del sottoinsieme se scope = page/current), come per DS Audit.

2. **Azione:** Kimi analizza il **node tree** (design statico: frame, componenti, varianti, testo, auto-layout). **Non** legge connessioni prototipo. Applica le regole e la pipeline (classificazione nodi → varianti → contenuto → layout → escalation) e produce un JSON strutturato.

3. **Output:** un unico JSON (o blocco ```json) con:
   - `auditType`, `version`
   - `summary`: healthScore, badge, totalIssues, high, med, low, escalations
   - `issues`: array di issue (id UXL-NNN, categoryId, msg, severity, layerId, fix, pageName, heuristic, nodeName, …)
   - `escalations`: opzionale (ESC-001…006)

Il backend **estrae** questo JSON dalla risposta, **normalizza** le issue nel formato `AuditIssue` (msg, fix, layerId, categoryId, severity, rule_id, heuristic, …), calcola o verifica **summary** (healthScore/badge), e restituisce al plugin `{ issues, summary }` (o simile). Poi il backend **consuma** i crediti con `action_type: 'ux_audit'` e `credits_consumed` pari al valore stabilito dalla matrice (o dalla formula del ruleset).

### 4.2 Chi fa cosa (sintesi)

| Attore | Cosa fa |
|--------|--------|
| **Plugin** | Utente avvia “Run UX Audit” (scope = Current Selection o pagina); plugin invia richiesta al backend con file_key, scope, page_id/node_ids se necessario; mostra stima crediti (da estimate); dopo conferma riceve issues + summary e aggiorna UI (score, badge, categorie, lista). |
| **Backend** | Verifica JWT; ottiene token Figma; scarica JSON file (o sottoinsieme); carica system prompt UX (da file tipo `ux-audit-system.md`); chiama **Kimi** (Moonshot API) con system + user (JSON file); estrae e valida JSON; normalizza issue; logga token in `kimi_usage_log`; risponde al plugin; su conferma/consumo: `estimateCreditsByAction('ux_audit', …)` e `consume` con `action_type: 'ux_audit'`. |
| **Kimi** | Riceve prompt + JSON; esegue analisi UX sul design statico; restituisce JSON (summary + issues + escalations). **Non** vede crediti, prezzi o margini. |

### 4.3 Implementazione backend (da fare)

- **Endpoint:** `POST /api/agents/ux-audit` (o `/api/agents/ux-logic-audit`), stesso pattern di `POST /api/agents/ds-audit`: body con `file_key`, JWT, opzionali `scope`, `page_id`, `node_ids`; stesso flusso Figma (getFigmaAccessToken, fetchFigmaFileForAudit).
- **Prompt:** creare **auth-deploy/prompts/ux-audit-system.md** (o equivalente) che includa/sintetizzi: README + UX-LOGIC-AUDIT-RULES.md + OUTPUT-SCHEMA.md + SEVERITY-AND-SCORE.md + AGENT-DIRECTIVES.md (+ pipeline, escalation, state matrix in forma compatta). Oppure il backend compone il prompt leggendo da più file in audit-specs/ux-logic-audit/.
- **Chiamata Kimi:** come DS: `POST https://api.moonshot.ai/v1/chat/completions` con `model`, `messages` (system + user), `temperature` (es. 0.3), `max_completion_tokens` (es. 8192 per output più grande per summary + molte issue).
- **Parsing:** estrarre JSON da content (anche da ```json); validare `auditType`, `summary`, `issues`; mappare ogni issue su formato AuditIssue (layerId ← nodeId, msg, fix, categoryId, severity, rule_id ← id, heuristic, nodeName); restituire `{ issues, summary }` al plugin.
- **Crediti:** prima dell’audit (o in un passo di “stima”) usare `estimateCreditsByAction('ux_audit', nodeCount)` (e in futuro, se si adotta la formula, passare anche page_count e usare la formula del ruleset). Dopo l’audit, `POST /api/credits/consume` con `action_type: 'ux_audit'` e `credits_consumed` pari al valore stimato (o ricalcolato).

---

## 5. Riepilogo numeri e azioni

| Voce | Valore / azione |
|------|------------------|
| **Formula ruleset (AGENT-DIRECTIVES)** | BASE 3 + pages×1, × moltiplicatore nodi (1.0–3.0×). Es. 5 pagine, 300 nodi → 12 crediti. |
| **Backend attuale (app.mjs)** | Stima flat **4 crediti** per `ux_audit`; XP **45** per azione. |
| **Kimi** | Non calcola crediti; riceve prompt + JSON; restituisce JSON (summary + issues + escalations). |
| **Margine** | Stessa logica del DS: crediti × prezzo/credito ≫ costo token Kimi; prompt UX più lungo → più token input; tarare crediti/bande e telemetria per restare in margine. |
| **Da implementare** | Endpoint `POST /api/agents/ux-audit`; prompt `ux-audit-system.md`; matrice/tier UX in constants (e in backend se si usano bande); integrazione plugin (fetchUxAudit, consume crediti, mostrare summary + issues). |

---

## Riferimenti

- **Ruleset UX:** audit-specs/ux-logic-audit/ (README, UX-LOGIC-AUDIT-RULES.md, OUTPUT-SCHEMA.md, AGENT-DIRECTIVES.md, DETECTION-PIPELINE.md, ESCALATION-RULES.md).
- **Costi generali e margini:** docs/COST-ESTIMATE-DS-AUDIT.md.
- **Flusso agente DS (replica per UX):** docs/DS-AUDIT-WHO-DOES-WHAT.md; docs/ACTION-PLAN-KIMI-AGENTS.md.
- **Telemetria token:** docs/TOKEN-USAGE-TELEMETRY.md.
- **Backend:** auth-deploy/oauth-server/app.mjs (estimateCreditsByAction, route ds-audit, kimi_usage_log).
