# Accessibility Audit — Lista tipologie di issue

Elenco di **tutte le tipologie di issue** che possono essere prodotte dall’audit A11Y (design, engine in `a11y-audit-engine.mjs`). Per ogni voce: categoryId, messaggio (pattern), severity, condizione e fix tipico.

---

## 1. Contrast (categoryId: `contrast`)

| # | Messaggio (pattern) | Severity | Quando | Fix tipico |
|---|---------------------|----------|--------|------------|
| 1.1 | `Contrast fail X.X:1` | HIGH | Contrast ratio &lt; 3:1 (testo illeggibile) | Darker text or lighter background (min 3:1, aim 4.5:1). |
| 1.2 | `Contrast X.X:1 — below WCAG AA (4.5:1)` | MED | Contrast ratio tra 3:1 e 4.5:1 | Increase contrast to at least 4.5:1 (WCAG AA) or use semantic token. |

*Nota:* le issue di contrasto sono emesse solo per nodi TEXT con fill solido e sfondo ricavabile dagli antenati; sopra 4.5:1 non si segnala.

---

## 2. Touch target (categoryId: `touch`)

| # | Messaggio (pattern) | Severity | Quando | Fix tipico |
|---|---------------------|----------|--------|------------|
| 2.1 | `Touch target N×M pt — below 44×44 pt minimum` | HIGH | Elemento probabilmente interattivo (nome o tipo COMPONENT/INSTANCE) e min(larghezza, altezza) &lt; 44 pt | Ensure touch target is at least 44×44 pt. Add padding or larger hit area. |
| 2.2 | `Touch target N pt — below 44×44 pt minimum` | MED | Come sopra ma min side tra 44 e 48 pt | Come sopra. |
| 2.3 | `Touch target N pt — consider 48 pt for comfort` | MED | Elemento interattivo, 44 ≤ min &lt; 48 | Consider 48 pt for comfort. |
| 2.4 | (stesso messaggio di 2.1/2.2) | LOW | Nodo non classificato come interattivo ma min side &lt; 44 | Add padding or use a larger hit area. |

*Nomi considerati interattivi:* button, btn, link, icon, cta, submit, toggle, tab, menu, dropdown (regex in engine).

---

## 3. Focus (categoryId: `focus`)

| # | Messaggio (pattern) | Severity | Quando | Fix tipico |
|---|---------------------|----------|--------|------------|
| 3.1 | `Missing :focus state` | MED | Componente (o component set) con nome interattivo senza variante il cui nome contenga "focus", "focused" o "keyboard" | Add a visible focus state (e.g. outline or ring) for keyboard navigation. |

---

## 4. Alt text (categoryId: `alt`)

| # | Messaggio (pattern) | Severity | Quando | Fix tipico |
|---|---------------------|----------|--------|------------|
| 4.1 | `Icon/asset with generic name "…" — add description for screen readers` | MED | Nodo (non TEXT) con nome generico: Icon, Image, Img, Rectangle, Rect, Shape, Vector, Group, Frame; oppure nome molto breve (≤2 caratteri) | Rename layer or add description (e.g. "Close dialog", "Submit form"). |
| 4.2 | (stesso messaggio con nome meno generico) | LOW | Nome in lista generici ma più descrittivo (es. "Icon_arrow") | Come sopra. |

---

## 5. Semantics (categoryId: `semantics`)

| # | Messaggio (pattern) | Severity | Quando | Fix tipico |
|---|---------------------|----------|--------|------------|
| 5.1 | `No clear heading hierarchy — consider semantic names (e.g. Heading 1, Title)` | LOW | Pagina con almeno 3 nodi TEXT, nessuno con nome tipo "heading", "title", "h1", "h2", "h3" | Use a clear heading hierarchy (e.g. one H1 per page) and semantic names for sections. |

---

## 6. Color (categoryId: `color`)

| # | Messaggio (pattern) | Severity | Quando | Fix tipico |
|---|---------------------|----------|--------|------------|
| 6.1 | `States may differ only by color — add icon or label for color-blind users` | MED | COMPONENT_SET con nome che richiama stati/varianti (state, variant, error, success, disabled, default) e figli che differiscono solo per fill | Add icon, label or pattern in addition to color so information is clear for color-blind users. |
| 6.2 | `File uses RGB/hex fills — consider OKLCH tokens for modern CSS and perceptual consistency` | LOW | File con almeno un nodo con fill solido (una sola issue per file, riferita alla prima pagina) | Use OKLCH for this token (e.g. oklch(0.65 0.15 250)) and ensure contrast ≥ 4.5:1. |

---

## Riepilogo per categoryId

| categoryId   | Tipologie (numero) | Severity possibili |
|-------------|--------------------|---------------------|
| contrast    | 2 (1.1, 1.2)       | HIGH, MED           |
| touch       | 4 (2.1–2.4)        | HIGH, MED, LOW      |
| focus       | 1 (3.1)            | MED                 |
| alt         | 2 (4.1, 4.2)       | MED, LOW            |
| semantics   | 1 (5.1)            | LOW                 |
| color       | 2 (6.1, 6.2)       | MED, LOW            |

---

## Estensioni future (non ancora in engine)

- **Layer su codice (HTML):** axe-core, HTML_CodeSniffer, Lighthouse produrranno issue con categoryId mappabili (es. `aria`, `semantics`, `contrast` su DOM). La lista delle tipologie andrà estesa con i rule id di axe e i principi WCAG di CodeSniffer.
- **OKLCH su codice:** parsing CSS per `oklch()` vs hex/rgb e contrasto in OKLCH → nuove tipologie sotto `color` o sottocategoria dedicata.
