# Design System Audit — Regole e specifica operativa

Standard di audit di livello enterprise per design system. Ogni regola è mappata sui dati del JSON del file (REST API) e definisce severity, dove cercare e esempio di fix.  
Riferimenti concettuali: token-first design, component API, naming (BEM/atomic), adoption e single source of truth.

**Fonti autorevoli:** le regole sono allineate a fonti citate in **SOURCES.md** (Design Systems 101, Design Systems 102, portali e guide). Link, sintesi e mappatura → **SOURCES.md**.

**Problematiche ricorrenti (community):** analisi di 100 thread (forum del tool, community, repository, governance, multi‑prodotto) → **RECURRING-PROBLEMS.md**. Scala severity community 1–5 (Nuisance → Bloccante); mapping: HIGH ≈ 4–5, MED ≈ 3, LOW ≈ 1–2. Le issue che segnalano rischio breakage (1.1, 1.5) e drift (1.3, 7.3) corrispondono ai problemi più citati e con tono più critico.

---

## Riferimento: library su cui si fa l’audit

L’audit va eseguito **rispetto alla library che l’utente sta controllando**. La library può essere:
- **nel file stesso** (componenti, variabili e stili definiti nel documento),
- **esterna al file** (library pubblicata/linkata, i cui componenti e stili sono referenziati nel file).

Scale, token, variabili e componenti da usare come **riferimento** (cosa è “corretto”, cosa è “fuori scale”, cosa è “hardcoded”) sono quelli **definiti in quella library**. Dove il JSON espone variabili/stili/componenti della library (o del file), usare quelli come fonte di verità; dove non è possibile inferire la scale, le regole forniscono criteri euristici.

**Scale e valori nelle regole:** tutti i numeri e le scale citate (es. 4, 8, 16, 24, 12px, 14px, type scale, spacing scale) sono **solo esempi**. Non vanno applicati come unici valori validi: l’implementazione deve preferire le scale e i token effettivamente presenti nel file o nella library collegata, quando rilevabili.

---

## Categorie di issue (categoryId)

| categoryId   | Descrizione breve |
|-------------|-------------------|
| `adoption`  | Uso corretto di componenti e library; istanze staccate, duplicati, orfani. |
| `coverage`  | Token e variabili: hardcoded vs bound, copertura, scale. |
| `naming`    | Convenzioni nomi layer, componenti, varianti, pagine. |
| `structure` | Gerarchia, ghost node, auto-layout, griglia, nesting. |
| `consistency`| Allineamento a griglia, spacing scale, radius, ombre. |
| `copy`      | Placeholder, terminologia, overflow, localizzazione. |

---

## 1. Adoption (componenti e library)

### 1.1 Istanza staccata / Detached instance

**Descrizione:** Un’istanza di componente è stata modificata (override) e non è più allineata al main component. Rompe la single source of truth.

**Dove nel JSON del file:**
- Nodi con `type: "INSTANCE"` e `componentId`.
- Confrontare proprietà del nodo (es. `fills`, `strokes`, `layoutMode`, `paddingLeft`, ecc.) con il main component (cercare in `components` o nel tree il nodo con quell’`id` come definizione).
- Se l’istanza ha override significativi rispetto al main (colori, dimensioni, testo, visibilità figli) → considerare “detached” o “deviation”.

**Severity:** HIGH (impatto su manutenzione e consistenza).

**Esempio fix:** "Reattach to main component or create a proper variant (e.g. Size/Small) and apply to all instances."

---

### 1.2 Componente orfano (mai usato)

**Descrizione:** Un componente (o component set) è definito nel file ma non è referenziato da nessuna istanza nel documento.

**Dove nel JSON del file:**
- `components` (mappa id → metadata) e `componentSets`.
- Per ogni `componentId` in `components`, cercare nel tree almeno un nodo con `type: "INSTANCE"` e `componentId` uguale.
- Se nessuna istanza referenzia quel componente → orfano.

**Severity:** MED (rumore in library, possibile duplicato dimenticato).

**Esempio fix:** "Remove unused component or promote to library if it is the source of truth for future use."

---

