# Primi test — Design System Audit su kimi.com

Guida operativa per fare il **primo test** dell’agente DS Audit **senza scrivere codice**: usi la chat su kimi.com, incolli il system prompt e un JSON di file, e verifichi che la risposta sia un JSON valido con `issues`.  
Dopo che questo funziona, si potrà implementare l’endpoint e il plugin.

---

## Cosa ti serve

- Account su **kimi.com** (stesso che usi per Moonshot).
- Il file **auth-deploy/prompts/ds-audit-system.md** (è già in repo): da lì copi il system prompt.
- Un **JSON di un file di design** (vedi sotto come ottenerlo).

---

## Step 1 — Copia il system prompt

1. Apri **auth-deploy/prompts/ds-audit-system.md** nel tuo editor.
2. Seleziona **tutto** il contenuto (da “You are a design system auditor” fino alla fine).
3. Copia (Cmd+C / Ctrl+C).

Questo testo è quello che invii come **primo messaggio** nella chat.

---

## Step 2 — Ottieni un JSON di test

### Opzione A: Hai già la pipeline (plugin + backend)

1. Apri il **plugin Comtra** in un file Figma salvato (non “untitled”).
2. Fai **Scan** (o il flusso che chiama il backend).
3. Apri gli **strumenti sviluppatore** del browser (F12) → tab **Network**.
4. Trova la richiesta **POST .../api/figma/file** (o il path che usi).
5. Apri la risposta (Response) e **copia tutto il corpo** (è il JSON del file).

Se il JSON è molto grande (> ~100–150 KB), riducilo: apri in un editor, tieni la radice e 1–2 pagine con i loro `children`, elimina il resto per evitare limiti di contesto.

### Opzione B: Non hai ancora la pipeline (o vuoi un test veloce)

Usa un **JSON minimo** che contiene comunque nodi e strutture che il modello può analizzare. Salva il blocco qui sotto in un file `.json` e aprilo per copiarlo, oppure copialo da qui (è volutamente piccolo e con qualche “errore” tipico: nome generico, fill senza variabile).

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
