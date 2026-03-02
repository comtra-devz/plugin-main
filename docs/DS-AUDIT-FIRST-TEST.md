# Primi test — Design System Audit su kimi.com

Guida operativa per fare il **primo test** dell’agente DS Audit **senza scrivere codice**: usi la chat su kimi.com, incolli il system prompt e un JSON di file, e verifichi che la risposta sia un JSON valido con `issues`.  
Dopo che questo funziona, si potrà implementare l’endpoint e il plugin.

---

## Di cosa stiamo parlando: il “JSON del file”

Il **JSON del file** è la **rappresentazione completa del file Figma in formato testo (JSON)**: tutti i nodi (pagine, frame, componenti, rettangoli, testi…), i colori, gli stili, i nomi, le posizioni. È esattamente quello che l’API Figma restituisce quando chiedi “dammi il contenuto di questo file”.

Per il test su kimi.com dobbiamo **dare a Kimi questo blocco di dati** così può “leggere” il file e applicare le regole di audit (naming, colori hardcoded, ecc.). Quindi nel secondo messaggio incollerai o (A) il JSON di un file reale che hai ottenuto dal plugin/backend, oppure (B) un **JSON minimo di esempio** (un file “finto” piccolo) solo per verificare che Kimi risponda nel formato giusto. Vedi sotto come ottenere l’uno o l’altro.

---

## Cosa ti serve

- Account su **kimi.com** (stesso che usi per Moonshot).
- Il file **auth-deploy/prompts/ds-audit-system.md** (è già in repo): da lì copi il system prompt.
- Un **JSON** da incollare nel secondo messaggio: o quello di un file reale (Opzione A) o il minimo di esempio (Opzione B).

---

## Step 1 — Copia il system prompt

1. Apri **auth-deploy/prompts/ds-audit-system.md** nel tuo editor.
2. Seleziona **tutto** il contenuto (da “You are a design system auditor” fino alla fine).
3. Copia (Cmd+C / Ctrl+C).

Questo testo è quello che invii come **primo messaggio** nella chat.

---

## Step 2 — Ottieni un JSON da incollare nel secondo messaggio

Devi avere un blocco di testo JSON da dare a Kimi. Due modi:

**Export dal plugin (consigliato):** Apri Figma con un file salvato → plugin Comtra → tab Design System → clicca **"Export file JSON for Kimi"** (sotto Scan) o **"Export JSON"** (dopo lo scan). Il JSON viene copiato negli appunti. Per file molto complessi, se Kimi dà timeout, apri il JSON in un editor e tieni solo `name`, `document` e 1–2 pagine con i loro `children`.

### Opzione A: JSON di un file Figma reale (se hai plugin + backend attivi)

In questo caso il “JSON del file” lo **ottieni dalla risposta del backend** quando il plugin chiede il contenuto del file:

1. Apri **Figma** e un **file salvato** (non “untitled”; deve essere un file con un nome e un ID, es. “My Design System”).
2. Apri il **plugin Comtra** su quel file (il plugin gira nel browser, dentro Figma).
3. Fai l’azione che **scansiona il file** (es. **Scan** o il bottone che invia il file al backend). Questo fa una richiesta al tuo backend; il backend chiama l’API Figma, riceve il JSON del file e te lo restituisce.
4. Apri gli **strumenti sviluppatore** del browser: **F12** (o tasto destro → Ispeziona) → tab **Network** (Rete).
5. Nella lista delle richieste cerca quella che corrisponde al tuo backend, es. **`figma/file`** o **`api/figma/file`** (nome può variare). Cliccaci sopra.
6. Nella finestra di dettaglio apri **Response** (Risposta). Vedrai un **testo lungo in JSON** (inizia con `{` e contiene `"document"`, `"name"`, `"components"`, ecc.). **Seleziona tutto** quel testo e **copia** (Cmd+C / Ctrl+C). Quello è il “JSON del file”: è il contenuto del tuo file Figma in formato JSON.

Se il testo è enorme (> ~100–150 KB), puoi aprirlo in un editor di testo, tenere solo la parte iniziale (es. `name`, `document` e la prima pagina con i suoi `children`) e cancellare il resto, così il messaggio a Kimi resta più leggero.

