# Accessibility Audit — Regole

Regole per l’agente A11Y: cosa controllare sul **JSON del file Figma**, come ricavare i dati, severity e fix. L’agente usa **Kimi** per euristiche e report; il backend può pre-calcolare contrast ratio e touch size e passare i risultati come contesto. Sul **codice generato** Comtra usa la stack **axe-core + HTML_CodeSniffer + Lighthouse** (tre layer, open source) e la **verifica metodo colore OKLCH**. Vedi **docs/A11Y-AUDIT-PLAN.md**.

---

## 1. Contrasto (WCAG)

**Obiettivo:** testo e elementi critici devono rispettare il rapporto di contrasto WCAG AA (4.5:1 testo normale, 3:1 testo grande) o AAA (7:1 / 4.5:1).

**Dove nel JSON:**
- Nodi con `type: "TEXT"`: colore da `fills` (o stile testo). Sfondo: `fills` del nodo stesso o del parent (frame/rettangolo sotto).
- Colori in `fills`: formato `#RRGGBB`, `rgba(r,g,b,a)` o riferimenti a variabili. Per il calcolo servono valori assoluti (hex/rgba).

**Come ricavarlo:**
- **Backend (consigliato):** calcolo deterministico da hex/rgba: luminance, ratio. Nessuna API esterna necessaria (formule WCAG standard).
- **Kimi:** se il backend invia già i ratio per coppie testo/sfondo, Kimi può segnalare le issue e suggerire fix (es. “Usa token con contrasto ≥ 4.5:1”).

**Severity:** `HIGH` se contrasto < 3:1 (illeggibile); `MED` se tra 3:1 e 4.5:1 (AA non rispettato); `LOW` se tra 4.5:1 e 7:1 (AA ok, AAA no).

**Fix esempio:** “Increase contrast to at least 4.5:1 (WCAG AA) or use semantic token with documented contrast.”

**categoryId:** `contrast`.

---

## 2. Touch target (area cliccabile)

**Obiettivo:** elementi interattivi (bottoni, link, icone cliccabili) con area minima tipica **44×44 px** (Apple HIG, Material).

**Dove nel JSON:**
- `absoluteBoundingBox`: `{ x, y, width, height }` per ogni nodo. Confrontare con soglia (es. `min(width, height) >= 44`).

**Come ricavarlo:**
- **Backend:** lettura diretta da `absoluteBoundingBox`; nessuna API esterna.
- **Kimi:** può ricevere dal backend un elenco di nodi “sotto soglia” e produrre messaggi e fix (es. “Increase touch target to at least 44×44 pt”).

**Severity:** `HIGH` se elemento probabilmente interattivo (nome/ruolo) e area < 44×44; `MED` se area tra 44 e 48; `LOW` per suggerimenti di miglioramento.

**Fix esempio:** “Ensure touch target is at least 44×44 pt. Add padding or use a larger hit area.”

**categoryId:** `touch`.

---

## 3. Focus (stati focus)

**Obiettivo:** componenti interattivi dovrebbero avere uno stato focus visibile (outline, border, shadow) per navigazione da tastiera.

**Dove nel JSON:**
- Componenti e varianti: `componentProperties`, nomi layer (es. “Button”, “Focus”, “Default”). Cercare varianti o layer con nome che indica focus/hover.
- Non esiste un campo “focus” nativo; euristiche su naming e presenza di più stati per lo stesso componente.

**Come ricavarlo:** principalmente **Kimi** (euristiche su nomi e struttura). Backend può segnalare componenti con una sola variante (mancanza stato focus).

**Severity:** `MED` se componente interattivo senza variante focus; `LOW` se solo suggerimento.

**Fix esempio:** “Add a visible focus state (e.g. outline or ring) for keyboard navigation.”

**categoryId:** `focus`.

---

## 4. Alt text / descrizioni

**Obiettivo:** immagini e icone decorative o informative devono avere una descrizione (per screen reader). In Figma si può usare la descrizione del layer o un nome semantico.

**Dove nel JSON:**
- `name` del nodo: nomi generici (“Rectangle”, “Icon”, “Image”) senza contesto.
- Nodi con export immagine, icone, illustrazioni: assenza di descrizione testuale nel nome o in metadati (se presenti).

**Come ricavarlo:** **Kimi** analizza nomi e tipo nodo; può segnalare “Icon/Image with generic name — add description for screen readers”.

**Severity:** `HIGH` se elemento probabilmente informativo e nome vuoto/generico; `MED` se nome poco descrittivo; `LOW` se migliorabile.

**Fix esempio:** “Provide a short description (alt text) for this image/icon so screen readers can announce it.”

