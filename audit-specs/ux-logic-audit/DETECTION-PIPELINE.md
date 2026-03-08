# UX Logic Audit — Pipeline di detection

L’agente processa il file Figma attraverso una **pipeline a 5 fasi**. Ogni fase costruisce sul risultato della precedente.

**Input ammesso:** solo il **node tree** (Figma REST API): frame, componenti, varianti, testo, auto-layout, constraints — cioè il **design statico**.  
**Input escluso:** prototype connections, transitions, interaction triggers. Questo audit è sulla **UX** (cosa è progettato), non su “dove porta un click”.

---

## Phase 1: Node Classification

- **Input:** albero dei nodi del file (e opzionalmente delle library referenziate).
- **Azione:** classificare ogni nodo in una o più tipologie:
  - **INTERACTIVE** — pulsanti, link, input, toggle
  - **CONTAINER** — frame, sezioni, card, modal
  - **NAVIGATION** — navbar, sidebar, tab, breadcrumb
  - **CONTENT** — testo, immagini, icone
  - **FEEDBACK** — loader, toast, alert, banner
  - **FORM** — gruppi di input, fieldset
  - **TABLE** — data grid, list view, pattern di righe ripetute
- **Output:** mappa o struttura che permette alle fasi successive di applicare le regole per categoria (es. cercare solo negli INTERACTIVE per UXL-001, solo nei FORM per UXL-012).

La classificazione usa nomi dei nodi, tipo (FRAME, COMPONENT_SET, INSTANCE, TEXT, ecc.), e contesto (parent/children).

---

## Phase 2: Component Variant Audit

- **Input:** nodi classificati come COMPONENT_SET (e INSTANCE che referenziano componenti).
- **Azione:** per ogni COMPONENT_SET, enumerare le varianti (nomi, property keys/values). Confrontare con la **STATE-MATRIX** (STATE-MATRIX.md): Minimum / Expected / Ideal.
- **Output:** lista di “missing states” per componente, da mappare su UXL-001, UXL-002, UXL-013, UXL-040, ecc.

---

## Phase 3: Content Analysis

- **Input:** tutti i nodi TEXT e contesto (label, error message, CTA, placeholder).
- **Azione:** estrarre e analizzare il testo:
  - qualità label (presente, required/optional)
  - completezza messaggi di errore (What + Why + Fix)
  - specificità CTA (vs generici Submit, OK)
  - jargon (null, exception, 404, …)
  - consistenza terminologica (Cart vs Basket)
  - pattern dark pattern (confirmshaming, urgency)
  - indicatori i18n (testo che riempie il container, date/valute hardcoded)
- **Output:** issue per UXL-012, UXL-016, UXL-026, UXL-027, UXL-029, UXL-056, UXL-059, UXL-061, UXL-063, ecc.

---

## Phase 4: Layout & Spatial Analysis

- **Input:** frame, auto-layout, constraints, dimensioni, spacing.
- **Azione:**
  - utilizzo auto-layout (UXL-045)
  - coerenza spacing (scale 4, 8, 12, 16, 24, 32, 48, 64) (UXL-046)
  - distribuzione larghezze frame → breakpoint (UXL-044)
  - gerarchia visiva (numero di dimensioni/peso testo) (UXL-050)
  - raggruppamento e prossimità (UXL-053)
  - allineamento in strutture tipo tabella (UXL-038)
  - header sticky in tabelle lunghe (UXL-041)
  - spazio per espansione testo (UXL-059, UXL-060)
- **Output:** issue per categorie responsive-layout, cognitive-load, data-tables, i18n.

---

## Phase 5: Cross-Rule Escalation

- **Input:** lista completa di issue (con id regola UXL-NNN, severity, nodeId, page).
- **Azione:** applicare le **ESCALATION-RULES** (ESCALATION-RULES.md): stessi form/page/componente, combinazioni UXL-012+013, UXL-001+002, 3+ MED stessa categoria, UXL-044+045, UXL-054+055, UXL-059+060 su >50% pagine.
- **Output:** calcolo UX Health Score (SEVERITY-AND-SCORE.md), badge, e array `escalations[]` per il report.

L’agente può implementare le fasi in un unico passaggio (Kimi) purché il risultato rispetti le regole e lo schema di output definiti in UX-LOGIC-AUDIT-RULES.md e OUTPUT-SCHEMA.md.
