# Generate — import Design System da Figma (specifica di allineamento)

Documento di **decisioni prodotto / UX / integrazione**. Integra la proposta sul catalogo unico (`PLUGIN-DOCUMENT-INDEX-PLAN.md`).

---

## Cosa intendiamo per “DS importati”

- Sono i **design system che l’utente sceglie di importare dai propri file Figma** (es. più progetti Figma, più DS).
- Ogni import lega **dati letti dal file** a **profilo utente / backend**: tabella Postgres `user_ds_imports` (`ds_context_index` JSONB + `ds_cache_hash`). Il plugin mantiene **cache di sessione / locale** per UX; **fonte di verità per sessioni nuove e per Generate senza cold-scan** è il backend quando la cache Figma non è disponibile.

---

## Definizione precisa di “combacia” (due livelli)

Usiamo **entrambi** gli elementi, con ruoli diversi:

| Elemento | Ruolo |
|----------|--------|
| **`file_key` Figma** | È l’**unico criterio** che decide se il documento aperto è “già associato” a un import salvato. Se il `file_key` corrente è **uguale** al `file_key` registrato su almeno un import dell’utente → ramo UI con **select + CTA**. Se **nessun** import ha quel `file_key` → **solo CTA Import** (niente select). |
| **Nome file (documento) + nome conviviale (“etichetta”)** | **Non sostituiscono** il match: servono per **mostrare** in UI elenchi chiari (select, messaggi, stato di avanzamento). Convien salvarli in backend insieme all’import (es. `figmaFileName` al momento dell’import, più `displayName` editabile in futuro se servirà). |

In sintesi: **sicurezza e branch UI = solo `file_key`**; **chiarezza per la persona = nome / etichetta** sempre disponibili per la copy.

---

## Comportamento richiesto

### Prestazioni e rilettura del catalogo

- **Generate**: si tenta prima `get-ds-context-index` con **`reuseCached: true`** (veloce). Se non c’è cache nel plugin, si usa lo **snapshot** da `GET /api/user/ds-imports/context` (stesso payload che verrà inviato come `ds_context_index` a generate). Solo se mancano entrambi si esegue la lettura pesante (`reuseCached: false`).
- **Wizard import**: resta il percorso esplicito con `reuseCached: false` per costruire/indicizzare e poi **salvare** con `PUT /api/user/ds-imports`.
- **All’ingresso in Generate**: `GET /api/user/ds-imports` aggiorna l’elenco locale; se esiste snapshot server per il `file_key` aperto, UI **catalogo pronto** anche in una nuova sessione plugin (senza rifare il wizard).

### File aperto: select o solo import

- **`file_key` combacia** con un import salvato → **select** (elenchi con nomi user-friendly; in elenco possono comparire tutti i DS importati, con **pre-selezione** dell’import il cui `file_key` è quello del file aperto) + **CTA primaria** (es. *Prepara il DS per questo file*).
- **`file_key` non combacia** → **nessuna select**, solo **CTA Import** (flusso che crea associazione / primo import da questo file).

### Durante l’import (fase task-based)

- Disabilitare le altre azioni dipendenti da Generate; **non bloccare** Figma: sotto il cofano lavoro **spezzato** con cessione al ciclo di eventi.
- In **superficie** l’utente non vede solo “caricamento…”, ma una **sequenza di compiti** dedicati all’import del DS (**regole**, **indicazioni**, **variabili**, **componenti**, ecc.): ogni schermata è un **task** con titolo chiaro, breve spiegazione del *cosa stiamo importando ora* e indicatore *passo X di N*.
- Nomi **comprensibili** ovunque.

### Affidabilità

- Importazione che **funziona** per design: validazioni anticipate, retry ove utile, assenza di race; messaggi recuperabili solo come rete di sicurezza.

---

## Privacy — testo in basso in Generate (placeholder)

*Da sostituire con copy approvata da legale / comunicazione.*

> **Informativa:** Comtra utilizza i dati del tuo design system secondo l’[inserire link policy]. I contenuti del DS **non** vengono utilizzati per addestrare modelli di intelligenza artificiale generica né per ricerca prodotto al di fuori dell’erogazione del servizio da te richiesto. [Dettagliare conservazione, durata e finalità esatte.]

---

## Dopo questa fase: collegamento a Generate esistente