**categoryId:** `alt`.

---

## 5. Semantica (heading, struttura)

**Obiettivo:** gerarchia heading (H1–H6), ordine logico, landmark. Nel design non c’è DOM; si usano euristiche su **nome layer**, **dimensione testo**, **posizione**.

**Dove nel JSON:**
- Nodi TEXT: `name`, `style` (fontSize, fontWeight), `absoluteBoundingBox`. Confrontare fontSize per ipotizzare livelli heading; nomi come “Title”, “Heading 1”.
- Ordine: struttura ad albero (children) e posizione (y) per suggerire ordine di lettura.

**Come ricavarlo:** **Kimi** (euristiche su testo, size, nomi). Backend può pre-calcolare una “mappa” fontSize → livello suggerito.

**Severity:** `MED` se heading mancante o ordine incoerente; `LOW` se solo migliorabile.

**Fix esempio:** “Use a clear heading hierarchy (e.g. one H1 per page) and semantic names for sections.”

**categoryId:** `semantics`.

---

## 6. Colore (solo colore per informazione; daltonismo)

**Obiettivo:** non affidare l’informazione al solo colore; verificare che stati/errori/successi siano distinguibili anche senza colore. Opzionale: simulazione deuteranopia/protanopia.

**Dove nel JSON:**
- `fills`, variabili colore, nomi layer che indicano stati (“Error”, “Success”, “Disabled”). Se due stati differiscono solo per colore (stesso testo/icona), segnalare.

**Come ricavarlo:**
- **Kimi:** confronto tra varianti (stesso componente, solo colore diverso).
- **API/librerie gratuite (opzionale):** trasformazione colore per simulazione daltonismo; risultato passato a Kimi o usato dal backend per flag “low distinction”.

**Severity:** `MED` se informazione critica solo a colore; `LOW` per suggerimenti.

**Fix esempio:** “Add icon, label or pattern in addition to color so information is clear for color-blind users.”

**categoryId:** `color`.

---

## 7. OKLCH (metodo colore)

**Obiettivo:** incentivare l’uso dello spazio colore **OKLCH** (percepibilmente uniforme, allineato a CSS Color Module Level 4) e verificare contrasto/accessibilità in OKLCH quando i colori sono espressi in OKLCH.

**Dove nel JSON / nel codice:**
- **Design:** `fills` in hex/rgba possono essere convertiti in OKLCH; verificare contrast ratio (dopo conversione) e segnalare dove sarebbe preferibile usare token in OKLCH.
- **Codice (post–Code Agent):** parsing CSS: rilevare `oklch(...)` vs `hex`/`rgb()`; verificare contrasto per coppie testo/sfondo in OKLCH.

**Come ricavarlo:** backend con librerie JS per conversione hex/sRGB ↔ OKLCH e per contrast ratio. Vedi **docs/A11Y-AUDIT-PLAN.md** (§ 8).

**Severity:** `LOW` per “prefer OKLCH”; `MED`/`HIGH` se il contrasto in OKLCH è sotto soglia WCAG.

**Fix esempio:** “Use OKLCH for this token (e.g. oklch(0.65 0.15 250)) and ensure contrast ≥ 4.5:1.”

**categoryId:** `color` (o sottocategoria dedicata se si estende lo schema).

---

## Riepilogo categoryId

| categoryId   | Contenuto principale |
|-------------|----------------------|
| `contrast`  | Contrast ratio testo/sfondo (WCAG) |
| `touch`     | Dimensione area cliccabile (44×44 pt) |
| `focus`     | Stato focus visibile per tastiera |
| `alt`       | Testo alternativo per immagini/icone |
| `semantics` | Heading, struttura, ordine lettura |
| `color`     | Uso del solo colore; daltonismo |

---

## Note su stack codice e OKLCH

- **Tre layer su codice generato (open source, zero costi):** **axe-core** (engine primario sul DOM), **HTML_CodeSniffer** (verifica statica HTML), **Lighthouse** (punteggio sintetico nel report finale). Si usano sul codice generato dal Code Agent o su HTML/URL fornito; non sul file Figma. Dettaglio in **docs/A11Y-AUDIT-PLAN.md** (§ 7).
- **OKLCH:** sistema di verifica del metodo colore OKLCH (contrasto e preferenza OKLCH per token/modern CSS). Design: conversione hex→OKLCH + ratio; Codice: parsing CSS OKLCH. Vedi **docs/A11Y-AUDIT-PLAN.md** (§ 8).
- Sul **file Figma** (JSON) le regole sopra restano “WCAG-like” (Kimi + calcoli backend); axe/CodeSniffer/Lighthouse e OKLCH su codice completano il quadro.
