# Prototype Audit — Roadmap auto-fix (plugin)

Piano operativo per correzioni prototype **nel main thread** (`controller.ts`), con crediti solo su **apply riuscito**.  
Le fasi **D** e **E** stanno in **Before go live** (fine documento): non bloccano il rilascio delle fasi A–C.

---

## Fase A — Infrastruttura

### Cosa significa “messaggio dedicato” (in parole semplici)

La UI del plugin e il codice Figma **non girano nello stesso ambiente**: la UI parla con il controller tramite **messaggi** (`postMessage` / `figma.ui.onmessage`).

Oggi esiste già un messaggio **`apply-fix`**, nato per **A11Y** (contrasto con `fixPreview`, ecc.). Se ci mettiamo dentro anche logica prototype con `rule_id`, payload diversi e risposte diverse, diventa difficile da mantenere e da testare.

**Messaggio dedicato** = un **tipo di messaggio con nome suo**, ad esempio:

- `apply-proto-fix`  
  con corpo tipo: `{ rule_id: 'P-04', layerId, protoPayload: { … } }`

e risposta verso la UI tipo:

- `proto-fix-result` → `{ ok: true }` oppure `{ ok: false, error: '…' }`

**Perché conviene**

1. **Chiarezza**: leggi il codice e sai subito che è solo prototype.  
2. **Sicurezza sui crediti**: la UI consuma crediti **solo** se arriva `ok: true` (o dopo preview + conferma, come il contrasto).  
3. **Estendibilità**: ogni regola può richiedere campi diversi in `protoPayload` senza rompere `apply-fix` per DS/A11Y.

Alternativa accettabile: **un solo** `apply-fix` ma con ramo esplicito `if (msg.protoFix) { … }` e stesso contratto di risposta `ok/error` — l’importante è il **contratto** (payload + risultato), non per forza il nome del messaggio. La scelta “messaggio dedicato” è consigliata per ordine.

### Resto infrastruttura (ok come concordato)

- Arricchire le issue che hanno auto-fix con **contesto deterministico** nel payload audit (es. P-04: quale reaction / quale action / quale `destinationId` morto).  
- **Non** addebitare crediti se il controller non ha applicato nulla o ritorna errore.  
- (Opzionale) `get-proto-fix-preview` per azioni dove serve mostrare all’utente cosa cambierà prima di pagare.

---

## Fase B — Prima onda (go-live core)

| Regola | Cosa facciamo |
|--------|----------------|
| **P-04** | Rimuovere l’azione il cui `destinationId` non esiste più (serve `protoPayload` con riferimento univoco all’azione). |
| **P-17** | Riordinare le `actions` sul trigger secondo regole fisse + conferma UI. Vedi sotto *Spiegazione P-17*. |
| **P-10** | Regolare `duration` entro range; dove possibile allineare a **documentazione motion** (DS / file). Vedi *P-10 / P-11 e motion DS*. |
| **P-11** | Allineare `easing` (stesso preset per tipo di navigazione nel flusso), idealmente vs **token o doc motion** se disponibili. |

---

## Fase C — Seconda onda (sempre in scope pre-launch concordato)

| Regola | Cosa facciamo |
|--------|----------------|
| **P-08** | Rimuovere la reaction **segnalata come inadatta** (duplicato stesso trigger sullo stesso layer): non “a caso” — si elimina quella che l’audit ha marcato (es. seconda occorrenza o quella senza azioni utili). Vedi *P-08*. |
| **P-13** | Impostare scroll sul frame quando il contenuto supera i bounds e l’overflow è assente/sbagliato. Vedi *P-12 e P-13*. |
| **P-12** | Completare impostazioni overlay **dove l’API lo consente** (position, dismiss, background). Vedi *P-12 e P-13*. |

---

## Spiegazioni regole (semplice)

### P-17 — Ordine delle azioni sullo stesso trigger

Su **un solo trigger** (es. *On click*) Figma può eseguire **più azioni in sequenza**: es. *Set variable* → *Conditional* → *Navigate to*.

