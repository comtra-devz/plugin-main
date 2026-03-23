# Design System Audit — Schema JSON di output

L’agente DS Audit deve restituire un unico JSON valido. Nessun testo prima o dopo; se necessario, il payload può essere racchiuso in un blocco markdown ```json ... ``` per essere estratto dal backend.

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

Ogni elemento di `issues` deve rispettare questo schema:

| Campo | Tipo | Obbligatorio | Descrizione |
|-------|------|--------------|-------------|
| id | string | Sì | Identificativo univoco (es. UUID, o "ds-1", "ds-2"). Non deve ripetersi nella risposta. |
| categoryId | string | Sì | Una di: `adoption`, `coverage`, `naming`, `structure`, `consistency`, `copy`, `optimization`. |
| msg | string | Sì | Messaggio breve per l’utente (es. "Hardcoded Hex in fill"). |
| severity | string | Sì | Esattamente uno di: `HIGH`, `MED`, `LOW`. |
| layerId | string | Sì | `id` del nodo nel documento (es. "12:3456"). Usare l’id reale dal JSON quando disponibile. |
| layerIds | string[] | No | Se l’issue riguarda più nodi (es. set di istanze o componenti da unire). |
| fix | string | Sì | Suggerimento di fix (es. "Use var(--primary)" o "Merge into one with slot LeftIcon"). |
| tokenPath | string | No | Path del token suggerito (es. "sys.color.primary.500"). |
| pageName | string | No | Nome della pagina/canvas per contesto (es. "Home_Desktop"). |
| rule_id | string | No | ID regola (es. "DS-2.1", "DS-OPT-1") per auto-fix e crediti. |
| recommendation | boolean | No | Se `true`, è una raccomandazione di ottimizzazione. |
| optimizationPayload | object | No | Solo per `categoryId: "optimization"`. Vedi sotto. |
| autoFixAvailable | boolean | No | Se `true`, il plugin può applicare un auto-fix. |

---

## Esempio completo di risposta

```json
{
  "issues": [
    {
      "id": "ds-1",
      "categoryId": "coverage",
      "msg": "Hardcoded Hex in fill",
      "severity": "HIGH",
      "layerId": "12:3456",
      "fix": "Use semantic variable sys.color.primary.500",
      "tokenPath": "sys.color.primary.500",
      "pageName": "Home_Desktop"
    },
    {
      "id": "ds-2",
      "categoryId": "naming",
      "msg": "Generic layer name \"Frame 89\"",
      "severity": "MED",
      "layerId": "12:3457",
      "fix": "Rename to semantic name e.g. Card_Container or CTA_Wrapper",
      "pageName": "Design_System"
    },
    {
      "id": "ds-3",
      "categoryId": "adoption",
      "msg": "Detached instance: overrides differ from main component",
      "severity": "HIGH",
      "layerId": "12:3458",
      "layerIds": ["12:3458", "12:3459", "12:3460"],
      "fix": "Reattach to main or create variant Button/Small and apply to all",
      "pageName": "Checkout_Flow"
    }
  ]
}
```

---

## Regole per l’agente

1. Restituire **solo** il JSON sopra, senza prefisso/suffisso (o un unico blocco ```json ... ```).
2. **id**: univoci nella risposta; formato libero ma stabile (es. "ds-1", "ds-2" o UUID).
3. **layerId**: deve essere l’`id` reale del nodo nel documento quando possibile; altrimenti descrivere nel msg.
4. **severity**: rispettare le indicazioni di DS-AUDIT-RULES.md; in dubbio usare `MED`.
5. **categoryId**: solo i valori ammessi nella tabella; nessun valore custom.
6. **fix**: sempre in inglese (o lingua concordata); frase chiara e actionable.
7. Ordinamento: opzionale per severity (HIGH prima) o per categoryId; non obbligatorio.

---

## Validazione lato backend

Il backend Comtra può validare:

- Presenza di `issues` (array).
- Per ogni elemento: `id`, `categoryId`, `msg`, `severity`, `layerId`, `fix` presenti.
- `categoryId` in `['adoption','coverage','naming','structure','consistency','copy','optimization']`.
- `severity` in `['HIGH','MED','LOW']`.

Campi mancanti opzionali (`layerIds`, `tokenPath`, `pageName`, `rule_id`, `recommendation`, `optimizationPayload`, `autoFixAvailable`) possono essere lasciati undefined o null; il frontend li gestisce come opzionali.

---

## optimizationPayload (solo per categoryId: optimization)

Quando `categoryId` è `optimization`, l'agente può includere un oggetto `optimizationPayload` con suggerimenti strutturati:

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| componentIdsToMerge | string[] | Id dei componenti da unire (es. Atom-accordion-macro, General-accordion). |
| suggestedSlots | string[] | Nomi suggeriti per slot (es. "LeftIcon", "RightActions", "Label"). |
| suggestedTokens | string[] | Path token da creare (es. "accordion.header.bg.default", "accordion.header.bg.section"). |
| suggestedVariants | object | Assi di variante suggeriti: `{ "Background": ["Light", "Dark"], "LeftContent": ["None", "Radio", "Icon"] }`. |

Esempio:

```json
{
  "id": "ds-opt-1",
  "categoryId": "optimization",
  "msg": "Merge accordion families: Atom-accordion-macro and General-accordion share structure",
  "severity": "MED",
  "layerId": "12:3456",
  "layerIds": ["12:3456", "12:3457", "12:3458"],
  "fix": "Merge into one AccordionHeader: add slot LeftIcon, variant Background=Light|Dark, extract token accordion.header.bg",
  "rule_id": "DS-OPT-2",
  "recommendation": true,
  "autoFixAvailable": false,
  "optimizationPayload": {
    "componentIdsToMerge": ["12:3456", "12:3457"],
    "suggestedSlots": ["LeftIcon", "RightActions"],
    "suggestedTokens": ["accordion.header.bg.default", "accordion.header.bg.section"],
    "suggestedVariants": { "Background": ["Light", "Dark"], "LeftContent": ["None", "Radio", "Icon"] }
  },
  "pageName": "Components"
}
```