**Se non trovi la richiesta — guida passo-passo:**

1. **Quando parte la chiamata:** la richiesta `POST .../api/figma/file` viene fatta **dopo** che lo Scan ha finito e tu **confermi** (es. clic sul bottone giallo **"CALCULATION RESULTS"** o su Avanti/Conferma). Se hai già fatto così, la richiesta è già nella lista; altrimenti apri Network, fai di nuovo Scan e conferma.
2. **Filtra la lista:** nel campo di ricerca della tab Network (icona lente, sopra la tabella) scrivi **figma/file** (così restano solo le richieste a quell’endpoint). Nella colonna **Name** la richiesta giusta si chiama **file** (Chrome mostra l’ultimo pezzo del path). Cercare solo “file” darebbe troppi risultati; “figma/file” è il filtro giusto.
3. **Scegli la richiesta:** clicca sulla riga che in **Name** ha **file** e il cui URL (visibile passando col mouse o nel tab Headers) contiene **api/figma/file**. Controlla che **Status** sia **200** (se è 403/401/500 la risposta non è il JSON del file ma un errore).
4. **Apri il dettaglio:** clicca **una volta** su quella riga. A destra (o sotto) si apre il pannello con i tab **Headers**, **Preview**, **Response**.
5. **Vai al JSON:** clicca sul tab **Response** (o "Risposta"). Vedrai il corpo della risposta: testo che inizia con `{` e contiene `"name"`, `"document"`, `"components"`. Seleziona tutto (Cmd+A) e copia (Cmd+C).

**Se non c’è nessun risultato con "figma/file"** la richiesta probabilmente non parte. Prima controlla la **Console**: se vedi **500** da `auth.comtra.dev` su **`/api/credits`** o **`/api/trophies`**, il backend sta fallendo su quelle route. In quel caso il plugin, dopo Conferma, non arriva a chiamare `/api/figma/file` (il flusso si interrompe). Va sistemato il backend (log, DB, env) finché credits/trophies non rispondono 200; poi riprova Scan → Conferma e cerca di nuovo la richiesta figma/file.

In assenza di 500, controlla queste **tre condizioni** (tutte obbligatorie):

1. **File Figma con key** — Figma in genere fa auto-save; se la scheda ha un nome e l’URL è tipo `figma.com/design/xxxxx/...` il file ha già un `fileKey` e il plugin può chiamare il backend. Solo se la scheda è ancora **"Untitled"** (file mai salvato, senza URL con ID) Figma non fornisce il `fileKey` e la richiesta non parte.
2. **Sei loggato** — La chiamata a `/api/figma/file` usa il token (JWT); se non sei loggato nel plugin, la richiesta non viene nemmeno inviata. Controlla che nel plugin risulti il tuo account (logout/login se serve).
3. **Hai cliccato "Conferma" (o "Confirm") sul modale** — Dopo il calcolo appare il modale con il costo/crediti. La richiesta parte **solo quando clicchi il bottone di conferma** su quel modale (quello che fa partire lo scan vero). Se chiudi il modale senza confermare, la chiamata non viene fatta.

**Prova così:** (a) Salva il file, (b) assicurati di essere loggato, (c) apri Network e **cancella la lista** (icona 🚫 o tasto destro → Clear), (d) fai **Scan** → aspetta il modale → **clicca Conferma**, (e) nel filtro scrivi solo **figma** (senza /file) oppure **non filtrare** e cerca nella lista una richiesta **POST** al tuo backend (es. `auth.comtra.dev` o il tuo dominio): il **Path** in Headers sarà `/api/figma/file`. Se ancora non compare, apri la tab **Console** e rifai il flusso: se vedi errori (rete, 401, CORS) quelli spiegano il problema.

### Opzione B: JSON minimo di esempio (nessun plugin/backend necessario)

Se **non** hai ancora il plugin che chiama il backend, o vuoi solo **provare subito** che Kimi risponde nel formato giusto, usa questo **file finto** in JSON. Non è un file Figma reale: è una struttura minima (document, pagina, frame, rettangolo) con qualche “errore” voluto (nomi generici, colori non legati a variabili) così Kimi ha qualcosa da segnalare. **Copia il blocco qui sotto** e incollalo come secondo messaggio (sotto la frase “Ecco il JSON del file…”).

