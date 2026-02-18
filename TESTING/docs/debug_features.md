# Documentazione Sistema di Debug & Inspector

Questa funzionalità è stata introdotta per accelerare lo sviluppo e la manutenzione, permettendo agli sviluppatori di identificare immediatamente quale file o componente React è responsabile di uno specifico elemento visivo nell'interfaccia.

## 1. Architettura Tecnica

Il sistema si basa su due pilastri principali: marcatura del DOM e un Componente Ispettore.

### A. Marcatura del DOM (`data-component`)
Invece di affidarci a nomi di classi CSS (che sono spesso generati dinamicamente o condivisi) o ID, abbiamo utilizzato un attributo dati standard HTML5: `data-component`.

Questo approccio ha diversi vantaggi:
1. **Non-invasivo**: Non altera lo styling o il layout.
2. **Semantico**: Descrive *cosa* è l'elemento, non come appare.
3. **Performante**: Facile da interrogare per il browser tramite `querySelector` o traversing del DOM.

**Esempio di implementazione:**
```tsx
<button 
  data-component="Audit: Start Scan Button" // <--- L'identificatore
  className="..."
>
  Start
</button>
```

### B. Il Componente `DebugInspector.tsx`
Questo componente agisce come un layer trasparente sopra l'applicazione ("Overlay").

1. **Stato Attivo/Disattivo**: Gestito da un booleano locale. Quando è spento, rimuove completamente i listener per non impattare le performance.
2. **Hover Detection**: Utilizza `document.elementFromPoint` o listener `mousemove` per rilevare l'elemento sotto il cursore. Cerca ricorsivamente verso l'alto (`closest('[data-component]')`) per trovare l'elemento marcato più vicino.
3. **Calcolo Geometrico**: Usa `getBoundingClientRect()` per ottenere le coordinate esatte (top, left, width, height) dell'elemento e disegna un bordo blu tratteggiato sopra di esso.
4. **Intercettazione Click**: Utilizza un listener in fase di cattura (`capture: true`) per bloccare l'azione nativa del click (es. non clicca davvero il bottone) e innescare invece la copia negli appunti.

---

## 2. Criteri di Naming e Granularità

Per rendere il debug utile, la granularità deve essere elevata. Non basta sapere che siamo nella "Card", dobbiamo sapere se stiamo puntando al "Titolo della Card" o alla "Icona della Card".

### Formato di Naming
Seguiamo lo schema: `Contesto: Nome Elemento Specifico`

*   **Contesto**: Solitamente il nome della Vista (`Audit`, `Code`, `Generate`) o del Componente contenitore (`Layout`, `NavBar`).
*   **Nome Elemento**: Una descrizione funzionale dell'elemento.

### Logica di Selezione (Quali elementi marcare?)
La regola applicata è la **"Leaf Node Priority" (Priorità ai Nodi Foglia)**:

1.  **Macro-Contenitori**: Le card principali e le sezioni hanno un tag per capire l'area generale.
    *   *Es:* `Audit: Welcome Card`
2.  **Elementi Interattivi**: Ogni bottone, link o input DEVE avere un tag.
    *   *Es:* `Generate: Action Button`
3.  **Testi Informativi**: Anche i paragrafi, le etichette e i titoli sono marcati separatamente. Questo è cruciale per modificare copy specifici senza cercare nel codice.
    *   *Es:* `Code: Tokens Info Alert`, `Layout: Brand Name`.
4.  **Stati Transitori**: Elementi che appaiono solo temporaneamente (Loading bars, Modali) sono marcati per poterli identificare durante le animazioni.
    *   *Es:* `Scanning: Bar Fill`.

---

## 3. Isolamento dell'Ambiente (Test vs Prod)

È fondamentale che questo strumento non appaia mai agli utenti finali.

1.  **Importazione Condizionale**: Il componente `<DebugInspector />` è importato e renderizzato **SOLO** nel file `TESTING/App.tsx`.
2.  **Esclusione da PROD**: Il file `PROD/App.tsx` non contiene alcun riferimento a questo componente né agli attributi `data-component` (anche se gli attributi HTML sono innocui in produzione, manteniamo il codice pulito).
3.  **Indicatore Visivo**: Nell'ambiente di test è presente un badge fisso "TEST ENV" in alto a destra per ricordare allo sviluppatore che sta operando in un ambiente sandboxato con funzionalità di debug attive.

## 4. Flusso di Utilizzo per lo Sviluppatore

1.  Aprire l'ambiente **TESTING**.
2.  Cliccare il pulsante **"🐞 Inspect"** in alto a destra.
3.  Passare il mouse sugli elementi: apparirà un riquadro blu con il nome del componente.
4.  Cliccare su un elemento:
    *   L'azione normale (es. navigazione) viene bloccata.
    *   Il nome (es. `[EDIT REQUEST] File: Audit: Welcome Card`) viene copiato negli appunti.
    *   Appare un toast di conferma "Copied".
5.  Incollare il nome nella richiesta all'AI o nell'IDE per trovare immediatamente il file da modificare.
