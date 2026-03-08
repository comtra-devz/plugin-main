# UX Logic Audit — Schema JSON di output

L’agente UX Logic Audit restituisce un unico JSON valido. Nessun testo prima o dopo; il payload può essere racchiuso in un blocco markdown ` ```json ... ``` ` per estrazione da parte del backend.

**Scope:** le issue devono riguardare solo la **UX** del design statico (stati, label, feedback, copy, layout, pattern, etica, i18n). Non devono riguardare connessioni prototipo, “dove porta un click” o dead-end di flusso (competenza del Prototype Audit).

Compatibilità con il tipo **AuditIssue** del frontend: i campi sono mappati così:
- `id` → UXL-NNN (es. UXL-001)
- `categoryId` → una delle 11 categorie (system-feedback, form-ux, …)
- `msg` ← `description`
- `severity` → HIGH | MED | LOW
- `layerId` ← `nodeId`
- `pageName` → opzionale
- `fix` ← `suggestedFix`
- `heuristic` (opzionale) ← e.g. "H1 - Visibility of System Status"
- `nodeName` (opzionale) ← nome del nodo Figma
- `autoFixAvailable` (opzionale) ← boolean

---

## Formato radice

```json
{
  "auditType": "ux-logic",
  "version": "1.0",
  "summary": { ... },
  "issues": [ ... ],
  "escalations": [ ... ]
}
```

- **auditType** (string): sempre `"ux-logic"`.
- **version** (string): versione ruleset, es. `"1.0"`.
- **summary** (object): health score, badge, conteggi. Obbligatorio.
- **issues** (array): lista di issue. Array vuoto `[]` se nessun problema.
- **escalations** (array): opzionale; issue composte o flag (CRITICAL FORM, DARK PATTERN ALERT, ecc.) da **ESCALATION-RULES.md**.

---

## Summary

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| healthScore | number | 0–100. Formula: max(0, 100 - HIGH×5 - MED×2 - LOW×1). |
| badge | string | Uno di: `EXCELLENT`, `GOOD`, `NEEDS WORK`, `CRITICAL`. |
| totalIssues | number | Numero totale issue. |
| high | number | Conteggio severity HIGH. |
| med | number | Conteggio severity MED. |
| low | number | Conteggio severity LOW. |
| escalations | number | Numero di escalation applicate. |

Badge: 90–100 EXCELLENT, 70–89 GOOD, 50–69 NEEDS WORK, 0–49 CRITICAL. Vedi **SEVERITY-AND-SCORE.md**.

---

## Oggetto issue (compatibile con AuditIssue)

| Campo | Tipo | Obbligatorio | Descrizione |
|-------|------|--------------|-------------|
| id | string | Sì | Identificativo regola: UXL-001 … UXL-064. |
| categoryId | string | Sì | Una di: system-feedback, interaction-safety, form-ux, navigation-ia, content-copy, error-handling, data-tables, responsive-layout, cognitive-load, dark-patterns, i18n. |
| msg | string | Sì | Descrizione breve per l’utente (equiv. `description` nel PDF). |
| severity | string | Sì | Esattamente uno di: HIGH, MED, LOW. |
| layerId | string | Sì | `id` del nodo Figma (equiv. `nodeId`). |
| layerIds | string[] | No | Se l’issue riguarda più nodi. |
| fix | string | Sì | Suggerimento di fix (equiv. `suggestedFix`). |
| pageName | string | No | Nome pagina/canvas. |
| heuristic | string | No | Es. "H1 - Visibility of System Status". |
| nodeName | string | No | Nome del nodo (es. "submit-btn"). |
| autoFixAvailable | boolean | No | Se è possibile un auto-fix (default false). |

Per il frontend si usano `msg` e `fix` come per DS/A11Y; `heuristic` e `nodeName` arricchiscono la card se presenti.

---

## Esempio completo

```json
{
  "auditType": "ux-logic",
  "version": "1.0",
  "summary": {
    "healthScore": 72,
    "badge": "GOOD",
    "totalIssues": 18,
    "high": 3,
    "med": 9,
    "low": 6,
    "escalations": 1
  },
  "issues": [
    {
      "id": "UXL-001",
      "categoryId": "system-feedback",
      "msg": "Interactive submit has no loading or skeleton variant",
      "severity": "HIGH",
      "layerId": "12:3456",
      "fix": "Add a loading/spinner or skeleton variant to the component set",
      "pageName": "Home V2",
      "heuristic": "H1 - Visibility of System Status",
      "nodeName": "submit-btn",
      "autoFixAvailable": false
    },
    {
      "id": "UXL-012",
      "categoryId": "form-ux",
      "msg": "Text input has no persistent visible label",
      "severity": "HIGH",
      "layerId": "12:3457",
      "fix": "Add a visible label (TEXT node above or left); avoid placeholder-only",
      "pageName": "Checkout",
      "heuristic": "H5 - Error Prevention",
      "nodeName": "email-input",
      "autoFixAvailable": false
    }
  ],
  "escalations": [
    {
      "id": "ESC-001",
      "label": "CRITICAL FORM",
      "description": "Form has both UXL-012 (Missing Label) and UXL-013 (No Error State)",
      "ruleIds": ["UXL-012", "UXL-013"]
    }
  ]
}
```

---

## Issue card in UI

- Badge severity: HIGH = Red #D32F2F, MED = Yellow #F9A825, LOW = Green #66BB6A.
- Pulsante VIEW: naviga il canvas Figma al nodo `layerId`.
- Paywall: free tier può mostrare le prime 3 issue; resto dietro PRO con CTA “UNLOCK N HIDDEN ISSUES”.

---

## Regole per l’agente

1. Restituire **solo** il JSON sopra (o un unico blocco ` ```json ... ``` `).
2. **id** issue: sempre UXL-NNN (001–064) come da **UX-LOGIC-AUDIT-RULES.md**.
3. **categoryId**: solo i valori della tabella categorie.
4. **severity**: rispettare la severity indicata per ogni regola.
5. **layerId**: usare l’`id` reale del nodo dal JSON Figma quando disponibile.
6. **fix**: tono costruttivo (vedi **AGENT-DIRECTIVES.md**); frase chiara e actionable.
7. **summary**: calcolare healthScore e badge con la formula in **SEVERITY-AND-SCORE.md**.

Validazione backend: presenza di `auditType`, `version`, `summary`, `issues`; per ogni issue: `id`, `categoryId`, `msg`, `severity`, `layerId`, `fix`; `categoryId` e `severity` nei set ammessi.
