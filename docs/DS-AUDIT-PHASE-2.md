# Design System audit — Fase 2 (roadmap)

Documento di tracciamento per migliorie oltre lo stato attuale (prompt Kimi + `resolveDsAuditIssuesFromSnapshot` + hint contesto library in UI).

## Fase 2 — backlog tecnico

### 1. Secondo fetch sul file della library pubblicata _(opzionale, rimandato)_

- **Problema:** Il JSON del file “consumer” che arriva dall’API Figma contiene in genere abbastanza per confrontare INSTANCE e master; in alcuni casi si potrebbe volere parità stretta con la **versione pubblicata** della team library (altro `file_key`).
- **Azione:** Prevedere una chiamata esplicita al file sorgente della library quando servono definizioni non presenti nell’export corrente (solo se emerge bisogno reale in produzione).
- **Stato:** non implementato di proposito nella fase corrente.

### 2. Motorino deterministico (INSTANCE ↔ main nel JSON)

- Walk sul `document`, per ogni `INSTANCE` risolvere `components[componentId]` e confrontare regole chiare (stili, `fillStyleId`, layout, ecc.).
- Output: issue generate o **validate/curate** le issue del modello (scarta o riformula falsi positivi).

### 3. Post-validazione dopo il modello _(Fase 1 parziale / rafforzabile)_

- Regole veloci in Node: vietare “detached” se `INSTANCE` + `componentId` valido; non segnalare hardcoded fill se c’è `fillStyleId`; riferimento main mancante → messaggio dedicato.

### 4. Hint “Contesto library” _(deploy backend + UI)_

- Euristica: nel JSON ci sono `INSTANCE` ma nessun componente con `remote: true` → l’audit usa solo definizioni nell’export (banner **Contesto library**).
- Nota: può essere vero anche per file DS **intenzionalmente** tutto locale; il copy resta morbido.

## “Metriche” (punto 5 della discussione roadmap)

In sintesi: **contare in backend** quante issue il modello propone e quante vengono **modificate, scartate o riscritte** dal post-process / dal motorino deterministico (es. log aggregato o campi `correctedFromLlm: true`).

- **A cosa serve:** capire se conviene spostare peso dal LLM al codice e dove il prompt fallisce più spesso.
- **Non è obbligatorio** per il funzionamento del prodotto; è strumento per priorità e qualità nel tempo.
