# Prototype Audit — Schema JSON di output

L’audit restituisce un JSON strutturato allineato al COMTRA_Prototype_Audit_Ruleset_v1.pdf. Il plugin può eseguire l’audit in-plugin (deterministico) e produrre questo formato; oppure un backend può validare/arricchire.

**Mappatura su `AuditIssue` (frontend):**
- `id` → P-NN-NNN (es. P-01-001, istanza della regola)
- `rule_id` → P-NN (es. P-01)
- `categoryId` → flow-integrity | navigation-coverage | interaction-quality | overlay-scroll | component-advanced | documentation-coverage
- `msg` ← `description`
- `severity` → HIGH | MED | LOW (Critical nel PDF è mappato a HIGH per il tipo AuditIssue)
- `layerId` ← `nodeId`
- `layerIds` ← opzionale, se più nodi
- `fix` ← `suggestedFix`
- `pageName` ← opzionale
- `flowName` ← opzionale (nome del flusso)
- `nodeName` ← opzionale (nome nodo Figma)
- `autoFixAvailable` ← boolean

---

## Formato radice

```json
{
  "auditType": "prototype",
  "version": "1.0",
  "fileId": "",
  "pageName": "",
  "timestamp": "2026-03-08T14:30:00Z",
  "healthScore": 72,
  "advisoryLevel": "needs_attention",
  "summary": { ... },
  "findings": [ ... ],
  "metadata": { ... }
}
```

- **auditType:** `"prototype"`.
- **version:** ruleset version, es. `"1.0"`.
- **fileId,** **pageName,** **timestamp:** contesto file/pagina e data audit.
- **healthScore:** 0–100 (formula in SEVERITY-AND-SCORE.md).
- **advisoryLevel:** `healthy` | `needs_attention` | `at_risk` | `critical`.
- **summary:** totalFlows, totalFrames, totalConnections, totalInteractions, totalVariables, totalFindings, critical, high, medium, low.
- **findings:** array di finding (issue).
- **metadata:** generator, version, engine (es. "Prototype Audit Plugin").

---

## Summary

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| totalFlows | number | Flussi sulla pagina |
| totalFrames | number | Frame top-level |
| totalConnections | number | Connessioni (reactions con destinationId) |
| totalInteractions | number | Totale reactions |
| totalVariables | number | Variabili usate nel prototipo |
| totalFindings | number | Numero totale issue |
| critical | number | Conteggio Critical (trattati come HIGH nel payload) |
| high | number | Conteggio High |
| medium | number | Conteggio Medium |
| low | number | Conteggio Low |

---

## Oggetto finding (compatibile con AuditIssue)

| Campo | Tipo | Obbligatorio | Descrizione |
|-------|------|--------------|-------------|
| id | string | Sì | Identificativo univoco: P-NN-NNN (es. P-01-001). |
| ruleId | string | Sì | Regola: P-01 … P-20. |
| category | string | Sì | flow-integrity, navigation-coverage, interaction-quality, overlay-scroll, component-advanced, documentation-coverage. |
| severity | string | Sì | critical | high | medium | low. Per plugin usare HIGH | MED | LOW (critical → HIGH). |
| nodeId | string | Sì | ID nodo Figma (layerId nel plugin). |
| nodeName | string | No | Nome del nodo. |
| flowName | string | No | Nome del flusso coinvolto. |
| description | string | Sì | Messaggio per l’utente (msg nel plugin). |
| context | object | No | Dati aggiuntivi (es. incomingConnections, outgoingConnections, hasBackAction). |
| suggestedFix | string | Sì | Suggerimento (fix nel plugin). |
| autoFixAvailable | boolean | No | Default false. |

---

## Esempio completo

```json
{
  "auditType": "prototype",
  "version": "1.0",
  "pageName": "Mobile App",
  "healthScore": 72,
  "advisoryLevel": "needs_attention",
  "summary": {
    "totalFlows": 4,
    "totalFrames": 28,
    "totalConnections": 45,
    "totalInteractions": 89,
    "totalVariables": 6,
    "totalFindings": 12,
    "critical": 1,
    "high": 3,
    "medium": 5,
    "low": 3
  },
  "findings": [
    {
      "id": "P-01-001",
      "ruleId": "P-01",
      "category": "flow-integrity",
      "severity": "high",
      "nodeId": "4:1539",
      "nodeName": "Order Confirmation",
      "flowName": "Checkout Flow",
      "description": "Dead-end frame: no outgoing connections or Back actions",
      "context": {
        "incomingConnections": 2,
        "outgoingConnections": 0,
        "hasBackAction": false
      },
      "suggestedFix": "Add a Back action or Navigate to action to return to previous screen",
      "autoFixAvailable": false
    }
  ],
  "metadata": {
    "generator": "COMTRA by Ben & Cordiska",
    "version": "1.0",
    "engine": "Prototype Audit Plugin"
  }
}
```

---

## Regole per l’engine (plugin o backend)

1. **id** finding: formato P-NN-NNN, con NNN progressivo per regola.
2. **ruleId:** sempre P-01 … P-20.
3. **category:** solo i 6 categoryId definiti in TYPES-AND-CATEGORIES.md.
4. **severity:** rispettare la severity della regola; critical → HIGH nel payload per AuditIssue.
5. **nodeId:** id reale dal grafo Figma.
6. **description / suggestedFix:** tono costruttivo, actionable (vedi AGENT-DIRECTIVES.md se si usano tips AI).
7. **healthScore / advisoryLevel:** calcolo come in SEVERITY-AND-SCORE.md.
