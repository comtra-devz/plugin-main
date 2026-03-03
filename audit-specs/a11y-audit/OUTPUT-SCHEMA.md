# Accessibility Audit — Schema JSON di output

L’agente A11Y restituisce lo **stesso formato** del DS Audit (`issues[]` compatibile con `AuditIssue`), con **categoryId** specifici per l’accessibilità. Il backend può estrarre il JSON dalla risposta Kimi (anche da blocco ```json ... ```) e mappare le issue al tipo `AuditIssue` del frontend.

---

## Formato radice

```json
{
  "issues": [ ... ]
}
```

- **issues** (array, obbligatorio): lista di issue. Array vuoto `[]` se non ci sono problemi.

---

## Oggetto issue (compatibile con `AuditIssue`)

| Campo     | Tipo    | Obbligatorio | Descrizione |
|-----------|---------|--------------|-------------|
| id        | string  | Sì           | Identificativo univoco (es. "a11y-1", "a11y-2"). |
| categoryId| string  | Sì           | Una di: `contrast`, `touch`, `focus`, `alt`, `semantics`, `color`. |
| msg       | string  | Sì           | Messaggio breve per l’utente (es. "Contrast ratio below WCAG AA"). |
| severity  | string  | Sì           | Esattamente uno di: `HIGH`, `MED`, `LOW`. |
| layerId   | string  | Sì           | `id` del nodo nel documento Figma (es. "12:3456"). |
| layerIds  | string[]| No           | Se l’issue riguarda più nodi (es. coppia testo/sfondo). |
| fix       | string  | Sì           | Suggerimento di fix testuale. |
| tokenPath | string | No           | Se applicabile (es. token colore con contrasto documentato). |
| pageName  | string  | No           | Nome pagina/canvas per contesto. |

---

## Esempio completo

```json
{
  "issues": [
    {
      "id": "a11y-1",
      "categoryId": "contrast",
      "msg": "Text contrast ratio 3.2:1 — below WCAG AA (4.5:1)",
      "severity": "MED",
      "layerId": "12:3456",
      "fix": "Use a darker text color or lighter background to reach at least 4.5:1",
      "pageName": "Login"
    },
    {
      "id": "a11y-2",
      "categoryId": "touch",
      "msg": "Touch target 32×32 pt — below 44×44 pt minimum",
      "severity": "HIGH",
      "layerId": "12:3457",
      "fix": "Increase hit area to at least 44×44 pt (padding or larger component)",
      "pageName": "Settings"
    },
    {
      "id": "a11y-3",
      "categoryId": "alt",
      "msg": "Icon with generic name \"Icon\" — add description for screen readers",
      "severity": "MED",
      "layerId": "12:3458",
      "fix": "Rename layer or add description (e.g. \"Close dialog\", \"Submit form\")",
      "pageName": "Modal"
    }
  ]
}
```

---

## Regole per l’agente

1. Restituire **solo** il JSON sopra, senza prefisso/suffisso (o un unico blocco ```json ... ```).
2. **id:** univoci nella risposta; prefisso consigliato `a11y-` (es. `a11y-1`, `a11y-2`).
3. **categoryId:** usare **solo** i valori: `contrast`, `touch`, `focus`, `alt`, `semantics`, `color`.
4. **severity:** solo `HIGH`, `MED`, `LOW`.
5. **layerId:** usare l’`id` reale del nodo dal JSON Figma quando disponibile.

Riferimento regole complete: **A11Y-AUDIT-RULES.md**. Piano Kimi + API gratuite: **docs/A11Y-AUDIT-PLAN.md**.