### 1.3 Duplicato di componente (stessa struttura, due definizioni)

**Descrizione:** Due (o più) componenti hanno struttura visiva e comportamento equivalenti ma sono definizioni separate. Aumenta ridondanza e drift.

**Dove nel JSON del file:**
- Confrontare alberi dei nodi in `components`: stessi tipi figlio, stesse proprietà (fills, layout, testo). Normalizzare nomi e confrontare struttura (hash semplificato di tipo + proprietà chiave).
- Non è deterministico al 100% senza semantic; euristiche: stesso nome simile, stesso numero di figli, stessi tipi.

**Severity:** HIGH.

**Esempio fix:** "Merge into a single component; use variants (e.g. property 'State' = Default | Hover) if the difference is discrete."

---

### 1.4 Uso di gruppo invece di componente

**Descrizione:** Strutture riutilizzabili sono GROUP o FRAME senza essere componenti, quindi non c’è un’unica definizione e le copie divergono.

**Dove nel JSON del file:**
- Nodi `type: "GROUP"` o `type: "FRAME"` con `children` complessi che sembrano pattern ripetuti (stessa struttura ripetuta in più punti nel documento).
- Euristica: frame con stesso nome ripetuto in pagine diverse, o sottografi con stessa forma (stessi tipi figlio in sequenza).

**Severity:** MED.

**Esempio fix:** "Convert to Component (Create component) and replace duplicates with instances."

---

### 1.5 Istanza con molti override (rischio breakage su update)

**Descrizione:** Un’istanza di componente ha un numero elevato di override (proprietà sovrascritte rispetto al main). Nei forum di utenti è uno dei problemi più segnalati: aggiornamenti alla library o publish possono “rompere” layout, allineamenti e direzioni di auto‑layout, con ore di fix manuale. Segnalare come **rischio** piuttosto che come errore certo.

**Dove nel JSON del file:**
- Nodi `type: "INSTANCE"` con `componentId`: contare gli override (differenze rispetto al main component su fills, strokes, layoutMode, padding*, itemSpacing, dimensioni, testo, visibilità figli, constraints). Soglia euristica: es. ≥ 5 override significativi su una singola istanza, o ≥ 3 override su proprietà di layout (layoutMode, padding*, itemSpacing).
- Opzionale: istanze con override su `layoutMode` o su nodi nested (figli che sono a loro volta INSTANCE) sono a maggior rischio di breakage.

**Severity:** MED (risk signal; impatto potenziale alto in caso di update library, severity community 4–5).

**Esempio fix:** "Reduce overrides: move customizations into component variants or main component. Many overrides increase risk of breakage when the library is updated (problema ricorrente nelle community di utenti)."

---

## 2. Coverage (token e variabili)

### 2.1 Colore hardcoded (fills)

**Descrizione:** Un fill usa un colore letterale (hex/rgb/rgba) invece di una variabile (bound variable).

**Dove nel JSON del file:**
- Su ogni nodo con `fills` (FRAME, RECTANGLE, TEXT, ecc.): se `fills[i].color` è presente e non c’è corrispondente in `boundVariables.fills` (o equivalente per la versione API), oppure il paint non ha binding a variabile.
- Paint: `color: { r, g, b, a }` senza che il nodo abbia `boundVariables.fills` con lo stesso indice.

**Severity:** HIGH per elementi UI core (bottoni, testo, sfondi); MED per decorativi.

**Esempio fix:** "Use semantic variable e.g. sys.color.primary.500 or fill.brand.primary."

**tokenPath suggerito:** es. `sys.color.primary.500`, `fill.surface.default`.

---

### 2.2 Stroke hardcoded

**Descrizione:** Stroke con colore o spessore letterale invece che da variabile/token.

**Dove nel JSON del file:**
- `strokes` array: presenza di `color` senza binding in `boundVariables.strokes`.
- `strokeWeight` numerico non riconducibile a uno scale (es. 1, 2, 4, 8) o non legato a variabile se l’API lo supporta.

**Severity:** HIGH per bordi interattivi/visibili, LOW per divisori sottili.

**Esempio fix:** "Bind stroke to border.color.default and stroke weight to border.width.1."

