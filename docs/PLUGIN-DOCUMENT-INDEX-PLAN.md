# Proposta: catalogo unico del file Figma all’avvio

**Documento di proposta** — Comtra plugin  
*Versione per presentazione a team e stakeholder*

---

## Sintesi

Oggi, su file di design molto grandi, il plugin deve più volte “leggere tutto il file” per sapere quali componenti e variabili esistono. Questo ripete lo stesso lavoro pesante e rende l’esperienza lenta o a scatti.

**Proponiamo** di fare **una sola lettura completa e ordinata** quando il plugin si prepara al lavoro (o subito dopo modifiche importanti al file), salvare il risultato in un **catalogo unico in memoria**, e far sì che Generate, la creazione su tela e Sync **si appoggino sempre a quel catalogo**, invece di riscansionare tutto da capo.

Obiettivo: **meno attese, comportamento più prevedibile, una sola “versione della verità”** su cosa c’è nel file — almeno per le funzioni che ne hanno più bisogno.

---

## Perché ne abbiamo bisogno

1. **Il file Figma non ci consegna un elenco pronto** di componenti e token: per sapere cosa c’è, il plugin deve esplorare le pagine. Su design system grandi, questa esplorazione è costosa in tempo.
2. **Oggi alcune funzioni rifanno lo stesso tipo di esplorazione in momenti diversi** (per esempio prima di inviare dati al servizio, e di nuovo quando disegna il risultato sulla tela). Il lavoro si ripete senza necessità.
3. **Più letture separate rischiano di non coincidere**: la stessa schermata potrebbe essere descritta in modo leggermente diverso se letta in due momenti diversi, con effetti su qualità e debugging.

La proposta non elimina il costo della prima lettura, ma **lo concentra in un punto controllato** e **evita duplicazioni** per le funzioni che decidiamo di allineare.

---

## Cosa proponiamo di fare

### In parole semplici

- **Fase di preparazione** (subito dopo l’apertura del plugin o quando il file è cambiato a sufficienza): calcoliamo un **catalogo** con ciò che serve a Comtra (componenti principali, riepilogo variabili, riepilogo stili, un codice di versione del catalogo).
- **Durante l’uso**: Generate, applicazione del layout sul file e **Sync** (confronto con Storybook) **non ricostruiscono** il catalogo da zero se è ancora valido; leggono dal catalogo o lo aggiornano solo quando il file è cambiato.
- **In interfaccia** (dove serve): indicatori chiari del tipo *“Catalogo in aggiornamento…”* / *“Pronto”*, così l’utente capisce perché un’azione aspetta.

Il lavoro può essere **spezzato in più passaggi brevi** (una pagina alla volta, poi variabili, ecc.) così l’interfaccia resta più fluida durante la preparazione.

### Principi

| Principio | Significato |
|-----------|-------------|
| **Una fonte** | Un solo catalogo aggiornato per le funzioni coperte dalla proposta. |
| **Aggiornamento quando serve** | Se il file cambia, il catalogo viene aggiornato (con regole chiare, per esempio dopo una pausa nelle modifiche). |
| **Non obbligare tutto il prodotto** | Alcune aree del plugin restano com’è oggi se già lavorano bene con logiche diverse (vedi tabella sotto). |

---

## Dove si applica e dove no

Per **contenere costi e rischi**, proponiamo di **entrare subito** solo dove il beneficio è chiaro; il resto **resta fuori** dalla prima release di questa iniziativa.

| Area del prodotto | Entra nella prima fase? | Perché |
|-------------------|-------------------------|--------|
| **Generazione schermate (Generate) e creazione su tela** | **Sì** | È dove oggi si ripete di più la stessa lettura pesante del file. |
| **Code — Sync (Storybook)** | **Sì** | Flusso complesso: avere lo stesso catalogo usato da Generate riduce errori e lavoro doppio verso il backend. |
| **UX Audit** | **No** | Percorso e obiettivi diversi; non dipende da questo catalogo. |
| **Prototipo** | **No** | Si concentra su pagine e collegamenti, non sull’inventario globale dei componenti del file. |
| **Code — Tokens** | **No, per ora** | Mantiene il suo flusso di export; eventualmente si riallinea in seguito se costa poco. |
| **Code — Target** e analisi su porzioni di schermo | **No / solo marginale** | Resta l’analisi dedicata alla selezione o alla pagina; al massimo si evita di ricaricare tutte le pagine due volte, senza mescolare i dati. |
| **Contrasto / touch su singoli elementi** | **Opzionale, dopo** | Lavoro mirato; si può valutare più avanti se sfruttare il catalogo variabili. |

---

## Benefici attesi

- **Prestazioni**: meno attese ripetute su file grandi, soprattutto dopo il primo catalogo valido.
- **Affidabilità**: Generate e Sync ragionano sugli stessi riferimenti al design system nel file.
- **Manutenzione**: un solo posto da far evolvere quando cambiano le regole di “cosa leggiamo dal file”.
- **Esperienza utente**: stati chiari (“in preparazione” vs “pronto”) invece di sensazione di blocco senza spiegazione.

---

## Attuazione (ordine suggerito)

1. **Catalogo unico** — Implementare la preparazione e l’aggiornamento del catalogo, con invalidazione quando il file cambia.
2. **Creazione su tela** — Far cessare la doppia esplorazione completa del file; usare il catalogo per nomi e variabili dove oggi si ricerca di nuovo tutto.
3. **Richiesta dati per Generate** — Allineare l’invio al servizio al catalogo già calcolato quando possibile.
4. **Sync** — Far pervenire al backend le stesse informazioni di catalogo (o coerenti con quelle di Generate), così confronto e generazione non divergono.
5. **Interfaccia** — Messaggi e, dove necessario, abilitazione pulsanti legati allo stato del catalogo.

*Le attività tecniche possono essere suddivise in più collaborazioni (pull request) nello stesso ordine logico.*

---

## Decisioni da prendere insieme

- **Quanto deve essere “completo” il catalogo interno** rispetto a quanto inviamo oggi al servizio di intelligenza artificiale (per esempio limiti al numero di componenti nel messaggio al server): catalogo interno ampio e invio ancora ridotto, oppure tutto allineato agli stessi limiti?
- **Se e quando salvare il catalogo tra una sessione e l’altra** sul dispositivo utente, con i limiti di spazio previsti da Figma — utile per file stabili, da valutare in una seconda fase.
- **Soglia di “file cambiato”**: dopo quante modifiche o dopo quanto tempo aggiorniamo il catalogo automaticamente (per non essere sempre in aggiornamento e per non servire dati vecchi).

---

## Come misureremo il successo

- Su un file di riferimento grande: **una sola** esplorazione completa dei componenti per “versione coerente” del file, invece di più esplorazioni identiche nello stesso flusso.
- **Tempo misurabile** dalla preparazione del catalogo al stato “pronto”.
- **Feedback qualitativo** su Sync e Generate: meno incongruenze tra ciò che il servizio sa del file e ciò che poi viene disegnato.

---

## Nota per il team di sviluppo

Per dettagli sulle API Figma, ottimizzazioni possibili e riferimenti ai file sorgente, vedere anche **`docs/DS-CONTEXT-INDEX-PERFORMANCE.md`**.

Per **Generate**, import DS da file Figma dell’utente, regole su file key / select / caricamento / privacy: **`docs/GENERATE-DS-IMPORT-SPEC.md`**.

---

*Proposta di indirizzo prodotto e architettura. Implementazione soggetta a priorità di roadmap e risorse.*
