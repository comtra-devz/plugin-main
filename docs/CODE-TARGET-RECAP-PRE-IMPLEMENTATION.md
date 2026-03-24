# Code — Target Tab — Recap pre-implementazione

Documento di sintesi prima di implementare le modifiche richieste. Verifica stato attuale, gap e piano d’azione.

---

## 1. Selezione tipologia di codice (Output Format)

**Richiesta:** usare lo stesso pattern del box Design System in Generate.

**Pattern Generate (Design System):**
- Card bianca `BRUTAL.card` con `px-3 py-4 flex flex-col gap-3`
- Header: `text-xs font-bold uppercase` (es. "DESIGN SYSTEM")
- Subtext: `text-[10px] text-gray-500` con istruzioni
- Select: `border-2 border-black p-2 flex justify-between items-center` (dropdown click-to-open, non `<select>` nativo)

**Stato attuale TargetTab:** Output Format è un semplice `<select>` nativo dentro la card blu "Generate Code".

**Azione:** creare una card separata "Output Format" (o "Code Type") con lo stesso layout di Design System:
- Header "OUTPUT FORMAT" / "CODE TYPE"
- Subtext: es. "Choose the target framework for generated code. Default is React + Tailwind."
- Dropdown custom stile Generate (thick border, chevron, stessa UX)

---

## 2. Azioni Code e Connect — verifica crediti e mockup

**Verifica effettuata:**

| Aspetto | Stato attuale | Mockup / spec |
|--------|---------------|---------------|
| **Generate Code** | Badge "-40 Credits" hardcoded; `handleGenerate` NON chiama `estimateCredits` né `consumeCredits` | Backend non espone `code_gen`; fallback `estimateCreditsByAction` → 5 |
| **Storybook Connect** | Badge "-40 Credits"; `handleSyncComp` verifica `isPro` ma usa `setTimeout` (mock); nessun consume | Backend ha `sync_fix` / `sync_storybook` = 5 crediti |
| **Cost 40** | Valore arbitrario in UI | Non documentato in oauth-server; sync_fix/sync_storybook = 5 |

**Conclusione:** i crediti per Code e Connect **non corrispondono** alla logica reale:
- Backend non ha `code_gen` né `comp_sync` espliciti; fallback = 5
- Valore 40 in UI è incoerente (Sync Fix = 5, Scan = 15)
- Generate Code non consuma crediti; Storybook Connect è mock

**Azione suggerita:**
- Aggiungere in `estimateCreditsByAction`: `code_gen` (es. 5 o valore da product) e `comp_sync` (es. 5, allineato a sync_fix)
- Collegare `estimateCredits` / `consumeCredits` in `handleGenerate` e `handleSyncComp`
- Aggiornare badge con il costo effettivo restituito da `estimateCredits` (non 40 hardcoded)

---

## 3. Storybook Connect — PRO e logica Sync

**Richiesta:** Storybook Connect = mini Sync per singolo componente; PRO only; segnalare come in Sync; usare la stessa logica di Sync ma applicata al solo componente.

**Stato Sync:**
- **PRO gate:** attualmente **disabilitato** (commento in SyncTab: "TEMPORARY: PRO gate disabled for Deep Sync until Lemon Squeezy store is live"). Quando riattivato: mostrare blocco upgrade per `!isPro`.
- **Caricamento Storybook:** l’utente riferisce che "non da finalmente più errore" — quindi Connect + check API funziona. Oltre non è stato possibile verificare (scan, drift, ecc.).
- **Flusso Sync:** Connect URL → `fetchCheckStorybook` → Scan (`get-file-context` + `fetchSyncScan`) → lista drift → Sync Fix / Sync All

**Storybook Connect (Target):**
- Condivide `storybookUrl`, `storybookToken`, `isSbConnected` con Sync (stesso stato in Code.tsx)
- Serve: layer selezionato + connessione Storybook attiva → sync di quel componente
- Backend: `sync-scan` restituisce lista drift; `sync_fix` sincronizza un item. Per "sync singolo componente" si può usare `sync_fix` passando l’id del drift che corrisponde al layer selezionato.
- **Precondizioni:** `isSbConnected` + layer selezionato. Se non connesso: indicare "Connect Storybook in Sync tab first" o mini-connect inline.