---

### 2.3 Tipografia hardcoded (font, size, weight)

**Descrizione:** Testo con font family, size o weight non legati a variabili o a uno style condiviso.

**Dove nel JSON del file:**
- Nodi `type: "TEXT"`: `style.fontFamily`, `style.fontSize`, `style.fontWeight`, `style.lineHeightPx`.
- Se il nodo non ha `styles.text` (riferimento a text style del file) o non ha `boundVariables` per typography, e i valori sono numeri/stringhe “liberi” → hardcoded.
- Confrontare con `styles` (top-level): se esiste uno style con gli stessi valori, suggerire di applicarlo.

**Severity:** HIGH per body e heading; MED per caption/labels.

**Esempio fix:** "Use text style 'Heading/Medium' or bind to token typography.heading.medium."

**tokenPath suggerito:** `typography.body.regular`, `typography.heading.h2`.

---

### 2.4 Spacing / padding non da scale

**Descrizione:** Valori di padding, gap o itemSpacing non appartengono a una scale coerente (es. 4, 8, 16, 24, 32).

**Dove nel JSON del file:**
- `paddingLeft`, `paddingRight`, `paddingTop`, `paddingBottom`, `itemSpacing`, `gridRowGap`, `gridColumnGap`, `counterAxisSpacing`.
- Valori tipo 7, 11, 13, 22 → probabilmente non da scale 4/8.
- Opzionale: verificare se esistono variabili di spacing nel file e se questi valori sono tra quelle definite.

**Severity:** MED (impatta consistenza visiva e manutenzione).

**Esempio fix:** "Use spacing scale (e.g. 8, 16, 24). Replace 22 with 24."

---

### 2.5 Border radius non da token

**Descrizione:** `cornerRadius` o `rectangleCornerRadii` con valori “magici” non riconducibili a uno scale (0, 4, 8, 16, 9999 per pill).

**Dove nel JSON del file:**
- `cornerRadius`, `rectangleCornerRadii` su FRAME, RECTANGLE, ecc.

**Severity:** LOW–MED.

**Esempio fix:** "Use radius token (e.g. radius.sm = 8, radius.full = 9999)."

---

### 2.6 Effetti (ombre, blur) hardcoded

**Descrizione:** `effects` con parametri (colore, blur, offset) non legati a variabili o a uno style effect condiviso.

**Dove nel JSON del file:**
- `effects` array: `type: "DROP_SHADOW"` o `"INNER_SHADOW"` con `color`, `radius`, `offset`, ecc. senza binding.

**Severity:** MED per card/modali; LOW per dettagli.

**Esempio fix:** "Use effect style 'Shadow/Medium' or shadow token elevation.card."

---

### 2.7 Opacità hardcoded

**Descrizione:** `opacity` con valori non da scale (es. 0.73 invece di 0.5 o 0.75).

**Dove nel JSON del file:**
- Proprietà `opacity` sul nodo (numero 0–1).

**Severity:** LOW.

**Esempio fix:** "Use opacity token (e.g. opacity.disabled = 0.5)."

---

## 3. Naming

### 3.1 Nome generico (Frame 123, Rectangle 456)

**Descrizione:** Nome di layer che non descrive ruolo o contenuto (es. "Frame", "Rectangle", "Group" con o senza suffisso numerico). Le best practice e le linee guida citate raccomandano **naming semantico**: nomi che riflettono funzione e significato (es. `color-warning`, `surface-primary`, `Card_Container`) anziché aspetto o tipo di nodo.

**Dove nel JSON del file:**
- Ogni nodo: `name`. Pattern come `/^Frame\s*\d*$/i`, `/^Rectangle\s*\d*$/i`, `/^Group\s*\d*$/i`, `/^Copy\s*\d*$/i`.

**Severity:** HIGH per componenti e frame riutilizzabili; MED per gruppi; LOW per elementi puramente grafici.

**Esempio fix:** "Rename to semantic name e.g. Card_Container, CTA_Primary, Hero_Background."

---

### 3.2 Convenzione naming incoerente

**Descrizione:** Misto di stili (PascalCase, snake_case, kebab-case, spazi) nello stesso file o nella stessa sezione.

