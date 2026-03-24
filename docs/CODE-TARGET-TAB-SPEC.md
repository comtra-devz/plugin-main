# Code — Target Tab — Specifica estratta dal mockup

Documento estratto dall’UI attuale (`views/Code/tabs/TargetTab.tsx`) per la tab **Target** nella vista Code. Tutte le stringhe, i componenti, gli stati e i flussi sono documentati qui.

**Obiettivo:** definire cosa può essere estratto da un mockup Figma (o dall’UI esistente) per implementazione, allineamento design–code e identificazione dei gap.

---

## 1. Struttura UI (estrazione dal mockup)

### 1.1 Schema generale

```
┌─────────────────────────────────────────┐
│ ℹ️ Workflow Info                        │
│ 1. Component → Sync Storybook            │
│ 2. Wireframe → Push GitHub/Bitbucket     │
│ 3. Prototype → Push GitHub/Bitbucket     │
│ In all cases: generate and copy code     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ TARGET LAYER              [Deselect]    │
│ ─────────────────────────────────────── │
│ {selectedLayer} oppure "No Layer Selected"│
└─────────────────────────────────────────┘

[Se selectedLayer]
┌─────────────────────────────────────────┐
│ Generate Code                            │
│ Output Format: [React + Tailwind ▼]      │
│ [Generate Code] (-40 Credits)            │
│ ─── oppure ───                           │
│ ┌─────────────────────────────────────┐ │
│ │ // codice generato...         REACT │ │
│ └─────────────────────────────────────┘ │
│ [COPY CODE]                              │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Storybook Connect                        │
│ Sync this component.                     │
│ [Sync Component] / [Update Component]    │
│ Synced: HH:MM:SS                         │
└─────────────────────────────────────────┘
```

### 1.2 Componenti identificabili

| Blocco | Descrizione | Stile |
|--------|-------------|-------|
| Workflow Info | Alert informativo in cima | `bg-white border-2 border-black shadow-[4px_4px_0_0_#000]`, `text-[10px]` |
| Target Layer | Card con layer selezionato o stato vuoto | `BRUTAL.card`, pulsante Deselect nero |
| Generate Code | Card blu (`#e0f2fe`) con select e area codice | `bg-[#e0f2fe]`, `BRUTAL.card` |
| Storybook Connect | Card blu per sync componente | Stesso stile Generate Code |

---

## 2. Copy e stringhe (estrazione da mockup)

### Workflow Info

| Elemento | Testo |
|----------|-------|
| Titolo | `ℹ️ Workflow Info` |
| Punto 1 | `Selected a Component?` → Sync to Storybook. |
| Punto 2 | `Selected a Wireframe?` → Push to GitHub/Bitbucket. |
| Punto 3 | `Selected a Prototype?` → Push to GitHub/Bitbucket. |
| Footer | In all cases, you can generate and copy code directly. |

### Target Layer

| Elemento | Testo |
|----------|-------|
| Label | `Target Layer` |
| Pulsante | `Deselect` |
| Layer presente | `{selectedLayer}` (font-mono, text-lg, font-black) |
| Layer assente | `No Layer Selected` (badge rosso, uppercase) |

### Generate Code

| Elemento | Testo |
|----------|-------|
| Titolo | `Generate Code` |
| Label select | `Output Format` |
| Pulsante genera | `Generate Code` / `Generating...` |
| Badge credito | `-40 Credits` |
| Pulsante copy | `COPY CODE` / `COPIED!` |
| Badge area codice | `{lang}` (es. REACT) |

### Storybook Connect

| Elemento | Testo |
|----------|-------|
| Titolo | `Storybook Connect` |
| Sottotitolo | Sync this component. |
| Pulsante (primo sync) | `⚡ Sync Component` |
| Pulsante (update) | `⚡ Update Component` |
| Durante sync | `Weaving connection...` |
| In cooldown | `Wait {mm:ss}` |
| Timestamp | `Synced: {HH:MM:SS}` |

---

## 3. Formati output (LANGUAGES)

```ts
const LANGUAGES = [
  { id: 'REACT',     label: 'React + Tailwind' },
  { id: 'STORYBOOK', label: 'Storybook (.stories.tsx)' },
  { id: 'LIQUID',    label: 'Shopify Liquid' },
  { id: 'CSS',       label: 'HTML + Clean CSS' },
  { id: 'VUE',       label: 'Vue 3' },
  { id: 'SVELTE',    label: 'Svelte' },
  { id: 'ANGULAR',   label: 'Angular' },
];
```

---

## 4. Props `TargetTabProps` (contratto)