Le informazioni prodotte dall’import / scarico devono **alimentare le logiche già presenti**:

- **`ds_context_index`** e **`ds_cache_hash`** nel body di `fetchGenerate` / `POST /api/agents/generate` (come oggi).
- **Stato “pronto”** in UI: prompt, allegati, invio — abilitati solo quando la cache per quel file (o per l’import selezionato) è **valida** e allineata al `file_key` corrente se applicabile.
- Nessuna seconda lettura incoerente: una sola fonte (catalogo / cache) per il Generate dello stesso contesto.

---

## Flusso Generate fino all’import (fuori dalla fase task-based)

Qui gli step sono quelli **navigazionali**: introduzione, ramo *solo Import* vs *select + CTA*, poi ingresso nel percorso **a compiti**.

| # | Esperienza (UX) | Ottimizzazione tecnica |
|---|-----------------|-------------------------|
| **1** | L’utente apre **Generate**; contesto file e sessione chiari. | Leggere `file_key` e nome documento; verificare sessione utente. |
| **2** | **Messaggio introduttivo** (prima visita o quando serve): perché preparare il DS; link “Scopri di più”. | (Opz.) flag “già visto” in locale. |
| **3** | `file_key` **non** tra gli import salvati → **solo CTA** *Importa il design system da questo file* (+ dialog se previsto). | API lista import; confronto `file_key`; branch UI. |
| **4** | `file_key` **combacia** → **select** (nomi chiari) + CTA *Prepara / aggiorna DS*; pre-selezione dell’import del file aperto. | Stesso fetch; pre-select; etichette da metadati. |
| **5** | Tap sulla CTA → si apre il **flusso di import a compiti** (sezione seguente): **non** una sola schermata “caricamento generico”. | Avvio sequenza controllata; disabilitazione azioni Generate; sotto il cofano job spezzato con yield. |
| **6** | Uscita dall’ultimo task → messaggio di successo; **Generate** (prompt, invio) **abilitato**. | Cache locale aggiornata; se primo import: persistenza backend; hash / epoch coerenti. |
| **7** | Errore → messaggio + **Riprova**; niente UI “a metà”. | Retry idempotente; timeout; nessuna cache parziale esposta come ok. |

---

## Fase import del DS: esperienza **task-based** (UI)

**Sì, è chiaro:** in questa fase l’utente percorre **compiti espliciti** legati a **cosa** si sta importando del design system, non messaggi tecnici tipo “connessione” o “lettura in corso” come unica narrazione. Ogni task è una **schermata** (o step di uno stepper) con:

- **Titolo** del compito (linguaggio metier, non gergo tecnico fine a sé stesso);
- **Breve indicazione** del perché questo blocco serve a Generate;
- **Indicatore di progresso** (*Compito 3 di 5* o equivalente);
- Stato di lavoro **solo nel contesto di quel task** (es. “Stiamo importando le variabili del file…”), eventualmente con **sotto-stato** leggero se serve, ma sempre **ancorato al tipo di contenuto**.

Ordine proposto dei **compiti in UI** (da confermare con prodotto su etichette esatte e eventuali aggiunte, es. stili o pattern):

| Task UI (ordine) | Cosa racconta all’utente | Contenuto tipico importato (riferimento) |
|------------------|---------------------------|------------------------------------------|
| **1 — Regole** | Allineamento a regole / vincoli del DS che Comtra userà in generazione. | Governance, regole di consumo del DS, criteri di validazione lato servizio o pacchetto — *allineare al modello dati reale (es. checklist, ruleset).* |
| **2 — Indicazioni** | Linee guida e indicazioni operative per interpretare il sistema sul file. | Principi, note d’uso, indicazioni di layout/accessibilità — *come sopra, da mappare al payload design-intelligence se applicabile.* |
| **3 — Variabili** | Token e variabili del file (colori, spaziature, ecc.). | Collezioni, variabili locali, riepiloghi per modalità — *estratto da Figma + normalizzazione.* |
| **4 — Componenti** | Libreria di componenti e varianti rilevanti per il contesto. | Componenti / set nel file, metadati sintetici (nomi, assi, slot) — *catalogo per Generate.* |
| **5 — (Opz.) Altri blocchi** | Esempio: stili definiti, pattern ricorrenti, glossario — **solo se** il prodotto li espone come capitoli distinti in UI. | Allineare 1:1 a sezioni già previste in documentazione design intelligence / backend. |