**Dove nel JSON del file:**
- `name` di nodi allo stesso livello o in branch simili. Classificare pattern (PascalCase, snake_case, ecc.) e segnalare dove si rompe la convenzione dominante.

**Severity:** MED.

**Esempio fix:** "Use project convention (e.g. PascalCase for components, snake_case for layers): rename 'Card Header' to Card_Header."

---

### 3.3 Nome componente senza variante o stato

**Descrizione:** Componenti che sono chiaramente varianti (es. size, state) ma il nome non lo riflette (es. "Button" ripetuto invece di "Button/Small", "Button/Default").

**Dove nel JSON del file:**
- `components` e `componentSets`: `name` del componente. Se esistono più componenti con nome molto simile o stesso nome con suffissi numerici → suggerire naming con variante.
- Per component sets: verificare che `name` e property/variant siano coerenti.

**Severity:** MED.

**Esempio fix:** "Name component with variant: Button/Primary/Default, Button/Primary/Hover."

---

### 3.4 Pagina o frame con nome non descrittivo

**Descrizione:** Nomi di pagine (CANVAS) o frame principali tipo "Page 1", "Copy 2", "Final", "New".

**Dove nel JSON del file:**
- Nodi `type: "CANVAS"` (pagine): `name`.
- Frame root di pagina: `name`.

**Severity:** LOW–MED (impatta navigazione e documentazione).

**Esempio fix:** "Rename page to e.g. Home_Desktop, Checkout_Flow, DS_Components."

---

## 4. Structure (gerarchia e layout)

### 4.1 Ghost node (gruppo/frame vuoto o ridondante)

**Descrizione:** Gruppo o frame che non aggiunge struttura utile: nessun figlio, o un solo figlio senza ulteriore nesting, o solo wrapper visivamente inutili.

**Dove nel JSON del file:**
- Nodi con `children.length === 0` (vuoti).
- Nodi con `children.length === 1` e il figlio non è un componente/istanza: possibile wrapper ridondante.
- FRAME con stesso bounding box del figlio (stesso layout) → ridondante.

**Severity:** MED (rumore, complessità inutile).

**Esempio fix:** "Remove empty group or flatten: move children to parent and delete wrapper."

---

### 4.2 Nesting eccessivo (troppi livelli)

**Descrizione:** Profondità dell’albero oltre una soglia (es. > 6–8 livelli) per una singola “unità” visiva (es. una card, un bottone).

**Dove nel JSON del file:**
- Calcolare `depth` dal root (o dalla page) per ogni nodo. Segnalare branch con `max(depth) - min(depth)` alto per sotto-alberi che rappresentano un singolo componente/logica.

**Severity:** MED (rende difficile manutenzione e performance).

**Esempio fix:** "Flatten structure: use auto-layout and semantic frames; target max depth 5–6 for components."

---

### 4.3 Auto-layout assente dove utile

**Descrizione:** Frame con più figli posizionati a mano (`layoutMode: "NONE"`) dove auto-layout darebbe flessibilità e consistenza (es. liste, righe di icone, form row).

**Dove nel JSON del file:**
- `layoutMode: "NONE"` con `children.length >= 2`. Euristica: figli allineati orizzontalmente o verticalmente con gap regolari → candidato per auto-layout.

**Severity:** MED.

**Esempio fix:** "Enable auto-layout (Vertical/Horizontal) and set itemSpacing from spacing scale for responsive behavior."

---

### 4.4 Auto-layout con sizing incoerente (FIXED vs HUG)

**Descrizione:** Uso misto di `layoutSizingHorizontal`/`layoutSizingVertical` (FIXED vs HUG) in modo incoerente tra figli dello stesso frame (es. alcuni FIXED senza motivo).

**Dove nel JSON del file:**
- Figli diretti di nodi con `layoutMode !== "NONE"`: `layoutSizingHorizontal`, `layoutSizingVertical`. Confrontare con sibling: se la maggioranza è HUG e uno è FIXED con valore uguale al contenuto → possibile ridondanza.

**Severity:** LOW–MED.

