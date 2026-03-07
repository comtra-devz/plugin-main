# Generate Tab — Specifica da UI placeholder

Documento estratto dalla UI placeholder attuale (`views/Generate.tsx`) per mettere in campo la main tab "Generate". Tutte le stringhe, i data-attribute, gli stati e i flussi sono documentati qui.

**Stato implementazione (v1):** La tab Generate è collegata al backend. Il plugin invia `file_key` (tramite `requestFileContext`), `prompt`, `mode`, `ds_source` a **POST /api/agents/generate**; il backend usa Kimi e restituisce un **action plan** JSON. I crediti (3 standard) vengono detratti dopo successo. L’esecuzione delle azioni su canvas Figma (CREATE_FRAME, INSTANCE_COMPONENT, …) è prevista in una successiva iterazione.

---

## 1. Props del componente `Generate`

| Prop | Tipo | Descrizione |
|------|------|-------------|
| `plan` | `UserPlan` | Piano utente (FREE / PRO) |
| `userTier` | `string \| undefined` | Tier (1w, 1m, 6m, 1y, ecc.) |
| `onUnlockRequest` | `() => void` | Callback per aprire upgrade quando crediti insufficienti |
| `creditsRemaining` | `number \| null` | Crediti rimanenti (null = non ancora caricati) |
| `useInfiniteCreditsForTest` | `boolean \| undefined` | Test user: crediti infiniti |
| `estimateCredits` | `(payload: { action_type: string; node_count?: number }) => Promise<{ estimated_credits: number }>` | Stima crediti prima dell’azione |
| `consumeCredits` | `(payload: { action_type: string; credits_consumed: number; file_id?: string }) => Promise<{ credits_remaining?: number; error?: string }>` | Consumo crediti dopo generazione |
| `initialPrompt` | `string \| undefined` | Prompt precompilato (es. da Audit → "Generate" con CTA) |

---

## 2. Stato locale

| Stato | Tipo | Valore iniziale | Uso |
|-------|------|-----------------|-----|
| `res` | `string` | `''` | Risultato testuale della generazione (attualmente da stub) |
| `loading` | `boolean` | `false` | Durante chiamata `generateDesignSuggestions` |
| `selectedLayer` | `string \| null` | `null` | Nome layer Figma selezionato (es. `"Hero_Section_V2"`) |
| `hasContent` | `boolean` | `!!initialPrompt` | C’è testo (o chip) nel prompt → abilita pulsante Generate |
| `uploadedImage` | `string \| null` | `null` | Nome file screenshot caricato (es. `"screenshot_v1.png"`) |
| `selectedSystem` | `string` | `DESIGN_SYSTEMS[0]` | Design system scelto |
| `isSystemOpen` | `boolean` | `false` | Dropdown Design System aperto/chiuso |
| `systemSearch` | `string` | `''` | Filtro di ricerca nel dropdown DS |
| `showReport` | `boolean` | `false` | Dopo generazione con layer selezionato → mostra "AI Implementation Report" |
| `conversionSelected` | `boolean` | `false` | Checkbox "Convert new Card_Wrapper div to Component?" |

Ref: `inputRef` (ContentEditable), `dsDropdownRef` (click outside per chiudere dropdown).

---

## 3. Costanti di copy / dati

### Inspiration chips (Try asking the stars)

```ts
const INSPIRATION = [
  "Create a desktop login page",
  "Create a different version of this component",
  "Create a mobile cart",
];
```

### Design systems

```ts
const DESIGN_SYSTEMS = [
  "Custom (Current)",
  "Material Design 3",
  "iOS Human Interface",
  "Ant Design",
  "Carbon Design",
  "Bootstrap 5",
  "Salesforce Lightning",
  "Uber Base Web"
];
```

### Label / UI copy

- **Credit banner:** `"Credits: {creditsDisplay}"` (creditsDisplay = `'∞'` | `'—'` | `${creditsRemaining}`)
- **Info alert title:** `"ℹ️ Generation Logic"`
- **Info list:**
  1. `"No Selection:"` → `"Creates wireframes from scratch."`
  2. `"Selection Active:"` → `"Modifies a copy (originals are safe)."`
  3. `"Upload Screenshot:"` → `"AI converts pixels to your Design System components."`
  4. `"Paste Link:"` → `"You can paste Figma wireframe links in the prompt to reference them."`
