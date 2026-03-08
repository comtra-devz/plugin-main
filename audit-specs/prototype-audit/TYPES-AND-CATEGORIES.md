# Prototype Audit — Tipi e categorie (riferimento UI)

Riferimento per **severity**, **categoryId** e colori nel tab Prototype. Allineato a **SEVERITY-AND-SCORE.md** e **OUTPUT-SCHEMA.md**.

---

## Severity (plugin: HIGH | MED | LOW)

| Valore plugin | PDF / Score weight | Colore (suggerito) | Significato |
|---------------|--------------------|--------------------|-------------|
| **HIGH** | Critical o High (8 o 5 pt) | #D32F2F (Red) | Blocca o degrada fortemente il test (dead-end, broken link, no back, loop, Smart Animate rotto). |
| **MED** | Medium (3 pt) | #F9A825 (Yellow) | Qualità/completezza (duration, overlay, variabili, hotspot, ecc.). |
| **LOW** | Low (1 pt) | #66BB6A (Green) | Documentazione e configurazione (naming, presentation). |

---

## Categorie (categoryId)

Usare gli stessi `id` in **views/Audit/data.ts** (`PROTOTYPE_CATEGORIES_CONFIG`).

| categoryId | Label (UI) | Regole |
|------------|------------|--------|
| flow-integrity | Flow Integrity | P-01, P-02, P-03, P-04 |
| navigation-coverage | Navigation & Coverage | P-05, P-06, P-07 |
| interaction-quality | Interaction & Animation | P-08, P-09, P-10, P-11 |
| overlay-scroll | Overlay & Scroll | P-12, P-13 |
| component-advanced | Components & Advanced | P-14, P-15, P-16, P-17 |
| documentation-coverage | Documentation & Coverage | P-18, P-19, P-20 |

---

## Prototype Health Score e advisory level

- **Formula:** `max(0, 100 - (critical×8 + high×5 + medium×3 + low×1))`.
- **Advisory:** 80–100 Healthy | 50–79 Needs Attention | 26–49 At Risk | 0–25 Critical.

Vedi **SEVERITY-AND-SCORE.md** e **data.ts** per `computePrototypeHealthScoreFromIssues`, `getPrototypeScoreCopy`, `buildPrototypeCategoriesFromIssues`.
