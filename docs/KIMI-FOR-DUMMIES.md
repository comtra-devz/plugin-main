# Kimi for dummies — Guida pratica

Guida passo-passo per **iniziare a usare Kimi** in Comtra: setup, primo test (Design System Audit), replicare il modus per gli altri agenti, e come “allenarli” migliorando i prompt.  
Per il piano completo delle fasi vedi **ACTION-PLAN-KIMI-AGENTS.md**. Per **modificare le regole** e passare il lavoro ad altri vedi **audit-specs/MAINTAINING-RULES.md**.

---

## 1. Cos’è Kimi e a cosa serve qui

Kimi è un modello di linguaggio (LLM) che usiamo come **agente**: gli mandiamo il JSON del file di design e lui restituisce un elenco di **issue** (problemi) secondo regole che definiamo noi.  
In Comtra ogni “agente” fa un compito preciso: Design System Audit, Accessibility Audit, UX Audit, Prototype Audit, Code Gen, Generate. Tutti seguono lo stesso schema:

1. **Regole** (cosa controllare) → in `audit-specs/<nome-agente>/`
2. **System prompt** (istruzioni per Kimi) → in `auth-deploy/prompts/<nome>-system.md`
3. **Test a mano** su kimi.com (senza backend)
4. **Endpoint** che chiama l’API Kimi e restituisce le issue al plugin
5. **Plugin** che chiama l’endpoint e mostra le issue nel tab corrispondente

Questa guida ti porta fino al punto 3 in modo ripetibile; i punti 4–5 sono nel piano d’azione.

---

## 2. Setup (una tantum)

### 2.0 Cosa trovi (e cosa no) sulla piattaforma Moonshot

Dopo il login su **platform.moonshot.ai** vedi essenzialmente:

- **Menu laterale / top:** di solito voci tipo **Console** (o **Dashboard**), **API Keys** (o **API Key Management**), **Documentazione** (Docs), **Billing** (fatturazione / crediti).
- **Niente “Crea agente” o “Agent builder”:** la piattaforma non ha un wizard per “costruire” un agente. Offre solo:
  - **Creazione e gestione API Key** (per chiamare l’API a nome tuo).
  - **Documentazione** dell’API (endpoint, parametri, modelli).
  - **Crediti / billing** (piano gratuito a consumo o a pagamento).

Quindi **“costruire un agente” in Comtra** significa **noi** definire:

1. Le **regole** (in `audit-specs/...`) — cosa deve controllare.
2. Il **system prompt** (in `auth-deploy/prompts/...`) — il testo di istruzioni che inviamo a ogni richiesta.
3. Il **nostro codice** che chiama l’API (backend): `POST https://api.moonshot.ai/v1/chat/completions` con `Authorization: Bearer TUA_API_KEY`, body con `model`, `messages` (system + user), ecc.

L’“agente” è questa combinazione (regole + prompt + chiamata API), non qualcosa che si “crea” da un pulsante sulla piattaforma.

---

### 2.1 Account e API Key — passi concreti

| Step | Cosa fare (dettaglio) |
|------|------------------------|
| 1 | Vai su **kimi.com** e registrati (email o telefono). Stesso account si usa per la piattaforma sviluppatori. |
| 2 | Apri **https://platform.moonshot.ai** e fai login (stesso account di kimi.com). |
| 3 | Nel menu: cerca **“API Keys”** o **“API Key Management”** (in sidebar o sotto “Console”). Il link diretto è spesso **https://platform.moonshot.ai/console/api-keys**. |
| 4 | Clicca **“Create API Key”** (o “Crea chiave API”). Ti chiederà un **nome** (es. “Comtra backend”): metti quello che vuoi, serve solo a riconoscerla in lista. |
| 5 | Dopo la creazione la chiave viene mostrata **una sola volta**. **Copia subito** e incollala in un posto sicuro (password manager, nota locale). Non metterla in repo né in file committati. Se la perdi, dovrai creare una nuova chiave. |
| 6 | In **Vercel**: apri il progetto del backend (es. **auth-deploy**). Vai in **Settings** → **Environment Variables**. Clicca **Add** (o “Add New”). Nome: `KIMI_API_KEY`. Valore: incolla la chiave copiata. Scegli gli ambienti (Production, Preview se serve). Salva. Se il backend è già deployato, fai **Redeploy** dell’ultima release così le nuove variabili siano disponibili. |