| Prop | Tipo | Descrizione |
|------|------|-------------|
| `selectedLayer` | `string \| null` | Nome layer Figma selezionato |
| `setSelectedLayer` | `(id: string \| null) => void` | Aggiorna layer selezionato |
| `lang` | `string` | ID formato output (es. REACT) |
| `setLang` | `(lang: string) => void` | Cambia formato |
| `generatedCode` | `string \| null` | Codice generato |
| `setGeneratedCode` | `(code: string \| null) => void` | Imposta codice |
| `copied` | `boolean` | Stato "copiato" |
| `isGenerating` | `boolean` | Durante generazione |
| `handleGenerate` | `() => void` | Avvia generazione |
| `handleCopy` | `() => void` | Copia negli appunti |
| `handleSyncComp` | `(target: 'SB' \| 'GH' \| 'BB') => void` | Sync componente |
| `isSyncingComp` | `boolean` | Durante sync |
| `lastSyncedComp` | `Date \| null` | Ultimo sync |
| `getRemainingTime` | `(key: string) => string \| null` | Cooldown mm:ss |
| `setLastSyncedComp` | `(date: Date \| null) => void` | Aggiorna timestamp sync |

---

## 5. Cosa si può estrarre da un mockup Figma

Da un mockup design in Figma si possono estrarre:

1. **Layout e spaziatura:** gap tra card (`gap-4`), padding interno, ordine verticale.
2. **Palette:** card bianche/azzurre (`#e0f2fe`), bordo nero, badge rosso (`#dc2626`).
3. **Tipografia:** `text-[10px]` label, `font-black` titoli, `font-mono` per layer/codice.
4. **Stati visivi:** “No Layer Selected” (rosso), codice generato (sfondo scuro `#1a1a1a`).
5. **Copy:** tutte le stringhe sopra per i18n o review copy.
6. **Componenti riutilizzabili:** card, select, pulsanti (variant primary/secondary).
7. **Micro-interazioni:** animazioni `animate-in slide-in-from-right-2`, `slide-in-from-top-2`, `fade-in`.

---

## 6. Gap attuali (da risolvere)

### 6.1 Layer selection

| Gap | Descrizione | Riferimento |
|-----|-------------|-------------|
| Nessun collegamento Figma | `selectedLayer` è sempre `null`; non c’è `get-selection` quando la view è Code. | App.tsx: `get-selection` solo per `view === GENERATE` |
| Nessun `selection-changed` per Code | `selectedNode` in App è usato solo da Generate, non passato a Code. | App.tsx, Code.tsx |

**Da fare:** quando `view === ViewState.CODE` e tab attiva `TARGET`:
- Inviare `get-selection` al controller.
- Passare `selectedNode` (o equivalente) a `Code` → `TargetTab` come `selectedLayer`.
- Opzionale: listener `selectionchange` per aggiornare in tempo reale mentre si è su Code.

### 6.2 Code generation

| Gap | Descrizione |
|-----|-------------|
| Mock | `handleGenerate` usa `generateCodeString()` (stub locale); nessuna chiamata backend. |
| Crediti | Badge "-40 Credits" presente; logica `estimateCredits`/`consumeCredits` per `code_gen` da verificare. |

### 6.3 Storybook sync

| Gap | Descrizione |
|-----|-------------|
| Mock | `handleSyncComp` usa `setTimeout` 2s; nessuna integrazione Storybook reale. |
| GH/BB | Pulsanti per GitHub/Bitbucket non esposti nella UI attuale (solo SB). |

---

## 7. Ordine di implementazione suggerito

1. **Selection Figma per Code:** collegare `selectedNode` (o `selection-changed`) a Code quando view=CODE; passare a TargetTab.
2. **Rimuovere mock layer:** se esiste un pulsante "Select Layer" mock (non presente in TargetTab attuale, presente in DeepAnalysisTab), allineare a selezione reale.
3. **Code gen backend:** sostituire `generateCodeString()` con chiamata a `POST /api/agents/code-gen` (vedi `ACTION-PLAN-KIMI-AGENTS.md`).
4. **Crediti:** verificare stima e consumo per `code_gen` e `comp_sync`.
5. **Storybook sync reale:** integrare con Chromatic/Storybook quando disponibile.

---

## 8. File coinvolti

| File | Ruolo |
|------|-------|
| `views/Code/tabs/TargetTab.tsx` | UI tab Target |
| `views/Code.tsx` | Stato, handlers, passaggio props |
| `views/Code/types.ts` | `TargetTabProps`, `BRUTAL` |
| `App.tsx` | `selectedNode`, `get-selection`, view Code vs Generate |
| `controller.ts` | `get-selection`, `selectionchange` |

---

## 9. Riferimenti

- `GENERATE-TAB-SPEC.md` — formato spec simile per Generate.
- `GENERATE-TAB-UX-SPEC.md` — selection reale, Context Layer.
- `docs/SYNC-INVESTIGATION.md` — integrazione Storybook/GitHub/Bitbucket.
- `docs/ACTION-PLAN-KIMI-AGENTS.md` — endpoint `code-gen`.
