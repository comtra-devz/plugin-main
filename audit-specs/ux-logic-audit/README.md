# UX Logic Audit — Ruleset per l’agente Kimi

Specifiche per l’**UX Logic Audit Agent** (governato da AI — Kimi). Questo audit **non** si occupa delle connessioni del prototipo (link, hotspot, transizioni): quelle sono competenza del **Prototype Audit**. Qui si valuta la **UX** — qualità strutturale, informativa e comportamentale delle interfacce — su **design statico** (cosa è progettato: stati, label, feedback, copy, layout, pattern, etica, i18n).

**Riferimento ufficiale:** COMTRA_UX_Logic_Audit_Ruleset_v1.pdf (Comtra by Ben & Cordiska, v1.0 — March 2026).

---

## Scope — Focus UX, non prototipo

- **In scope (UX):** node tree Figma (frame, componenti, varianti, testo, auto-layout, constraints). Presenza e qualità di stati (loading, error, empty), label, messaggi di errore, CTAs, gerarchia, breadcrumb, modal con close, azioni distruttive con conferma, dark pattern, buffer i18n, ecc.
- **Fuori scope (Prototype Audit):** connessioni prototipo, “dove porta un click”, transizioni, dead-end di flusso, trigger di interazione. **L’agente non deve analizzare né segnalare issue basate su connessioni o flusso del prototipo.**

Regola pratica: se per valutare serve sapere **dove porta un click** → non è UX Logic Audit, è Prototype Audit.

---

## Contenuto della cartella

| File | Contenuto |
|------|-----------|
| **UX-LOGIC-AUDIT-RULES.md** | Matrice completa: 60 regole in 11 categorie, severity, logica di detection. |
| **OUTPUT-SCHEMA.md** | Schema JSON di risposta (issue card, summary, health score, paywall). |
| **SEVERITY-AND-SCORE.md** | Framework severity (HIGH/MED/LOW), formula UX Health Score, badge. |
| **ESCALATION-RULES.md** | Regole di escalation (combinazioni che aggravano la severity). |
| **STATE-MATRIX.md** | Matrice stati varianti per tipo di componente (min/expected/ideal). |
| **DETECTION-PIPELINE.md** | Architettura pipeline a 5 fasi. |
| **SOURCES.md** | Fonti (Nielsen, Baymard, NNGroup, Carbon, Material, ecc.). |
| **AGENT-DIRECTIVES.md** | Tono, soppressione falsi positivi, costo crediti. |

---

## Uso

- **Backend / Kimi:** costruzione del system prompt a partire da queste specifiche; validazione output secondo OUTPUT-SCHEMA.md.
- **Plugin:** visualizzazione issue con severity (rosso/giallo/verde), health score e badge (EXCELLENT / GOOD / NEEDS WORK / CRITICAL).
- **Manutenzione:** vedi **MAINTAINING-RULES.md** nella root di `audit-specs/`.

---

## Categorie (categoryId)

| ID | Nome | Heuristiche Nielsen |
|----|------|---------------------|
| system-feedback | System Feedback | H1 — Visibility of System Status |
| interaction-safety | Interaction Safety | H3, H5 — User Control & Freedom, Error Prevention |
| form-ux | Form UX | H5, H9 — Error Prevention, Help & Documentation |
| navigation-ia | Navigation & IA | H4 — Consistency & Standards |
| content-copy | Content & Copy | H2, H8 — Match Real World, Aesthetic Minimalism |
| error-handling | Error Handling & Empty States | H9 — Help Users with Errors |
| data-tables | Data Tables & Lists | H6, H7 — Recognition, Flexibility |
| responsive-layout | Responsive & Layout | H4, H7 — Consistency, Flexibility |
| cognitive-load | Cognitive Load | H6, H8 — Recognition, Minimalist Design |
| dark-patterns | Dark Patterns & Ethics | H5, H3 — Error Prevention, User Control |
| i18n | Internationalization Readiness | H4, H7 — Consistency, Flexibility |

---

## Identificativi regole

Le regole sono identificate da **UXL-NNN** (es. UXL-001, UXL-012). L’agente deve restituire tale `id` in ogni issue per tracciabilità e per eventuali escalation (vedi ESCALATION-RULES.md).