**Verifica che la key funzioni (opzionale):** dalla doc Moonshot l’endpoint è `POST https://api.moonshot.ai/v1/chat/completions`. Puoi provare con curl (sostituisci `TUO_API_KEY`):

```bash
curl -X POST "https://api.moonshot.ai/v1/chat/completions" \
  -H "Authorization: Bearer TUO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"kimi-k2-turbo-preview","messages":[{"role":"user","content":"Di cosa è fatto 1+1? Rispondi in una parola."}],"temperature":0.3}'
```

Se la key è valida ricevi un JSON con `choices[0].message.content`. Se ricevi 401, la key è sbagliata o non impostata.

### 2.2 Verificare la pipeline dati (file di design)

Per far analizzare un file a Kimi il backend deve poter scaricare il JSON del file. Controlla che:

- La tabella `figma_tokens` esista (migrazione in `auth-deploy/schema.sql`).
- Tu abbia fatto **logout e login con Figma** nel plugin così da concedere lo scope `file_content:read`.
- L’endpoint `POST /api/figma/file` funzioni (plugin → Scan su file aperto → in Network tab vedi 200 e JSON).

Se uno di questi fallisce, risolvi prima (vedi OAUTH-FIGMA.md e SETUP in auth-deploy).

---

## 3. Testare il primo agente (Design System Audit)

L’obiettivo è **non** scrivere codice backend: usare la **chat pubblica su kimi.com** per vedere se il modello capisce le regole e restituisce un JSON valido. Quando il formato e le risposte vanno bene, lo stesso prompt andrà nel backend che chiamerà l’API con la **tua** API key.

**Attenzione:** la chat su kimi.com **non usa** la tua API key; è la chat “normale” del prodotto. Serve solo per **provare prompt + risposta** a costo zero e senza scrivere codice. L’uso “vero” dell’agente (con la tua key, dal plugin) avviene quando implementi l’endpoint che fa `POST https://api.moonshot.ai/v1/chat/completions` con `Authorization: Bearer KIMI_API_KEY`.

### 3.1 Dove sono le regole e lo schema di output

- **Regole (cosa controllare):** `audit-specs/ds-audit/DS-AUDIT-RULES.md`  
  Contiene tutte le regole (1.1–7.4), dove cercare nel JSON, severity, esempio di fix.
- **Formato di risposta:** `audit-specs/ds-audit/OUTPUT-SCHEMA.md`  
  Definisce il JSON: `{ "issues": [ { "id", "categoryId", "msg", "severity", "layerId", "fix", ... } ] }`.

### 3.2 Costruire il system prompt

Il system prompt è il “brief” che dai a Kimi a inizio conversazione. Deve contenere:

