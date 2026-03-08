# Prototype Audit — Effort vs fidelity e quando usare la prototipazione avanzata

Documento di **consigli** basato su ricerca su problemi ricorrenti (variabili, varianti, condizioni, modalità, Design System, learnability, livello di fedeltà). Da usare per **tips in-app** (statici o generati da AI) e per contestualizzare i finding dell’audit senza sostituire le regole P-01–P-20.

---

## 1. Variabili, modalità e stati complessi (severity problema: alta)

**Problemi ricorrenti**
- Variabili + varianti + condizioni insieme sono difficili da gestire: checkbox che non si deselezionano, show/hide incoerente, logiche che funzionano solo al primo click.
- Modalità (es. light/dark) nei prototipi spesso non si comportano come atteso; local variables non persistono lungo il flusso.
- Incertezza diffusa: “È un mio errore o un limite di Figma?” quando si vogliono aggiornare stringhe/stati in base ai click.

**Consigli da dare**
- **Quando usare variabili/condizioni:** per test su flussi con pochi rami (es. form con validazione, wizard a 2–3 step). Evitare di costruire “mini-app” solo in Figma.
- **Quando evitare:** se l’obiettivo del test è “capire se il flusso è comprensibile”, un prototipo lineare con frame collegati è più stabile e veloce da iterare.
- **Dark mode / modalità:** se non è focus del test, preferire un solo mode; altrimenti testare il mode in un file/proto dedicato per ridurre bug in sessione.

---

## 2. Prototipi “avanzati” vs effort necessario (severity processo: alta)

**Problemi ricorrenti**
- Richieste di prototipi iper-fedeli (quasi-app) percepite come sproporzionate rispetto al valore per la ricerca.
- Sweet spot: **più cicli di test a fedeltà inferiore** sono spesso meglio di una sola ricerca con un proto super-complesso che assorbe settimane.
- Alcuni designer tornano a prototipi “dummy” (frame collegati senza variabili) perché più predicibili e stabili.

**Consigli da dare**
- **Quando ha senso investire in proto avanzato:** test su task critici (checkout, onboarding) dove il feedback contestuale (es. messaggio di errore dopo submit) è essenziale; oppure demo per stakeholder che devono “vedere” il comportamento.
- **Quando preferire proto semplice:** esplorazione early (più test, più iterazioni); test su navigazione e gerarchia; quando il team ha poco tempo di manutenzione. Consiglio esplicito: “Preferisci più round di test a fedeltà minore invece di un solo round con un proto molto complesso.”
- **Se l’audit segnala molte issue su variabili/condizioni (P-15, P-16, P-17):** suggerire di valutare se quella complessità è davvero necessaria per gli obiettivi del test; in caso contrario, semplificare (meno variabili, flussi più lineari) per ridurre bug e tempo di build.

---

## 3. Allineamento con Design System e riuso (severity: media-alta)

**Problemi ricorrenti**
- Per far funzionare certi comportamenti si staccano istanze o si creano “versioni speciali” per il prototyping, contraddicendo il riuso.
- Conflitto: restare aderenti al DS (accettando limiti) vs rompere il sistema per simulare casi avanzati. Doppia “source of truth” (DS vs componenti “truccati” per il proto).

**Consigli da dare**
- **Quando tenere il DS pulito:** prototipi per user test e handoff; evitare di duplicare componenti solo per il proto.
- **Se l’audit segnala P-14 (Interactive Component) o pattern “staccare istanze”:** preferire varianti e Change to sul main component; se Figma non permette il caso desiderato, documentare il limite e considerare un proto semplificato invece di fork del DS.

---

## 4. Comprensibilità e learnability delle feature avanzate (severity: media)

**Problemi ricorrenti**
- Curva di apprendimento ripida per variabili/condizioni; richiesta di “esempi migliori” per casi reali, non solo da documentazione.
- La trasposizione su progetti reali porta spesso a edge case non coperti dagli esempi.

**Consigli da dare**
- **Quando introdurre variabili/condizioni:** dopo aver padroneggiato flussi lineari e overlay; iniziare con un solo flusso (es. un form) e un numero limitato di variabili.
- **Riferimenti:** documentazione Figma “Advanced prototyping with variables” e “Multiple actions and conditionals”; usare l’audit (P-15, P-16, P-17) come checklist per coerenza (variabili definite/lette, conditionals con entrambi i branch).

---

## 5. Quale livello di fedeltà serve per i test? (severity: media-alta)

**Problemi ricorrenti**
- Discussioni su quando abbia senso un prototipo “quasi-prod” in Figma vs flussi lineari facili da mantenere e testare più spesso.
- Best practice (UXtweak, Helio, ecc.): la qualità dell’insight dipende più da **compiti chiari, buona moderazione e iterazione** che dal fatto che il prototipo simuli ogni logica back-end.

**Consigli da dare**
- **Obiettivo del test prima della fedeltà:** definire cosa si vuole apprendere (navigazione? comprensione di un messaggio? percezione di un flusso?). Se la risposta non richiede stati dinamici complessi, un proto lineare è sufficiente.
- **Iterazione > fedeltà estrema:** “Figma ti permette di fare molto; autolimitarsi può migliorare il processo di ricerca (più cicli, meno manutenzione).”
- **Se l’audit mostra molti dead-end (P-01), orphan (P-02), o flussi poco chiari (P-18):** prioritizzare la “navigabilità” e la chiarezza del flusso rispetto all’aggiungere più variabili o condizioni.

---

## Uso in COMTRA

- **Tips statici:** in fase di report Prototype Audit, mostrare 1–2 consigli da questo documento in base al summary (es. “Hai molte issue su variabili/condizioni → valuta se la complessità è necessaria per il tuo obiettivo di test”).
- **Tips opzionali con AI:** se si usa un LLM per un blocco “Prototype health tips”, fornire in prompt: summary dell’audit (conteggi per categoria, score) + estratti da questo file; risposta breve (2–4 frasi), tono costruttivo, senza sostituire i suggested fix delle regole.
