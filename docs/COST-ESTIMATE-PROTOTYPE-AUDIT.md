# Matrice crediti — Prototype Audit (in-plugin, deterministico)

Documento sulla **matrice di calcolo crediti** per l’azione **Prototype Audit**: scope per **flussi** (flow starting points), **crediti proporzionali al numero di flussi selezionati**, valori **bassi** (1–4). L’audit è **in-plugin** (nessun Kimi, nessun backend per i finding).  
Riferimento generale costi/crediti: **docs/COST-ESTIMATE-DS-AUDIT.md**.

---

## 1. Unità di scope (flussi, non pagine)

A differenza di DS e A11Y, lo scope **non** è “All Pages” né per pagina: l’utente sceglie **quali flussi** auditare tramite **multi-select** sui flow starting point della pagina corrente.

- **Fonte flussi:** `figma.currentPage.flowStartingPoints` → `ReadonlyArray<{ nodeId: string; name: string }>`.
- **Parametro per il costo:** **numero di flussi selezionati** (1, 2–3, 4–6, 7+).

Il plugin invia `node_count` = numero di flussi selezionati in `estimateCredits` (riuso del parametro); il backend restituisce i crediti per `action_type: 'proto_audit'`.

---

## 2. Matrice crediti Prototype Audit

| Flussi selezionati | Crediti consumati | Note |
|--------------------|-------------------|------|
| 1                  | **1**             | Un solo flusso. |
| 2–3                | **2**             | |
| 4–6                | **3**             | |
| 7+                 | **4**             | Tetto basso anche con molti flussi. |

**Confronto:** DS 2–11 (nodi), A11Y 1–6 (nodi). Il Prototype costa meno perché l’esecuzione è **in-plugin** (zero costo server per i finding); i crediti servono per tracking e fairness.

---

## 3. Dove è definita la matrice

| Dove | Cosa |
|------|------|
| **Plugin (constants.ts)** | `PROTO_AUDIT_FLOW_TIERS`, `getPrototypeAuditCost(selectedFlowCount)` — per UI (stima crediti in modale prima del Run). |
| **Backend (oauth-server/app.mjs)** | `estimateCreditsByAction(actionType, nodeCount)` con `action_type === 'proto_audit'`: `nodeCount` = numero flussi → 1 / 2 / 3 / 4. |
| **Consumo** | `POST /api/credits/consume` con `action_type: 'proto_audit'` e `credits_consumed` pari al valore restituito dalla stima. |

---

## 4. Flusso crediti (plugin → backend)

1. **Stima:** Plugin chiama `POST /api/credits/estimate` con `{ action_type: 'proto_audit', node_count: N }` (N = numero flussi selezionati) → backend risponde `{ estimated_credits: 1|2|3|4 }`.
2. **Conferma:** Plugin mostra all’utente il costo (es. “Questo audit consumerà 2 crediti (2–3 flussi)”) e chiede conferma.
3. **Esecuzione:** Plugin esegue l’audit in-plugin (traversale, grafo, regole P-01–P-20); nessuna chiamata backend per i finding.
4. **Consumo:** Plugin chiama `POST /api/credits/consume` con `{ action_type: 'proto_audit', credits_consumed: <stima> }`.

Il valore mostrato in UI (da `getPrototypeAuditCost`) deve coincidere con quello usato da `estimate` e `consume`.

---

## 5. Costo operativo (in-plugin)

Non c’è costo Kimi né elaborazione backend per i finding. Il “costo” è solo:

- **Consume:** registrazione in `credit_transactions` e eventuale XP/trophy per `proto_audit`.

I crediti addebitati (1–4) sono quindi **margine**; la matrice serve a scalare per **numero di flussi** e a mantenere coerenza con il modello crediti del prodotto.

**Tips AI (opzionale):** se si aggiunge il blocco “Prototype health tips” (backend/LLM), i tips possono essere inclusi nel run senza crediti aggiuntivi, oppure +1 credito solo per “Genera consigli” (action_type `proto_tips`).

---

## 6. Riferimenti

- **Scope e UI:** audit-specs/prototype-audit/SCOPE-AND-UI.md (multi-select flussi, no All Pages).
- **Regole e output:** audit-specs/prototype-audit/ (PROTOTYPE-AUDIT-RULES.md, OUTPUT-SCHEMA.md).
- **Costi generali e piani:** docs/COST-ESTIMATE-DS-AUDIT.md.
- **Constants (plugin):** `constants.ts` → `PROTO_AUDIT_FLOW_TIERS`, `getPrototypeAuditCost`.
- **Backend:** auth-deploy/oauth-server/app.mjs → `estimateCreditsByAction`, `proto_audit`.
