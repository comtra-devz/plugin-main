# Matrice crediti — Accessibility Audit v1.0 (senza Kimi)

Documento sulla **matrice di calcolo crediti** per l’azione **A11Y Audit v1.0**: stesse **bande di complessità** del DS Audit (numero nodi), **costi inferiori** perché non c’è chiamata a Kimi (solo backend: contrast, touch, OKLCH, euristiche).  
Riferimento generale costi/crediti: **docs/COST-ESTIMATE-DS-AUDIT.md**.

---

## 1. Bande di complessità (allineate al DS Audit)

La complessità del file è misurata come **conteggio nodi** (come per lo Scan DS). Stesse soglie:

| Dimensione | Nodi (max) | Label   |
|------------|------------|--------|
| Small      | ≤ 500      | Small  |
| Medium     | ≤ 5 000    | Medium |
| Large      | ≤ 50 000   | Large  |
| 200k+      | > 50 000   | 200k+  |

Il plugin invia `node_count` (o il backend lo ricava dal JSON Figma) e il backend restituisce i crediti stimati per `action_type: 'a11y_audit'`.

---

## 2. Matrice crediti A11Y Audit v1.0

| Dimensione | Nodi (max) | Crediti consumati | Note |
|------------|------------|-------------------|------|
| Small      | ≤ 500      | **1**             | File piccolo; elaborazione backend leggera. |
| Medium     | ≤ 5 000    | **2**             | |
| Large      | ≤ 50 000   | **4**             | |
| 200k+      | > 50 000   | **6**             | File molto grande; più nodi da analizzare. |

**Confronto con DS Audit (Kimi):** DS usa 2 / 5 / 8 / 11 crediti per le stesse bande. A11Y v1.0 costa meno perché non c’è costo token (nessuna chiamata a Kimi), solo lavoro backend (contrast ratio, touch target, OKLCH, euristiche focus/alt/semantics).

---

## 3. Dove è definita la matrice

| Dove | Cosa |
|------|------|
| **Plugin (constants.ts)** | `A11Y_SCAN_SIZE_TIERS`, `getA11yCostAndSize(nodeCount)` — per UI (stima crediti in modale prima del Run A11Y). |
| **Backend (oauth-server/app.mjs)** | `estimateCreditsByAction(actionType, nodeCount)` con `action_type === 'a11y_audit'` o `'a11y_check'`: stesse bande (500 / 5k / 50k) → 1 / 2 / 4 / 6. |
| **Consumo** | `POST /api/credits/consume` con `action_type: 'a11y_audit'` e `credits_consumed` pari al valore restituito dalla stima (o ricalcolato lato server con stessa logica). |

---

## 4. Flusso crediti (plugin → backend)

1. **Stima:** Plugin chiama `POST /api/credits/estimate` con `{ action_type: 'a11y_audit', node_count: N }` → backend risponde `{ estimated_credits: 1|2|4|6 }`.
2. **Conferma:** Plugin mostra all’utente il costo (es. “Questo scan consumerà 2 crediti”) e chiede conferma.
3. **Esecuzione:** Backend esegue l’audit A11Y (contrast, touch, OKLCH, euristiche; nessuna chiamata Kimi).
4. **Consumo:** Plugin chiama `POST /api/credits/consume` con `{ action_type: 'a11y_audit', credits_consumed: <stima> }` (o il backend comunica i crediti effettivi dopo l’audit).

Se il plugin usa `getA11yCostAndSize(count)` lato client per il modale, il valore deve coincidere con quello che il backend usa per `estimate` e `consume` (stesse bande e stessi numeri).

---

## 5. Costo operativo (no Kimi)

Non c’è costo API Kimi per A11Y v1.0. Il “costo” è solo:
- **Backend:** CPU/tempo (parsing JSON, calcolo contrast/touch, OKLCH, euristiche).
- **Hosting:** invocazione serverless e eventuale DB (credit_transactions, XP).

I crediti addebitati (1–6) sono quindi quasi interamente margine rispetto al costo operativo; la matrice serve a **scalare per complessità** (file grandi = più lavoro) e a mantenere coerenza con il modello crediti del prodotto (stesse bande del DS, prezzo inferiore perché valore “deterministico” senza LLM).

---

## 6. Riferimenti

- **Piano A11Y (v1.0 senza Kimi):** docs/A11Y-AUDIT-PLAN.md (flusso, API, OKLCH).
- **Regole e output:** audit-specs/a11y-audit/ (A11Y-AUDIT-RULES.md, OUTPUT-SCHEMA.md).
- **Costi generali e piani:** docs/COST-ESTIMATE-DS-AUDIT.md.
- **Constants (plugin):** `constants.ts` → `A11Y_SCAN_SIZE_TIERS`, `getA11yCostAndSize`.
- **Backend:** `auth-deploy/oauth-server/app.mjs` → `estimateCreditsByAction`, `a11y_audit` / `a11y_check`.
