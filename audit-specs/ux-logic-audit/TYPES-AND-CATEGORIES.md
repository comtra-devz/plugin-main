# UX Logic Audit — Tipi e categorie (riferimento UI)

Riferimento per **severity**, **categoryId** e badge usati nel tab UX Audit. Allineato a **SEVERITY-AND-SCORE.md** e **OUTPUT-SCHEMA.md**.

---

## Severity

| Valore | Colore (hex) | Significato |
|--------|--------------|-------------|
| **HIGH** | #D32F2F (Red) | Critical UX failure: blocca task o comprensione |
| **MED** | #F9A825 (Yellow) | Significant UX gap: degrada esperienza |
| **LOW** | #66BB6A (Green) | UX enhancement: opportunità di miglioramento |

---

## Categorie (categoryId)

Solo queste 11 categorie appartengono all’**UX Logic Audit**. Usare gli stessi `id` in **views/Audit/data.ts** (`UX_LOGIC_CATEGORIES_CONFIG`).

| categoryId | Label (UI) |
|------------|------------|
| system-feedback | System Feedback |
| interaction-safety | Interaction Safety |
| form-ux | Form UX |
| navigation-ia | Navigation & IA |
| content-copy | Content & Copy |
| error-handling | Error Handling & Empty States |
| data-tables | Data Tables & Lists |
| responsive-layout | Responsive & Layout |
| cognitive-load | Cognitive Load |
| dark-patterns | Dark Patterns & Ethics |
| i18n | Internationalization Readiness |

---

## UX Health Score e badge

- **Formula:** `100 - (HIGH×5 + MED×2 + LOW×1)` → 0–100.
- **Badge:** 90–100 EXCELLENT | 70–89 GOOD | 50–69 NEEDS WORK | 0–49 CRITICAL.

Vedi **SEVERITY-AND-SCORE.md** per dettagli e **data.ts** per `computeUxHealthScoreFromIssues`, `getUxScoreCopy`, `buildUxCategoriesFromIssues`.