- **Context layer label:** `"Context Layer"`
- **Selection toggle:** `"Clear Selection"` | `"Select Layer"`
- **Target value:** `"Target: {selectedLayer}"`
- **Uploaded file:** `"📄 {uploadedImage}"` + pulsante ✕
- **Selection empty:** `"No layer selected. Creating new wireframes or upload a screenshot."`
- **Upload button:** `"Upload Image"`
- **Design System label:** `"Design System"`
- **DS dropdown placeholder:** `"Search System..."`
- **Empty search:** `"No system found"`
- **Terminal header:** `"AI Terminal"` + `"v1.0"`
- **Test helper:** `"🧪 Inject Fake Link"`
- **Placeholder input:**  
  - Con layer: `"> Modify {selectedLayer}: e.g. \"Make it pop\""`  
  - Senza: `"> Describe your UI (or paste a Figma link)..."`
- **Generate button:**
  - Loading: `"Weaving Magic..."`
  - Zero credits: `"Unlock Unlimited AI"`
  - Con layer: `"Modify Component"`
  - Default: `"Create Wireframes"`
- **Credits badge sul pulsante:** `"-3 Credits"`
- **Inspiration title:** `"Try asking the stars:"`
- **Report card title:** `"AI Implementation Report"`
- **Report badge:** `"Attention Needed"`
- **Report bullet 1:** `"Generated using {selectedSystem} conventions."`
- **Report bullet 2:** `"Successfully used 3 existing tokens from your Design System."`
- **Conversion checkbox label:** `"Convert new \"Card_Wrapper\" div to Component?"`
- **Conversion hint:** `"Found a repeated Frame structure. Checking this will register it as \"Card_V3\" in your local library."`
- **Report actions:** `"Back"` | `"Apply Changes"` | `"View Component in Figma"` (se conversionSelected)

---

## 4. Data attributes (testing / analytics)

| data-component | Contesto |
|----------------|----------|
| `Generate: View Container` | Root della view |
| `Generate: Credit Banner` | Banner crediti |
| `Generate: Info Alert` | Box "Generation Logic" |
| `Generate: Info Title` | Titolo info |
| `Generate: Info List Item 1..4` | Singoli punti elenco |
| `Generate: Selection Card` | Card Context Layer + DS |
| `Generate: Selection Label` | "Context Layer" |
| `Generate: Selection Toggle` | Pulsante Select/Clear |
| `Generate: Selection Value` | "Target: …" |
| `Generate: Uploaded File` | Riga file caricato |
| `Generate: Selection Empty` | Testo "No layer selected…" |
| `Generate: Upload Button` | Upload Image |
| `Generate: DS Selector` | Riga dropdown Design System |
| `Generate: Terminal Header` | Header "AI Terminal" |
| `Generate: Rich Input` | ContentEditable prompt |
| `Generate: Generate Button` | Pulsante principale |
| `Generate: Inspiration Title` | "Try asking the stars" |
| `Generate: Inspiration Chip 1..3` | Chip suggerimenti |
| `Generate: Report Container` | Container report post-generazione |

---

## 5. Logica derivata

- **isPro** = `plan === 'PRO'`
- **remaining** = infinite (test/pro) oppure `creditsRemaining ?? Infinity`
- **canGenerate** = `isPro || remaining > 0`
- **creditsDisplay** = `'∞'` (pro/test) | `'—'` (creditsRemaining null) | `${creditsRemaining}`
- **knownZeroCredits** = non pro, non test, e `creditsRemaining !== null && creditsRemaining <= 0`
- **filteredSystems** = `DESIGN_SYSTEMS.filter(s => s.toLowerCase().includes(systemSearch.toLowerCase()))`

---

## 6. Comportamenti chiave

### Prompt (ContentEditable)

- **Paste:** se il testo incollato matcha URL Figma (`https?://(www\.)?figma\.com/file/...`), viene inserito un **chip** invece del testo raw. Il chip è uno `<span contentEditable="false" data-url="...">` con testo `🔗 Ref: {cleanName}` (cleanName = ultimo segmento path).
- **Clic su chip:** in futuro `figma.viewport.scrollAndZoomIntoView` per l’URL (ora solo `console.log`).
- **checkContent:** rimuove i chip dal clone, considera solo il testo; `setHasContent(text.length > 0)`.

### Context Layer

- **Select Layer:** toggle che imposta `selectedLayer` a `"Hero_Section_V2"` o `null`; alla clear viene anche `setShowReport(false)`.
- **Upload Image:** simulato con `setTimeout` → `setUploadedImage("screenshot_v1.png")`.
- **Delete upload:** `setUploadedImage(null)`.

### Design System

