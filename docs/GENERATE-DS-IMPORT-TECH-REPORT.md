# Generate — DS Import: Resoconto tecnico performance fix

COMTRA by Ben & Cordiska — Aprile 2026
Documento per handoff tecnico interno

---

## 1. Come deve funzionare il flusso

Apertura tab Generate con DS personalizzato:

- Il plugin controlla se per questo file_key esiste un record su Supabase con ds_context_index non vuoto
- Se sì: il DS compare nella select tra le opzioni disponibili (insieme ai DS pubblici). CTA secondaria "Update catalog"
- Se no (record assente o blob vuoto): compare CTA primaria "Import your design system"
- L'utente avvia il wizard (rules → tokens → components)
- Al termine: PUT su Supabase con ds_context_index completo + scrittura metadati leggeri in clientStorage
- Il DS appare nella select — l'utente può selezionarlo e avviare la generazione

---

## 2. Architettura storage — tre layer

### Layer 1 — figma.clientStorage (locale, device)

Contiene solo metadati leggeri dell'import, mai il blob completo. Limite ufficiale 5MB per plugin — rispettato facilmente perché i metadati sono meno di 1KB per file (file_key, data import, component_count, token_count, nome DS).

Scopo: fast-path per riconoscere se il DS è già stato importato su questo device, senza round-trip al server. Non usato per la generazione — quella usa Supabase direttamente.

Struttura metadati salvati:

- file_key
- imported_at (ISO timestamp)
- ds_cache_hash
- component_count
- token_count
- name (nome del DS)

### Layer 2 — Supabase user_ds_imports (account, cloud)

Source of truth del ds_context_index completo. Contiene il blob JSON con token, variabili e componenti. Accessibile da qualsiasi device con lo stesso account. Alimentato dal wizard via PUT /api/user/ds-imports. Rimane invariato rispetto all'architettura attuale.

Endpoint di riferimento:

- GET /api/user/ds-imports — lista import dell'utente (senza blob)
- GET /api/user/ds-imports/context?file_key=X — ds_context_index per un file
- PUT /api/user/ds-imports — upsert ds_context_index

Regola critica: ds_context_index è considerato usabile solo se è un oggetto non-array con almeno una chiave. null, {}, [] sono trattati come assenza di snapshot.

### Layer 3 — Repository GitHub utente (futuro)

Storico versionato multi-progetto. Il blob Supabase viene committato sulla repo dell'utente in formato ds_package (manifest.json, tokens.json, rules.json, components.json). Trigger manuale per v1, automatico in v2+. Richiede OAuth GitHub separato — da pianificare dopo stabilizzazione Layer 1 e 2.

---

## 3. Causa radice del freeze

Il main thread Figma è single-threaded e sandbox. Qualsiasi operazione sincrona lunga blocca completamente l'intera UI di Figma — non solo il plugin, ma la canvas stessa. Fonte: Figma Plugin API Docs, developers.figma.com/docs/plugins/how-plugins-run/

Le correzioni precedenti (probe, snapshot validation, sync post-PUT) erano sul layer applicativo. Il freeze opera un layer sotto.

Quattro problemi specifici identificati:

**Problema A — skipInvisibleInstanceChildren = false (default Figma Design)**

Il flag è false per default in Figma Design (al contrario di Dev Mode dove è true). Su file con molte varianti e istanze invisibili, il traversal rallenta drasticamente. La Figma API documenta che abilitarlo può rendere il traversal "several times faster".

**Problema B — findAll generico invece di findAllWithCriteria**

findAll con callback generico traversa ogni nodo dell'albero prima di applicare il filtro. findAllWithCriteria con types specificati usa un algoritmo nativo ottimizzato — significativamente più veloce su DS con molti componenti.

**Problema C — API sincrone deprecate per variabili**

Le API sincrone getLocalVariables() e getLocalVariableCollections() sono deprecate da Figma (Update 87, febbraio 2024). Le versioni sincrone bloccano il main thread durante il fetch. Vanno sostituite con le versioni Async equivalenti.

**Problema D — Nessun yield tra pagine durante lo scan componenti**

Lo scan attraversa l'intero documento in un singolo blocco sincrono. Su file con 500+ componenti distribuiti su più pagine, questo può durare 10-30 secondi senza mai cedere il controllo al main thread. Documentato dalla Figma community anche usando findAllWithCriteria su file di design system reali.

---

## 4. Piano interventi — ordinati per priorità

### Intervento 1 — CRITICO — skipInvisibleInstanceChildren

Da aggiungere all'inizio di ogni handler di scan in controller.ts, prima di qualsiasi operazione di traversal. Non impatta la correttezza dell'indice DS: i nodi invisibili nelle istanze non sono componenti usabili per la generazione.

File da modificare: controller.ts — tutti gli handler che gestiscono le fasi rules, tokens, components.

### Intervento 2 — CRITICO — Sostituzione findAll con findAllWithCriteria

In ds-context-index.ts, sostituire ogni findAll generico con findAllWithCriteria tipizzato per COMPONENT e COMPONENT_SET.

File da modificare: ds-context-index.ts — tutti i traversal di componenti.

