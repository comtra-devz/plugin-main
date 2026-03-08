# Prototype Audit — Ruleset e specifiche

Audit delle **connessioni, interazioni, flussi, animazioni e variabili** del prototipo in Figma Design. Riferimento: **COMTRA_Prototype_Audit_Ruleset_v1.pdf** (Comtra by Ben & Cordiska, March 2026).

---

## Scope

- **In scope:** solo **Figma Design** prototyping. Dati letti via Plugin API: `reactions`, `overflowDirection`, `overlayPositionType`, `overlayBackground`, ecc.
- **Fuori scope:** Figma Make (prototipo generato da AI), Figma Sites, tool di prototipazione di terze parti.

L’audit è **statico**: analizza il grafo delle connessioni e le impostazioni di transizione/overlay/variabili. Non simula l’esecuzione in presentation mode.

---

## AI vs deterministico

- **Core audit (20 regole P-01–P-20):** **deterministico, senza AI.** Tutte le regole sono implementabili in-plugin con traversale del nodo, grafo degli `destinationId`, e controlli su trigger, transition, variabili, conditionals. Questo garantisce risultati ripetibili e nessun allucinazione.
- **Vantaggio rispetto a “crea prototipo automatico” di Figma:** quel tool *genera* un prototipo da design statico; noi *auditiamo* un prototipo già esistente (correttezza, dead-end, back nav, Smart Animate, variabili, ecc.). Dominio diverso; la nostra proposta di valore è **precisione** (frame esatti, rule ID, suggested fix dal ruleset).
- **Uso opzionale di AI:** solo per **consigli narrativi** basati sulla ricerca utente (effort vs fidelity, quando semplificare, “sweet spot”): es. “Il prototipo usa variabili/condizioni in N punti; valuta se questo livello di fedeltà è necessario per gli obiettivi del test.” Tali consigli possono essere un blocco “Prototype health tips” generato a partire dal summary dell’audit + **EFFORT-VS-FIDELITY.md**.

---

## Contenuto della cartella

| File | Contenuto |
|------|-----------|
| **PROTOTYPE-AUDIT-RULES.md** | Tabella 20 regole P-01–P-20: nome, severity, categoria, logica di detection, suggested fix. |
| **OUTPUT-SCHEMA.md** | Schema JSON (finding, summary, health score) e mappatura su `AuditIssue` del plugin. |
| **SEVERITY-AND-SCORE.md** | Punti per severity (Critical 8, High 5, Medium 3, Low 1), cap per regola, livelli advisory (Healthy / Needs Attention / At Risk / Critical). |
| **TYPES-AND-CATEGORIES.md** | `categoryId` per UI, severity, colori. |
| **EFFORT-VS-FIDELITY.md** | Consigli basati su ricerca: quando usare prototipazione avanzata, quando preferire flussi lineari, trade-off effort/fedeltà. |
| **AGENT-DIRECTIVES.md** | (Opzionale) Tono e linee guida per eventuali tips AI. |

---

## Regole (ID e categorie UI)

| ID | Nome | Severity | categoryId (UI) |
|----|------|----------|-----------------|
| P-01 | Dead-End Detection | Critical | flow-integrity |
| P-02 | Orphan Frame Detection | Critical | flow-integrity |
| P-03 | Flow Starting Point Validation | Critical | flow-integrity |
| P-04 | Broken Destination Reference | Critical | flow-integrity |
| P-05 | Missing Back Navigation | High | navigation-coverage |
| P-06 | Unreachable Frame Detection | High | navigation-coverage |
| P-07 | Circular Loop Detection | High | navigation-coverage |
| P-08 | Interaction Trigger Consistency | High | interaction-quality |
| P-09 | Smart Animate Layer Matching | High | interaction-quality |
| P-10 | Animation Duration Boundaries | Medium | interaction-quality |
| P-11 | Easing Consistency | Medium | interaction-quality |
| P-12 | Overlay Configuration Completeness | Medium | overlay-scroll |
| P-13 | Scroll Overflow Validation | Medium | overlay-scroll |
| P-14 | Interactive Component Completeness | High | component-advanced |
| P-15 | Variable Usage Validation | Medium | component-advanced |
| P-16 | Conditional Logic Integrity | Medium | component-advanced |
| P-17 | Multiple Actions Order Validation | Medium | component-advanced |
| P-18 | Flow Naming & Description | Low | documentation-coverage |
| P-19 | Hotspot Coverage Analysis | Medium | documentation-coverage |
| P-20 | Prototype Presentation Settings | Low | documentation-coverage |

---

## Implementazione

- **Plugin:** traversale da `figma.currentPage.children`, lettura `node.reactions`, costruzione grafo adjacency (source → destinationId). Un solo pass per grafo; riuso per tutte le regole. Performance: non bloccante (async/yield), cache per `getNodeById`, Smart Animate (P-09) limitato a profondità 5.
- **UI:** il tab Prototype può seguire il pattern del tab UX (scope: pagina corrente / elenco pagine, “Run Prototype Audit”, score, categorie, lista issue con rule_id P-NN, flowName se presente).

---

## Riferimenti

- COMTRA_Prototype_Audit_Ruleset_v1.pdf (interno Comtra)
- Figma Plugin API — Reaction, `reactions` property
- Figma Help — Prototyping, Variables, Conditionals, Smart Animate, Overlays, Scroll