- Dropdown con search; click outside (dsDropdownRef) chiude.
- Pulsante ✕ sulla riga (quando non è "Custom (Current)") riporta a `DESIGN_SYSTEMS[0]`.

### Generazione

- **handleGen:** se `!canGenerate` → `onUnlockRequest()` e return. Poi `setLoading(true)`, `setShowReport(false)`, `setConversionSelected(false)`.
- Payload verso AI: `[Context: ${selectedSystem}] ${rawText}` (rawText da `inputRef.current?.innerText`).
- Chiamata: `generateDesignSuggestions(dsContext)` (attualmente stub che ritorna `"AI Service Unavailable (TEST ENV)"`).
- Dopo 2 secondi di delay: `setRes(result)`, `setLoading(false)`; se `selectedLayer` → `setShowReport(true)`.
- **Crediti:** in UI è indicato "-3 Credits" ma nel codice attuale **non** c’è chiamata a `estimateCredits`/`consumeCredits` dentro `handleGen`. Da implementare quando la generazione sarà reale.

### Report (post-generazione con layer selezionato)

- Mostra card "AI Implementation Report" con due bullet e checkbox "Convert new Card_Wrapper div to Component?".
- **Back:** `setShowReport(false)`.
- **Apply Changes / View Component in Figma:** `handleViewFigma()` (ora solo `console.log("Focusing Figma...")`).
- Se `conversionSelected` il pulsante diventa "View Component in Figma" e stile primario (nero).

---

## 7. Integrazioni esterne

### Servizio AI

- **File:** `services/geminiService.ts`
- **Funzione:** `generateDesignSuggestions(prompt: string): Promise<string>`
- **Stato attuale:** stub che ritorna sempre `"AI Service Unavailable (TEST ENV)"` (niente @google/genai in bundle per sandbox Figma).

### Navigazione Audit → Generate

- In `App.tsx`: `onNavigateToGenerate={(prompt) => { setGenPrompt(prompt); setView(ViewState.GENERATE); }}`.
- Audit (es. CTA "Generate" in Prototype tab) chiama `onNavigateToGenerate("Create a confirmation wireframe for the checkout flow with success state")`.
- Generate riceve `initialPrompt={genPrompt}` e in `useEffect` imposta `inputRef.current.innerText = initialPrompt` e `setHasContent(true)`.

### Stili

- **BRUTAL:** `card`, `btn`, `input` da `constants.ts`.
- **COLORS:** `primary: '#ff90e8'` (e altri).
- Credit banner: se `knownZeroCredits` → `bg-red-100 text-red-600`, altrimenti `bg-[#ffc900] text-black`.

---

## 8. Cose da implementare / collegare

1. **geminiService:** sostituire lo stub con chiamata reale (o proxy backend) e gestire errori/retry.
2. **Crediti:** prima di generare chiamare `estimateCredits({ action_type: 'generate', node_count? })`; dopo successo `consumeCredits({ action_type: 'generate', credits_consumed: 3 })` (o valore da backend).
3. **Figma selection reale:** leggere la selezione corrente da Figma (plugin API) invece del toggle "Hero_Section_V2" fisso; aggiornare `selectedLayer` con il nome del nodo.
4. **Upload screenshot:** collegare input file reale e invio immagine nel contesto della generazione (multimodal).
5. **Chip Figma link:** da `data-url` dei chip chiamare Figma API per scroll/zoom (o aprire link).
6. **Apply / View in Figma:** applicare le modifiche generate al file Figma (creare/modificare nodi) e/o focus viewport sul componente.
7. **Conversion to component:** se l’utente spunta "Convert … to Component", registrare il nuovo componente (es. "Card_V3") nella library locale / Figma.
8. **Rimozione blocco test:** rimuovere o nascondere il blocco "🧪 Inject Fake Link" in produzione.

---

## 9. File coinvolti

| File | Ruolo |
|------|--------|
| `views/Generate.tsx` | UI e logica tab Generate |
| `services/geminiService.ts` | Stub AI → da sostituire con integrazione reale |
| `App.tsx` | Stato `genPrompt`, `setGenPrompt`, navigazione Audit → Generate, props a Generate |
| `views/Audit/AuditView.tsx` | `onNavigateToGenerate` (es. tab Prototype, id `p2`) |
| `constants.ts` | `BRUTAL`, `COLORS` |

Questa spec può essere usata come riferimento unico per implementare la tab Generate reale (backend AI, crediti, Figma selection/apply, upload screenshot, conversione in componente).