### Intervento 3 — CRITICO — Async API per variabili e stili

In ds-context-index.ts, sostituire tutte le chiamate sincrone deprecate:

- getLocalVariables() → getLocalVariablesAsync()
- getLocalVariableCollections() → getLocalVariableCollectionsAsync()
- getLocalPaintStyles() → getLocalPaintStylesAsync()
- getLocalTextStyles() → getLocalTextStylesAsync()

File da modificare: ds-context-index.ts — fase tokens.

### Intervento 4 — ALTO — Chunking per pagina con yield

Lo scan dei componenti va distribuito pagina per pagina, con una pausa programmata tra ogni pagina (setTimeout(resolve, 0)) per cedere il main thread. Ogni pausa permette a Figma di aggiornare la UI e rispondere ai click. Ad ogni pagina completata, inviare un messaggio ds-import-progress alla UI con nome pagina e conteggio componenti trovati.

File da modificare: ds-context-index.ts — fase components. GenerateDsImport.tsx — gestione progress bar lineare nello step 3.

### Intervento 5 — ALTO — PUT asincrono disaccoppiato dalla transizione UI

Il PUT al server non deve avvenire nel tick di chiusura del wizard. La sequenza corretta è:

1. Aggiorna stato locale (sessionStorage + localStorage)
2. Scrittura metadati leggeri in figma.clientStorage
3. Chiudi wizard — UI torna subito attiva, DS compare nella select
4. PUT server in background — non blocca l'utente
5. Se PUT fallisce: toast non-bloccante, il DS resta usabile localmente

File da modificare: views/GenerateDsImport.tsx — handler confirm dell'ultimo step.

---

## 5. Logica di retrieve — aperture successive

A ogni apertura del tab Generate con DS personalizzato, il plugin segue questo ordine:

1. Controlla figma.clientStorage per metadati del file_key corrente — se presente: mostra DS nella select subito, zero latenza di rete
2. Se assente in clientStorage: controlla Supabase via GET /api/user/ds-imports/context — se presente: aggiorna clientStorage, mostra DS nella select
3. Se assente anche su Supabase: mostra CTA "Import your design system", avvia wizard

Il plugin non ha mai bisogno del blob completo in locale. Il blob viene usato solo dal backend al momento della generazione.

---

## 6. File da modificare — indice operativo

| Priorità | File | Modifica |
|---|---|---|
| Critica | controller.ts | skipInvisibleInstanceChildren = true all'inizio di ogni handler scan |
| Critica | ds-context-index.ts | findAll → findAllWithCriteria per COMPONENT e COMPONENT_SET |
| Critica | ds-context-index.ts | API sincrone → versioni Async per variabili e stili |
| Critica | ds-context-index.ts | Chunking per pagina con yield tra ogni pagina del loop |
| Alta | views/GenerateDsImport.tsx | Disaccoppiare PUT dal tick di chiusura wizard. Scrittura metadati in clientStorage |
| Alta | views/GenerateDsImport.tsx | Gestire ds-import-progress: progress bar lineare step 3 con pagina corrente + count |
| Alta | views/Generate.tsx | Fast-path clientStorage nel useEffect prima del probe Supabase |
| Media | lib/dsImportsStorage.ts | Aggiungere readDsMeta(fileKey) e writeDsMeta(fileKey, meta) per clientStorage |

---

## 7. Criterio di successo operativo

Il flusso è considerato funzionante quando tutti questi test passano:

1. Completare il wizard su un file DS grande (500+ componenti) senza freeze visibile agli step 3-4-5. Il plugin rimane responsivo durante lo scan (progress bar si aggiorna, click funzionano)
2. Al termine del wizard, il DS compare nella select entro 500ms dalla fine dello scan — prima che il PUT al server sia completato
3. Chiudere e riaprire il plugin sullo stesso file: Generate mostra il DS nella select senza rieseguire il wizard (fast-path clientStorage)
4. Aprire il plugin su un secondo device con lo stesso account: Generate recupera il DS da Supabase e aggiorna il clientStorage locale
5. npm run verify-ds-import con il file_key del DS importato restituisce has usable ds_context_index: true

Se uno dei test fallisce la diagnosi è localizzabile: (1) scan/chunking, (2) disaccoppiamento PUT, (3) clientStorage fast-path, (4) Supabase retrieve, (5) PUT/blob vuoto.

---

## 8. Rischi residui

**DS con 1000+ componenti su file molto grandi** — il chunking cede il main thread ma non riduce il tempo totale di scan. Su file estremi, valutare un cap intelligente: componenti con varianti prima, resto cappato a 500. Probabilità: media.

**Race condition PUT → GET context** — PUT seguito immediatamente da GET potrebbe in teoria vedere replica in ritardo. Su Postgres singolo Supabase raramente avviene, mitigato dal retry automatico al prossimo open. Probabilità: molto bassa.

**401 JWT scaduto durante PUT in background** — l'utente non vede l'errore in modo bloccante. Il toast di fallimento è visibile ma non interrompe il flusso. Al prossimo open, Supabase non ha lo snapshot e il wizard si riattiva. Probabilità: bassa.

---

COMTRA by Ben & Cordiska — Sviluppo: team interno
