# DS Context Index — performance (primo build, file grandi)

Documento di **ricerca e decisioni** prima di modifiche invasive. Obiettivo: il **primo** `get-ds-context-index` dopo apertura plugin (o dopo modifiche al file) resta il collo di bottiglia su **design system molto grandi**.

---

## 1. Cosa fa oggi il plugin

File: `ds-context-index.ts`.

1. `loadAllPagesAsync` (e per pagina `loadAsync` dove serve per `documentAccess: "dynamic-page"`).
2. Per **ogni** `PageNode`: `findAll` con predicato che tiene solo `COMPONENT` e `COMPONENT_SET` (attraversa **tutto** il sottoalbero della pagina).
3. In parallelo: `getLocalVariablesAsync`, `getLocalVariableCollectionsAsync`, `getLocalPaintStylesAsync`, `getLocalTextStylesAsync`, `getLocalEffectStylesAsync`.
4. Ordina, tronca a `MAX_COMPONENTS_IN_INDEX` (500), riassume ogni componente (property definitions, slot hints, assi variante).
5. Hash SHA-256 (o fallback) sul corpo canonico.

Già presente nel codice (non toglie il costo del **primo** passo, ma aiuta dopo):

- Riuso cache se `docEpoch` non è cambiato (`reuseCached` da UI).
- `await` tra pagine durante `findAll` (cede il thread; non riduce il lavoro totale).
- Debounce su `documentchange` + sospensione durante `executeActionPlanOnCanvas`.

---

## 2. Perché il primo passo fa male

| Voce | Note |
|------|------|
| **Traversal** | Un `findAll` per pagina visita il grafo dei nodi; in file con molte pagine, istanze annidate e varianti, il costo CPU sul **main thread** cresce molto. |
| **API sincrone** | Il callback di `findAll` è sincrono; Figma non offre «stream» o paginazione dell’albero. |
| **Variabili / stili** | `getLocal*Async` su file enterprise possono restituire liste molto lunghe (oggi i **nomi** variabile sono troncati a 1500). |
| **Niente indice incrementale** | L’API plugin non espone un «catalogo componenti» già materializzato: l’unico modo affidabile per «tutti i master nel file» è visitare le pagine (o equivalente). |

---

## 3. Cosa dice la documentazione Figma (evidence-based)

### 3.1 `findAllWithCriteria` vs `findAll`

- Documentazione: [findAllWithCriteria](https://www.figma.com/plugin-docs/api/properties/nodes-findallwithcriteria/).
- Stesso obiettivo del nostro caso: esempio ufficiale con `types: ['COMPONENT', 'COMPONENT_SET']` sulla pagina corrente.
- Testo esplicito: ricerca **più veloce ma più limitata** rispetto a `findAll`; combinabile con `skipInvisibleInstanceChildren` per guadagni molto grandi su documenti enormi.

**Implicazione per Comtra:** sostituire `page.findAll((n) => …)` con  
`page.findAllWithCriteria({ types: ['COMPONENT', 'COMPONENT_SET'] })` è la modifica **più citata** dalla piattaforma per accelerare traversal sui tipi; va validata sui vostri file real (edge case segnalati in community per `findAllWithCriteria` sotto certi nodi).

### 3.2 `figma.skipInvisibleInstanceChildren`

- Documentazione: [skipInvisibleInstanceChildren](https://www.figma.com/plugin-docs/api/properties/figma-skipinvisibleinstancechildren/).
- Default in Figma normale: `false`; in Dev Mode: `true`.
- Effetto: traversal (`children`, `findAll`, `findAllWithCriteria`) **salta** nodi invisibili dentro **istanze** → meno nodi visitati.
- **Trade-off importante:** `getNodeById` / `getNodeByIdAsync` può restituire `null` per id che puntano a nodi «nascosti» in istanze; accesso a proprietà di nodi invisibili può lanciare.

**Implicazione per Comtra:** per **solo** la fase di costruzione dell’indice DS si può valutare `skipInvisibleInstanceChildren = true` in un blocco `try/finally`, ripristinando il valore precedente — **se** il resto del plugin non dipende dal vedere quei nodi nello stesso tick (auditing profondo, fix contrasto, ecc.). Richiede inventario degli handler che usano `getNodeById*` su sottoalberi di istanze.

### 3.3 `documentAccess: "dynamic-page"`

Manifest: già `"documentAccess": "dynamic-page"`. Per `PageNode`, la doc richiede `loadAsync` prima di traversal: già allineati in `collectAllLocalComponents`.

---

## 4. Leve di prodotto (ordine suggerito per discussione)

1. **`findAllWithCriteria`** al posto di `findAll` per COMPONENT / COMPONENT_SET — basso rischio semantico per l’indice; allineato alla doc Figma.
2. **`skipInvisibleInstanceChildren` durante solo il build dell’indice** — alto potenziale guadagno; richiede verifica di non rompere altri flussi nello stesso `code.js`.
3. **Warm-up in background** dopo `initDsContextIndexLifecycle` — migliora percezione («primo click Generate» non paga tutto); non riduce costo totale; può ancora bloccare parzialmente la UI durante il warm-up.
4. **Ridurre ciò che si manda al backend** senza perdere governance: es. campione stratificato + hash, o due livelli («summary» sempre + «full index» on-demand) — richiede cambi contratto con `app.mjs` / validator.
5. **Separare pagine «libreria»** (convenzione team: componenti solo su pagine nominate) — riduce pagine da scannerizzare; fragile se la convenzione non è rispettata.

---

## 5. Cosa questo documento **non** risolve

- Latenza **HTTP** e tempo LLM sul backend: sintomi simili («non va avanti») ma cause diverse.
- File che usano componenti **solo** da librerie collegate senza master locali: l’indice «file» resta volutamente sui master **nel file** (vedi roadmap Problem 1).

---

## 6. Prossimo passo operativo consigliato

1. Misurare in dev (log con timestamp) durata di: `loadAllPagesAsync`, loop pagine (`findAll` / dopo migrazione `findAllWithCriteria`), blocco `Promise.all` variabili/stili, hashing.
2. Applicare **una** leva alla volta: prima `findAllWithCriteria`, poi valutare `skipInvisibleInstanceChildren` con test regressione su Audit / altre feature che attraversano il documento.

*Ultimo aggiornamento: review API Figma plugin docs (findAllWithCriteria, skipInvisibleInstanceChildren) + codice `ds-context-index.ts`.*
