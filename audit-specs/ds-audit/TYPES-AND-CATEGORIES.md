# Design System Audit — Tipi e categorie (riferimento unico)

Documento di riferimento per **severity**, **categoryId** e label usate nel tab Design System. L’agente A11Y ha categorie proprie (vedi `audit-specs/a11y-audit/`).

---

## Severity (gravità)

Ogni issue ha esattamente una severity. Valori ammessi:

| Valore | Significato | Uso nell’UI |
|--------|-------------|-------------|
| **HIGH** | Problema critico: single source of truth, core UI, convenzioni fondamentali | Badge rosso/coral; conteggio “issue alte” |
| **MED** | Drift, ridondanza, manutenibilità | Badge giallo/medio |
| **LOW** | Minore, cosmetico | Badge verde/basso |

Fonte: `DS-AUDIT-RULES.md` (sezione Severity) e `OUTPUT-SCHEMA.md`.

---

## Categorie DS (categoryId)

Solo queste categorie appartengono al **Design System audit**. L’accessibilità (contrast, touch, focus, alt…) è nell’agente A11Y e nel tab A11Y, non qui.

| categoryId   | Label (UI)         | Descrizione breve |
|-------------|--------------------|-------------------|
| **adoption** | Adoption Rate     | Componenti vs layer staccati, orfani, duplicati, gruppi al posto di componenti |
| **coverage** | Token Coverage    | Variabili collegate vs valori hardcoded (colori, tipografia, spacing, radius, effetti) |
| **naming**   | Naming Accuracy   | Convenzioni nomi layer, componenti, varianti, pagine |
| **structure** | Structure         | Gerarchia e layout: ghost node, nesting, auto-layout, constraints |
| **consistency** | Consistency    | Griglia, spacing scale, type scale, line height |
| **copy**    | Copywriting       | Placeholder, terminologia, overflow/localizzazione |
| **optimization** | Optimization | Raccomandazioni: merge componenti, slot, token, varianti (sistemi più snelli) |

Non usare nel tab DS: **a11y**, **contrast**, **touch**, **focus**, **alt**, **semantics**, **color** (quelle sono per il tab Accessibility).

---

## Mappatura regola → categoryId

Come in `DS-AUDIT-RULES.md`:

- 1.1–1.5 → **adoption**
- 2.1–2.7 → **coverage**
- 3.1–3.4 → **naming**
- 4.1–4.5 → **structure**
- 5.1–5.4 → **consistency**
- 6.1–6.3 → **copy**
- 8.1–8.4 → **optimization**

---

## Riferimenti

- Regole e severity: `DS-AUDIT-RULES.md`
- Schema output: `OUTPUT-SCHEMA.md`
- A11Y categorie: `audit-specs/a11y-audit/A11Y-AUDIT-RULES.md`, `OUTPUT-SCHEMA.md`