1. **Ruolo:** “Sei un auditor di design system. Analizzi il JSON di un file di design e individui problemi rispetto alle regole sotto.”
2. **Regole:** puoi copiare una **sintesi** da `DS-AUDIT-RULES.md` (categorie + elenco regole con “dove cercare” e severity) oppure incollare le sezioni principali. Per i test lunghi il contesto può essere grande; per iniziare va bene una versione ridotta (es. solo adoption e coverage).
3. **Formato di output:** “Restituisci **solo** un JSON valido nel formato seguente. Nessun testo prima o dopo. Se serve, usa un blocco \`\`\`json ... \`\`\`.” Poi incolla la tabella o l’esempio da `OUTPUT-SCHEMA.md` (campi obbligatori: id, categoryId, msg, severity, layerId, fix; opzionali: layerIds, tokenPath, pageName).
4. **Opzionale — Esempi:** 1–2 issue di esempio in JSON aiutano il modello (“Esempio di issue: { "id": "ds-1", "categoryId": "coverage", ... }”).

Salva questo testo in un file (es. `auth-deploy/prompts/ds-audit-system.md`) così puoi riusarlo uguale nel backend. Creare la cartella `auth-deploy/prompts/` se non esiste.

### 3.3 Ottenere un JSON di test

- **Opzione A:** Dal plugin: fai Scan su un file aperto; in Network tab prendi la risposta di `POST /api/figma/file` e copia il corpo (JSON).
- **Opzione B:** Dall’editor: esporta il file (se il tool lo permette) e apri il JSON.

Se il file è enorme (> ~100 KB o migliaia di nodi), **riducilo**: apri il JSON in un editor e tieni solo la radice + 1–2 pagine/canvas con i relativi `children` (taglia il resto). Così eviti limiti di contesto e risposte lente.

### 3.4 Test su kimi.com (passo-passo)

| Step | Azione |
|------|--------|
| 1 | Apri [kimi.com](https://kimi.com) (o la pagina chat che usi) in un browser. |
| 2 | **Primo messaggio:** incolla l’intero system prompt (il testo che hai in `ds-audit-system.md`). Invia. |
| 3 | **Secondo messaggio:** scrivi qualcosa tipo: “Ecco il JSON del file di design. Esegui l’audit secondo le regole e restituisci le issue in JSON come specificato.” Poi incolla il JSON (anche molto lungo). Invia. |
| 4 | Aspetta la risposta. Controlla: (a) c’è un JSON? (b) ha la struttura `{ "issues": [ ... ] }`? (c) Le issue hanno id, categoryId, msg, severity, layerId, fix? (d) I categoryId sono tra adoption, coverage, naming, structure, consistency, copy? (e) Le severity sono HIGH, MED, LOW? |
| 5 | Se qualcosa è sbagliato (testo prima/dopo, campi mancanti, categoryId inventati): **modifica il system prompt** (es. “Restituisci SOLO il JSON, nessun commento”; “categoryId deve essere esattamente uno di: adoption, coverage, …”). Salva, ritesta. |

Quando il risultato è un JSON valido e le issue hanno senso, il “modello” di test è pronto. Lo stesso prompt (o una versione leggermente adattata) andrà nell’endpoint.

### 3.5 Cosa fare con il risultato del test

- Salva una **copia della conversazione** (screenshot o testo) per riferimento.
- Il file **ds-audit-system.md** è quello che il backend leggerà per la chiamata a Kimi: tieni lì la versione “vincente” dopo le iterazioni.

---

## 4. Replicare il modus per gli altri agenti

Per **ogni** nuovo agente (A11Y, UX, Prototype, Code, Generate) il flusso è lo stesso:

| Fase | Cosa fare | Dove |
|------|-----------|------|
| **Regole** | Scrivere cosa deve controllare l’agente e dove trovarlo nel JSON (o in altri input). | Nuova cartella `audit-specs/<nome-agente>/` con almeno un file regole + OUTPUT-SCHEMA (o riuso quello DS se il formato è uguale). |
| **System prompt** | Scrivere ruolo + regole (sintesi o complete) + formato output + eventuali esempi. | `auth-deploy/prompts/<nome-agente>-system.md` |
| **Test su kimi.com** | Come sopra: primo messaggio = system prompt, secondo = input (JSON file o altro). Verificare che l’output sia JSON valido e sensato. | Browser, nessun codice. |
| **Endpoint** | Implementare `POST /api/agents/<nome-agente>` che: legge input (es. file_key), prende il JSON, chiama Kimi con system prompt + user message, estrae il JSON dalla risposta, valida/mappa a AuditIssue (o altro tipo), restituisce al client. | `auth-deploy/oauth-server/app.mjs` + eventuale `auth-deploy/api/agents/...` (rispettando il limite di 12 funzioni Vercel). |
| **Plugin** | Chiamare il nuovo endpoint, salvare le issue in stato, mostrarle nel tab corrispondente (loading/error). | `App.tsx`, `AuditView.tsx`, tab A11Y/UX/Prototype/Code/Generate. |

Quindi: **stesso loop** (regole → prompt → test a mano → endpoint → plugin). La parte “for dummies” è soprattutto regole + prompt + test su kimi.com; backend e plugin seguono il piano d’azione.

---

## 5. Come “allenare” gli agenti (migliorare i prompt)

- **Iterare sul system prompt:** se Kimi restituisce testo prima/dopo il JSON, insisti nel prompt: “Restituisci **solo** il JSON, nessuna spiegazione.” Se sbaglia i categoryId, elencali esplicitamente e scrivi “Usa **solo** questi valori per categoryId”. |
- **Esempi few-shot:** 1–2 issue di esempio nel prompt (in JSON) aiutano il modello a rispettare struttura e stile. |
- **Regole più corte vs complete:** per contesto lungo (file grandi) puoi mettere nel prompt una **sintesi** delle regole (solo nomi e severity) e rimandare a “dettaglio in DS-AUDIT-RULES”; per file piccoli puoi includere le regole per intero. |
- **Severity e categorie:** se il modello inventa severity o categorie, ripetere nel prompt l’elenco esatto (HIGH/MED/LOW e adoption, coverage, naming, structure, consistency, copy) e “non usare altri valori”. |
- **Estrarre JSON da markdown:** la risposta può essere “\`\`\`json\n{ ... }\n\`\`\`”. Il backend dovrà estrarre il contenuto tra \`\`\`json e \`\`\` e fare parse. Vale per tutti gli agenti. |

Dopo ogni modifica al prompt, **ritestare su kimi.com** prima di aggiornare il file usato dal backend.

---

## 6. Dati fissi per la chiamata API (backend)

Quando implementi l’endpoint (es. `POST /api/agents/ds-audit`), la chiamata a Kimi è sempre questa:

| Cosa | Valore |
|------|--------|
| **URL** | `POST https://api.moonshot.ai/v1/chat/completions` |
| **Header** | `Authorization: Bearer <KIMI_API_KEY>` , `Content-Type: application/json` |
| **Body (minimo)** | `{ "model": "kimi-k2-turbo-preview", "messages": [ ... ], "temperature": 0.3 }` |
| **messages** | Primo elemento: `{ "role": "system", "content": "<contenuto di ds-audit-system.md>" }`. Secondo: `{ "role": "user", "content": "<JSON del file di design o istruzioni>" }`. |
| **Risposta** | JSON con `choices[0].message.content` (testo). Spesso il modello restituisce un blocco \`\`\`json ... \`\`\`: il backend deve estrarlo e fare parse per ottenere `{ "issues": [ ... ] }`. |

Modelli possibili (verifica sulla doc aggiornata): `kimi-k2-turbo-preview`, o altri indicati in platform.moonshot.ai/docs. La documentazione ufficiale è in **https://platform.moonshot.ai/docs** (API Reference → Chat).

---

## 7. Dove sono i file (riferimento rapido)

| Cosa | Dove |
|------|------|
| Regole DS (audit design system) | `audit-specs/ds-audit/DS-AUDIT-RULES.md`, `OUTPUT-SCHEMA.md`, `SOURCES.md`, `RECURRING-PROBLEMS.md` |
| Come modificare le regole / handoff | `audit-specs/MAINTAINING-RULES.md` |
| System prompt DS (da usare in test e backend) | `auth-deploy/prompts/ds-audit-system.md` (crearlo se non c’è) |
| Prompts altri agenti | `auth-deploy/prompts/<nome>-system.md` |
| Endpoint agenti | `auth-deploy/oauth-server/app.mjs` (route) + `auth-deploy/api/agents/` (handler Vercel) |
| Piano completo fasi e checklist | `docs/ACTION-PLAN-KIMI-AGENTS.md` |
| Tipo frontend per le issue | `types.ts` → `AuditIssue` |

---

## 8. Checklist “primo test riuscito”

- [ ] Account Kimi e API key creati; `KIMI_API_KEY` in Vercel (per quando farai l’endpoint).
- [ ] Pipeline dati OK: login Figma con `file_content:read`, `POST /api/figma/file` restituisce 200.
- [ ] Letto `DS-AUDIT-RULES.md` e `OUTPUT-SCHEMA.md`.
- [ ] Scritto e salvato `auth-deploy/prompts/ds-audit-system.md` (ruolo + regole + formato output).
- [ ] Ottenuto un JSON di test (da plugin o export) e eventualmente ridotto.
- [ ] Su kimi.com: primo messaggio = system prompt, secondo = “Ecco il JSON…” + JSON.
- [ ] Risposta: JSON valido, `issues[]`, campi obbligatori presenti, categoryId e severity ammessi.
- [ ] Se no: modificato il prompt e ritestato fino a OK.
- [ ] (Opzionale) Salvata una copia della conversazione di test.

Dopo questo sei pronto per implementare l’endpoint (Fase 1.4 del piano d’azione) e l’integrazione nel plugin (1.5).
