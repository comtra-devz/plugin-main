# Prototype Audit — Scope e interfaccia (select flussi)

A differenza di DS e A11Y, il tab **Prototype** non usa “All Pages” né scope per pagina singola. Lo scope è definito per **flussi di prototipo**: l’utente sceglie **quali flussi** includere nell’audit tramite una **multi-select**.

---

## 1. Identificazione dei flussi (Figma)

I flussi sono identificati dagli **starting point** del prototipo, come da documentazione Figma:

- **Fonte dati:** `figma.currentPage.flowStartingPoints`
- **Tipo:** `ReadonlyArray<{ nodeId: string; name: string }>`
- **Significato:** ogni elemento è un flusso sulla pagina corrente: `nodeId` = frame da cui parte il flusso, `name` = nome del flusso (es. "Onboarding", "Checkout Flow").
- **Riferimento:** [Figma Plugin API — PageNode.flowStartingPoints](https://developers.figma.com/docs/plugins/api/properties/PageNode-flowstartingpoints/)

L’audit viene eseguito **solo sulla pagina corrente**; i flussi disponibili sono quindi quelli di `figma.currentPage.flowStartingPoints`. Se la pagina non ha starting point, non ci sono flussi selezionabili (e si può mostrare un messaggio tipo “Nessun flusso su questa pagina” o “Imposta almeno un flow starting point”).

---

## 2. Interfaccia: multi-select flussi

- **Controllo:** una **select con multi-selezione** che elenca tutti i flussi della pagina (nome flusso, eventualmente con nodeId o frame name per disambiguare).
- **Opzioni utente:**
  - Selezionare **un solo flusso**
  - Selezionare **più flussi** (checkbox o multi-select)
  - **“Tutti i flussi”** (select all) per includere ogni flow starting point della pagina
- **Default:** si può pre-selezionare “Tutti i flussi” oppure nessuno (obbligando a una scelta esplicita prima di Run).
- **Nessun flusso sulla pagina:** disabilitare il pulsante Run e mostrare un messaggio chiaro (es. “Imposta un flow starting point nel prototipo per poter eseguire l’audit”).

Non sono previste opzioni “All Pages” o “Current Selection” in stile DS/A11Y: l’unità di lavoro è il **flusso**, sulla **pagina corrente**.

---

## 3. Flusso dati (plugin)

1. All’apertura del tab **Prototype**: inviare `get-flow-starting-points` → il main thread legge `figma.currentPage.flowStartingPoints` e risponde con `flow-starting-points-result` (inclusi `pageId`, `pageName` per mostrare in UI su quale pagina canvas si sta lavorando).
2. **Sincronizzazione al cambio pagina in Figma:** il main thread ascolta `figma.on('currentpagechange', …)` e invia di nuovo `flow-starting-points-result`, così la lista flussi non resta “bloccata” sulla pagina precedente se l’utente cambia pagina nel file con il plugin aperto. Le selezioni (`selectedFlowIds`) vanno filrate ai soli `nodeId` ancora presenti nel nuovo elenco.
3. **Refresh manuale:** pulsante “Refresh list” che rimanda `get-flow-starting-points` (utile se l’evento non basta o in edge case).
4. Popolare la multi-select con `{ nodeId, name }` per ogni flusso; opzione “Tutti” che seleziona tutti i `nodeId`.
5. All’avvio dell’audit: solo i flussi **selezionati** entrano in scope. Per ogni starting point selezionato si costruisce il grafo (traversale da quel frame) e si applicano le regole P-01–P-20; i finding sono etichettati con il nome flusso (`flowName`) quando possibile.
6. Se l’utente seleziona “Tutti”, l’audit considera tutti i `flowStartingPoints` della pagina.

---

## 4. Riepilogo

| Aspetto | Comportamento |
|--------|----------------|
| **Unità di scope** | Flussi (flow starting points), non pagine |
| **Fonte flussi** | `figma.currentPage.flowStartingPoints` (pagina corrente) |
| **UI** | Multi-select: uno, più o tutti i flussi |
| **Pagine** | Solo pagina corrente; no “All Pages” |
| **Costo** | Proporzionale a numero di flussi (e complessità), valori bassi — vedi COST-PROSPECT.md |