**Esempio fix:** "Use HUG for content-sized children; reserve FIXED for elements that must have fixed width/height (e.g. icons)."

---

### 4.5 Constraints incoerenti

**Descrizione:** Uso di `constraints` che non rispettano una policy (es. “sempre scale & center” per componenti, “left & right” per full-bleed).

**Dove nel JSON del file:**
- `constraints`: `horizontal`, `vertical` (LEFT, RIGHT, CENTER, SCALE, LEFT_RIGHT, TOP_BOTTOM, ecc.). Raggruppare per tipo di nodo (es. componenti vs layout) e segnalare outlier.

**Severity:** LOW–MED.

**Esempio fix:** "Use consistent constraints: e.g. Scale for illustrations, Left & Right for content width."

---

## 5. Consistency (griglia, scale, allineamento)

### 5.1 Allineamento fuori griglia (es. 4px o 8px)

**Descrizione:** Posizione (x, y) del nodo non multipla della base di griglia (4 o 8). Si considerano solo le coordinate, non width/height (le dimensioni possono essere variabili e dipendere dal contenuto).

**Dove nel JSON del file:**
- `absoluteBoundingBox`: `x`, `y`. Calcolare resto modulo 4 (o 8). Se non multiplo → fuori griglia. Non controllare `width` né `height`.

**Severity:** MED per layout; LOW per illustrazioni/icone.

**Esempio fix:** "Snap to 8px grid: adjust x from 13 to 16, y from 7 to 8."

---

### 5.2 Spacing tra elementi non da scale

**Descrizione:** Distanza tra sibling (differenza di `absoluteBoundingBox.x`/`y` e dimensioni) non in scale (4, 8, 16, 24, 32).

**Dove nel JSON del file:**
- Per figli consecutivi: differenza tra bordo destro del primo e bordo sinistro del secondo (o equivalente su asse verticale). Valori tipo 7, 12, 22 → segnalare.

**Severity:** MED.

**Esempio fix:** "Use spacing scale: replace 22px gap with 24px (spacing.lg)."

---

### 5.3 Font size non da type scale

**Descrizione:** `fontSize` non appartiene a una type scale definita (es. 12, 14, 16, 18, 20, 24, 32, 40).

**Dove nel JSON del file:**
- Nodi TEXT: `style.fontSize`. Confrontare con lista di size ammessi (o con `styles` del file).

**Severity:** HIGH per UI testuale.

**Esempio fix:** "Use type scale: replace 15px with 16px (body.medium)."

---

### 5.4 Line height non proporzionale

**Descrizione:** `lineHeightPx` o `lineHeightUnit` non coerente con la scale (es. 1.2, 1.5, 2 per la size usata).

**Dove nel JSON del file:**
- TEXT: `style.lineHeightPx`, `style.lineHeightUnit`.

**Severity:** MED.

**Esempio fix:** "Use line height token: e.g. 1.25 for body, 1.2 for headings."

---

## 6. Copy e contenuto

### 6.1 Placeholder (Lorem, dummy, fake)

**Descrizione:** Testo con "Lorem", "dummy", "fake", "placeholder", "xxx", "test".

**Dove nel JSON del file:**
- Nodi TEXT: `characters`. Cercare pattern (case-insensitive).

**Severity:** HIGH prima di handoff; MED in file di design system come esempio.

**Esempio fix:** "Replace with real copy or mark as [Placeholder] in description for dev."

---

### 6.2 Terminologia incoerente

**Descrizione:** Stesso concetto espresso con parole diverse (es. "Cancel" vs "Annulla", "Delete" vs "Remove") nello stesso contesto.

**Dove nel JSON del file:**
- TEXT: `characters`. Raggruppare per contesto (stesso componente, stessa pagina) e confrontare termini (euristica: sinonimi comuni, traduzioni).

**Severity:** MED.

**Esempio fix:** "Use consistent term: prefer 'Cancel' everywhere in this flow (or document in copy guidelines)."

---

### 6.3 Rischio overflow (contenitore stretto o testo lungo)

**Descrizione:** Testo lungo in un contenitore con width fissa senza indicazione di truncate/ellipsis o wrap; rischio per localizzazione.