**Nota implementativa:** più task UI possono **condividere** la stessa opera tecnica sotto il cofano (es. una lettura Figma alimenta vari task in sequenza); l’importante è che **l’esperienza** resti **per compito di contenuto**, così l’utente capisce *cosa* sta entrando nel suo DS importato, non solo che “sta aspettando”.

### Legame con la tecnica (non è la stessa cosa degli step UI)

Per non mescolare i piani: gli **step tecnici** (pagine, API Figma, hash, POST) restano **sotto** questi task e possono essere **raggruppati** o **intercalati** in modo che ogni schermata abbia dati pronti o streaming controllato, senza bloccare Figma. Riferimento ordine motore: **`docs/DS-CONTEXT-INDEX-PERFORMANCE.md`** e catalogo unico (`PLUGIN-DOCUMENT-INDEX-PLAN.md`).

---

## Riferimenti

- Catalogo unico: `docs/PLUGIN-DOCUMENT-INDEX-PLAN.md`
- Prestazioni API Figma: `docs/DS-CONTEXT-INDEX-PERFORMANCE.md`

---

## Implementazione attuale (plugin UI, v1)

- **Solo con Design system = “Custom (Current)”** in Generate: obbligo di preparazione catalogo; altri preset libreria non mostrano il flusso.
- **Free tier:** massimo **un** DS importato (un solo `file_key` in elenco). Se l’utente è già Free e ha già importato un DS e apre **un altro file** Figma, non può importare un secondo DS: messaggio con badge **Pro** e CTA upgrade (stesso schema di altre feature Pro). Utenti **Pro** possono avere più import e vedono la **select** solo se esistono almeno **due** record salvati.
- **Persistenza import:** `localStorage` (`lib/dsImportsStorage.ts`) — lista DS importati con `fileKey`, nomi; **sessione “pronto”:** `sessionStorage` finché non si invalida o non si cambia file nella logica prevista.
- **UI:** `views/GenerateDsImport.tsx` (intro, ramo select vs solo import, wizard 4 task, footer informativa in `Generate.tsx`).
- **File:** `fileName` da `figma.root.name` incluso in `get-file-context` per etichette.
- **Backend** degli import: **non ancora implementato**. I dettagli vivono solo nel browser.

---

## Persistenza: oggi vs server (per utente)

### Oggi (v1 plugin)

- **`localStorage`** chiave `comtra-ds-imports-v1`: array JSON con `id`, `file_key`, `displayName`, `figmaFileName`, `updatedAt` (vedi `lib/dsImportsStorage.ts`).
- **Pro:** nessuna migrazione DB richiesta finché non si aggiunge il backend; i dati **non** seguono l’utente su altro dispositivo/browser e **non** sono fonte di verità lato Comtra.
- **`sessionStorage`** per “catalogo pronto in questa sessione” resta solo client.

### Prossimo passo (quando servirà il DB)

1. **Migration** (es. Postgres già usato in `auth-deploy/schema.sql`): tabella dedicata, es. `user_ds_imports`:
   - `id` (uuid), `user_id` → `users(id)`, `figma_file_key` (text, not null), `display_name`, `figma_file_name`, `last_index_hash` (opz., per invalidazione), `created_at`, `updated_at`.
   - Vincolo: per tier Free, enforcement in app + eventualmente **unique parziale** o check solo a livello API (`COUNT ≤ 1` per `user_id` dove `plan != PRO`), oppure colonna `tier_at_import` deprecata — da definire con product.
2. **API** (es. sotto `oauth-server` o route esistenti): `GET /api/.../ds-imports`, `PUT` upsert per `file_key`, `DELETE` opzionale; JWT utente come oggi.
3. **Plugin:** dopo login, **pull** lista → merge o sostituisce `localStorage`; al **fine wizard** **push** metadati (non l’intero indice gigante, solo ciò che serve a UI e match — l’indice resta cache Figma lato plugin come oggi).

Finché questi step non ci sono, la risposta a “come salviamo i dettagli per ogni utente” è: **non li salviamo sul server; solo sul client.**

---

*Specifica viva: sostituire il placeholder legale; allineare campi API (`file_key`, `displayName`, …) con il backend reale.*