**PRO gate visibile:**
- Come Sync (quando riattivato): se `!isPro`, mostrare blocco/badge tipo "PRO — Connect your Storybook and sync components"
- CTA disabilitata + `onUnlockRequest` al click (già presente in `handleSyncComp`)

---

## 4. Sblocco CTA e Workflow Info

**Workflow Info (Read First):**
1. Selected a **Component**? → Sync to Storybook  
2. Selected a **Wireframe**? → Push to GitHub/Bitbucket  
3. Selected a **Prototype**? → Push to GitHub/Bitbucket  
4. In all cases: generate and copy code

**Sblocco CTA:**
- **Generate Code** + **Copy:** sempre disponibili quando c’è layer selezionato (e crediti/Pro)
- **Storybook Connect:** quando selezione è un **Component** (e Storybook connesso, PRO)
- **Push GH/BB:** quando selezione è **Wireframe** o **Prototype** (non esposti oggi in TargetTab)

**Gap:** non abbiamo il tipo di selezione (Component vs Wireframe vs Prototype) dal canvas Figma. Con "Select Frame" mock (Hero_Section_V2) non c’è distinzione.

**Opzioni:**
- **A)** Aggiungere selettore "Type of selection" (Component / Wireframe / Prototype) per guidare quali CTA abilitare
- **B)** Abilitare tutto quando c’è layer; l’utente sceglie in base al workflow (più semplice, meno vincolante)
- **C)** Inferire il tipo da `selectedNode?.type` (INSTANCE → Component, FRAME → Wireframe, ecc.) quando si collegherà la selezione Figma reale

**Raccomandazione:** per ora **B)** — tutte le CTA abilitate quando c’è layer selezionato. Quando si collegherà `selection-changed` e `selectedNode`, si potrà passare ad **C)**.

---

## 5. Ordine di implementazione proposto

1. **Output Format box** — Card stile Design System, dropdown custom (no `<select>`)
2. **Crediti** — Aggiungere `code_gen` e `comp_sync` in backend; collegare estimate/consume; badge dinamico
3. **Storybook Connect PRO** — Blocco visibile per `!isPro` (come Sync quando riattivato); indicare "PRO required"
4. **Storybook Connect — logica reale** — Usare `isSbConnected`, `storybookUrl`; se non connesso, messaggio "Connect in Sync tab"; chiamata a sync per componente (da definire endpoint o riuso `sync_fix` con layerId)
5. **CTA unlock** — Per ora: Generate e Connect abilitati quando `selectedLayer`; Default B

---

## 6. Riferimenti file

| File | Modifiche previste |
|------|-------------------|
| `views/Code/tabs/TargetTab.tsx` | Output Format card, PRO block Storybook Connect, props `isPro`, `onUnlockRequest`, `isSbConnected` |
| `views/Code/types.ts` | Aggiungere a `TargetTabProps`: `isPro`, `onUnlockRequest`, `isSbConnected`? (opzionale, già gestito in Code) |
| `views/Code.tsx` | Passare `isPro`, `onUnlockRequest` a TargetTab; eventuale `isSbConnected` |
| `auth-deploy/oauth-server/app.mjs` | `code_gen`, `comp_sync` in `estimateCreditsByAction` |
| `docs/CODE-TARGET-TAB-SPEC.md` | Aggiornare con nuovo layout e crediti |

---

## 7. Domande aperte

- **Costo crediti:** 5 per `code_gen` e `comp_sync` (allineato a sync_fix) oppure valori diversi da product?
- **Storybook Connect senza connessione:** mostrare "Go to Sync tab to connect" oppure mini-connect inline nella card?
- **API sync singolo componente:** riusare `sync_fix` con `layerId` nel body oppure endpoint dedicato `POST /api/agents/sync-component`?