**Dove nel JSON del file:**
- TEXT: `absoluteBoundingBox.width`, `characters.length`, `style.fontSize`. Rapporto caratteri/larghezza alto o confronto con sibling più larghi.
- Parent con `layoutMode` e figlio testo FIXED con width piccola.

**Severity:** MED.

**Esempio fix:** "Add max-width + ellipsis or allow wrap; document max length for localization."

---

## 7. Regole aggiuntive (best practice)

### 7.1 Componente senza descrizione

**Descrizione:** Main component senza descrizione (per documentazione e Dev Mode).

**Dove nel JSON del file:**
- `components`: metadata può includere `description` (se presente nell’API). Se assente o vuoto → segnalare.

**Severity:** LOW.

**Esempio fix:** "Add description to component (e.g. usage, props, do/don't)."

---

### 7.2 Raster dove è possibile vettore

**Descrizione:** Immagini (nodi con fill tipo IMAGE o bitmap) usate per elementi che potrebbero essere icone o illustrazioni vettoriali.

**Dove nel JSON del file:**
- Nodi con `fills` contenenti `type: "IMAGE"` o riferimento a risorsa raster. Contesto: dimensioni piccole (es. < 48px) → probabile icona.

**Severity:** LOW–MED.

**Esempio fix:** "Replace with vector icon from icon set for scalability and theming."

---

### 7.3 Stesso stile definito più volte (fill/stroke/text style)

**Descrizione:** Stessi valori di fill, stroke o typography ripetuti su molti nodi invece di usare uno style condiviso.

**Dove nel JSON del file:**
- Confrontare `fills`, `strokes`, `style` (TEXT) tra nodi. Se un insieme di valori è ripetuto > N volte (es. 3+) e non c’è uno `styles` condiviso con quei valori → duplicazione.

**Severity:** MED.

**Esempio fix:** "Create style 'Fill/Primary' (or bind to variable) and apply to all instances."

---

### 7.4 Accessibilità (contrast e leggibilità)

**Descrizione:** Elementi UI critici (testo, bottoni, link) con contrasto colore/sfondo potenzialmente insufficiente per WCAG (es. testo grigio su sfondo bianco senza rapporto di contrasto adeguato). Le linee guida citate sottolineano l’accessibilità come fondazione del design system (font size, contrast, labels).

**Dove nel JSON del file:** Nodi con `fills` e figli TEXT: confrontare colore testo e colore sfondo (calcolo luminance e ratio). Se il file espone stili o variabili, verificare se sono documentati come accessibili. L’audit può limitarsi a segnalare “verifica contrasto WCAG” dove i colori sono hardcoded o non mappati a token di accessibilità.

**Severity:** MED (raccomandazione; la verifica precisa richiede plugin o tool dedicati).

**Esempio fix:** "Check contrast ratio (WCAG 2.1 AA). Use semantic token e.g. text.on-surface with sufficient contrast, or document intended use."

---

## Mappatura regola → categoryId (per l’agente)

| Regola | categoryId |
|--------|------------|
| 1.1–1.5 | adoption |
| 2.1–2.7 | coverage |
| 3.1–3.4 | naming |
| 4.1–4.5 | structure |
| 5.1–5.4 | consistency |
| 6.1–6.3 | copy |
| 7.1–7.4 | adoption / coverage / naming / consistency (come più appropriato) |

---

## Note per l’implementazione

- **Riferimento library:** l'audit è relativo alla library su cui l'utente sta lavorando (library nel file o esterna/linkata). Usare come riferimento componenti, variabili, stili e scale definiti in quel contesto; le scale/valori nelle regole sono esempi—preferire quanto è nel file/library quando rilevabile.
- L'ordine di esecuzione consigliato è: prima raccogliere tutti i nodi e le mappe (`components`, `componentSets`, `styles`, variabili), poi applicare le regole in batch dove possibile.
- Per file molto grandi, considerare `depth` limitato o analisi per pagina/selection; segnalare nel report se l’audit è parziale.
- Severity può essere aggiustata in base al contesto (es. file “design system” vs “marketing one-off”): in dubbio usare MED.
