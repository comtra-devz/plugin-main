# Accessibility Audit — Tipi e categorie (riferimento unico)

Documento di riferimento per **severity**, **categoryId**, label e **tipologie di issue** del tab Accessibility. Modello allineato a **audit-specs/ds-audit/TYPES-AND-CATEGORIES.md**.

---

## Severity (gravità)

Ogni issue ha esattamente una severity. Valori ammessi:

| Valore | Significato | Uso nell’UI |
|--------|-------------|-------------|
| **HIGH** | Critico: illeggibilità, area touch insufficiente, rischio esclusione | Badge rosso; conteggio “issue alte” |
| **MED** | WCAG non rispettato o euristiche importanti (focus, alt, colore) | Badge giallo/medio |
| **LOW** | Miglioramento consigliato (gerarchia heading, OKLCH, comfort touch) | Badge verde/basso |

Fonte: **A11Y-AUDIT-RULES.md** e **OUTPUT-SCHEMA.md**.

---

## Categorie A11Y (categoryId)

Solo queste categorie appartengono al **tab Accessibility**. Non usare nel tab DS.

| categoryId   | Label (UI)        | Descrizione breve |
|-------------|-------------------|-------------------|
| **contrast**  | Contrast          | Contrast ratio testo/sfondo (WCAG AA 4.5:1, AAA 7:1) |
| **touch**     | Touch target      | Area cliccabile minima 44×44 pt (Apple HIG, Material) |
| **focus**     | Focus state       | Stato focus visibile per navigazione da tastiera |
| **alt**       | Alt text          | Descrizioni per icone/immagini (screen reader) |
| **semantics** | Semantics         | Gerarchia heading, nomi semantici, ordine lettura |
| **color**     | Color & OKLCH    | Informazione non solo a colore; uso OKLCH / token |

---

## Mappatura regola → categoryId

Come in **A11Y-AUDIT-RULES.md**:

- § 1 Contrasto (WCAG) → **contrast**
- § 2 Touch target → **touch**
- § 3 Focus (stati focus) → **focus**
- § 4 Alt text / descrizioni → **alt**
- § 5 Semantica (heading, struttura) → **semantics**
- § 6 Colore (solo colore per informazione; daltonismo) → **color**
- § 7 OKLCH (metodo colore) → **color** (stessa categoria, issue tipo “prefer OKLCH”)

---

## Riferimenti

- Regole e severity: **A11Y-AUDIT-RULES.md**
- Schema output: **OUTPUT-SCHEMA.md**
- Lista completa tipologie di issue: **ISSUE-TYPES.md**
- Engine (design): **auth-deploy/oauth-server/a11y-audit-engine.mjs**