**Il problema:** se metti *Navigate to* **prima** di *Set variable*, il frame di destinazione si apre **prima** che la variabile sia aggiornata → il prototipo può mostrare stato sbagliato. Stesso discorso per condizioni che dipendono da una variabile appena settata.

**L’auto-fix (idea):** riordinare le azioni in un ordine **documentato** (es. prima tutti i Set variable rilevanti, poi conditional, poi navigazione/overlay).  
L’utente conferma in modale; poi il plugin riscrive l’array `actions` su quella reaction.

---

### P-10 e P-11 — Durata e easing + documentazione (design system)

- **P-10:** durate troppo corte o troppo lunghe rispetto a soglie UX (es. navigazione 200–500 ms).  
- **P-11:** nello stesso flusso, transizioni simili con easing incoerenti.

**Valore aggiunto con DS:** se nel file o in una library collegata esistono **regole di motion** (pagina “Motion”, componente guida, variabili con nomi tipo `motion-duration-*`, `motion-easing-*`, o testo strutturato), il plugin può:

1. **Rilevare** quei valori (parsing leggero o mappa convenzioni Comtra), oppure  
2. Usare un **file di config** / sezione audit-specs con tabella “Navigate → duration min/max, easing consigliato”.

L’auto-fix allora non è solo “clamp generico”, ma **allinea alla governance del team** quando la documentazione è trovabile. Se non c’è documentazione → si usano i **default numerici** del ruleset (come oggi in detection).

---

### P-08 — Duplicati sullo stesso layer

Concordato: **rimuoviamo la segnalazione “inadatta”** — cioè l’istanza duplicata che l’audit ha già identificato come problematica (stesso tipo di trigger due volte sullo stesso hotspot).  
In UI: messaggio chiaro del tipo *“Rimuoviamo la seconda interazione On click duplicata”* + conferma.  
Non si elimina a caso l’altra se non è equivalente: la logica di detection deve passare nel payload **quale** reaction index va rimossa (o quale tenere).

---

### P-12 — Overlay

Controlla i frame usati come **destinazione di “Open overlay”**: posizione overlay, sfondo, chiusura (click fuori, Close overlay, ecc.).  
**Problema tipico:** overlay senza modo chiaro di chiudere → utente bloccato.

**Auto-fix:** impostare valori **sicuri e convenzionali** dove l’API Figma lo permette (es. abilitare dismiss, impostare background semitrasparente per modali).  
Tutto ciò che è **scelta di prodotto** (modale bloccante vs dismissibile) va in conferma o resta manuale.

---

### P-13 — Scroll / overflow

Controlla i **frame** con contenuto che **esce dai bordi** ma **senza scroll** (o scroll incoerente).

**Auto-fix:** impostare `overflowDirection` (es. verticale) sul frame interessato così il contenuto è raggiungibile in prototype.  
Va validato che il frame sia quello giusto (container di contenuto, non un wrapper di tutta la pagina sbagliato).

---

## Before go live (non in scope fasi A–C)

Da fare **prima** di considerare completo il prodotto prototype-fix agli occhi dell’utente finale, ma **non** bloccante per shippare A–C.

### Fase D — Guidato / wizard

- **P-19** (e parti di **P-01**): scegliere frame di destinazione, confermare prima di creare collegamenti.  
- Costo crediti e copy dedicati (*wizard*, non “un click magico”).

### Fase E — Mai auto-fix a crediti pieni senza implementazione reale

- **P-03** (pagina senza flow start), **P-20**, advisory puri: nessun addebito per fix inesistente; UI già con `hideLayerActions` dove serve.  
- **P-05, P-06, P-07, P-09, P-14, P-15, P-16, P-18**: manuale o successiva iterazione; niente promessa “Auto-fix” finché non c’è mutazione verificata.

---

## Riferimenti codice e spec

| Cosa | Dove |
|------|------|
| Audit prototype | `controller.ts` → `runProtoAudit` |
| Apply generico oggi | `controller.ts` → `apply-fix` |
| Regole testuali | `PROTOTYPE-AUDIT-RULES.md` |
| Mappa issue globale | `audit-specs/AUTO-FIX-ISSUE-MAP.md` § Prototype |