```json
{
  "name": "Test file",
  "document": {
    "id": "0:0",
    "name": "Document",
    "type": "DOCUMENT",
    "children": [
      {
        "id": "1:1",
        "name": "Page 1",
        "type": "CANVAS",
        "children": [
          {
            "id": "1:2",
            "name": "Frame 42",
            "type": "FRAME",
            "fills": [{ "type": "SOLID", "color": { "r": 1, "g": 0.4, "b": 0.4, "a": 1 } }],
            "absoluteBoundingBox": { "x": 10, "y": 20, "width": 200, "height": 80 },
            "children": [
              {
                "id": "1:3",
                "name": "Rectangle 1",
                "type": "RECTANGLE",
                "fills": [{ "type": "SOLID", "color": { "r": 0.9, "g": 0.9, "b": 0.9, "a": 1 } }],
                "absoluteBoundingBox": { "x": 14, "y": 24, "width": 192, "height": 32 }
              }
            ]
          }
        ]
      }
    ]
  },
  "components": {}
}
```

Questo esempio ha: un nome di pagina generico (“Page 1”), un frame con nome generico (“Frame 42”), fill con colori “hardcoded” (senza `boundVariables`), coordinate non multiple di 8. Il modello dovrebbe segnalare issue di naming, coverage e consistency.

---

## Step 3 — Apri kimi.com e avvia una nuova chat

1. Vai su **https://kimi.com** e fai login.
2. Apri una **nuova conversazione** (nuova chat).

---

## Step 4 — Primo messaggio: incolla il system prompt

1. Nel campo di messaggio **incolla** tutto il contenuto copiato da `ds-audit-system.md`.
2. **Invia** il messaggio.

Aspetta che Kimi risponda (può confermare o fare una breve risposta). Non serve che faccia l’audit in questo messaggio: stai solo “impostando” il ruolo e le regole.

---

## Step 5 — Secondo messaggio: invia il JSON e chiedi l’audit

1. Scrivi una riga tipo:  
   **"Ecco il JSON del file di design. Esegui l'audit secondo le regole e restituisci solo le issue in JSON come specificato."**
2. **A capo** e sotto incolla il **JSON** (quello ottenuto allo Step 2).
3. **Invia** il messaggio.

Aspetta la risposta. Potrebbe richiedere qualche decina di secondi se il JSON è grande.

---

## Step 6 — Controlla la risposta

Verifica che:

- La risposta contenga un **JSON valido** (eventualmente dentro un blocco \`\`\`json ... \`\`\`).
- Il JSON abbia la forma **`{ "issues": [ ... ] }`**.
- Ogni elemento di `issues` abbia almeno: **id**, **categoryId**, **msg**, **severity**, **layerId**, **fix**.
- I **categoryId** siano solo: `adoption`, `coverage`, `naming`, `structure`, `consistency`, `copy`.
- Le **severity** siano solo: `HIGH`, `MED`, `LOW`.
- Per il JSON minimo (Opzione B) ci si aspetta almeno 2–3 issue (es. nome generico “Frame 42”, fill hardcoded, posizione fuori griglia).

Se qualcosa non va (testo prima/dopo il JSON, categoryId inventati, campi mancanti): **modifica il system prompt** in `ds-audit-system.md` (es. “Return only the JSON, no explanation”; “categoryId must be exactly one of: adoption, coverage, …”) e ripeti da Step 1.

---

## Dopo il primo test

- Se il risultato è ok: puoi **ripetere** con un JSON reale più grande (da plugin) e affinare il prompt se serve. Poi si passa all’implementazione dell’endpoint (Fase 1.4 del piano d’azione) e all’integrazione nel plugin (1.5).
- Se la risposta è lenta o troncata: **riduci il JSON** (meno pagine, meno nodi) e ritesta.
- Riferimento completo per setup e replicare per altri agenti: **docs/KIMI-FOR-DUMMIES.md**.
