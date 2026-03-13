# Sync — Indagine tecnica (flussi reali e integrazioni)

Documento generato dall’analisi del codebase per la funzione **Sync** nella tab Code (Deep Sync: Storybook, GitHub, Bitbucket). Obiettivo: capire cosa esiste già, cosa manca e **valutare la fattibilità della connessione con Storybook** (priorità), poi GitHub/Bitbucket (non prioritarie), seguendo le logiche prodotto già presenti (crediti, PRO, contesto file, drift).

---

## 0. Fattibilità connessione Storybook (priorità) e con GH/BB

### 0.1 Cosa fa il prodotto (logica attuale)

- **Figma = source of truth.** Il drift è “design aggiornato, codice (Storybook/repo) indietro”. La Sync serve a **rilevare** le differenze e **aggiornare** il “codice vivo” (Storybook) o il repo (GitHub/Bitbucket).
- Flusso UI già definito: Connect Storybook → Scan Project (drift) → lista violazioni → Sync Fix (singolo) / Sync All. La tab **Sync è sbloccata solo con PRO** (FREE non può usarla); con PRO, Scan costa **15 crediti**, Fix 5, Sync All N×5. Cooldown in UI.
- Per una Sync “reale” servono: (1) **lettura** da Storybook (e/o repo) per confrontare con Figma; (2) **scrittura** per “aggiornare” (push).

### 0.2 Integrazioni Figma–Storybook esistenti (contesto)

- **Storybook Connect (plugin Figma)**  
  - Consente di **incorporare Storybook dentro Figma** (vedere le story sul componente selezionato).  
  - Richiede Storybook **pubblicato su Chromatic**; il link è “copia URL story da Chromatic → incolla nel plugin”.  
  - Non è “Figma → push verso Storybook”: è “leggere Storybook dentro Figma”. Utile per riferimento, non per il nostro flusso di drift/sync.

- **Code Connect (Figma)**  
  - Il collegamento vive **nel codice**: nelle story si mette `parameters.design = { type: 'figma', url: '...', examples }`. Figma Dev Mode mostra lo snippet di codice.  
  - Richiede piani Figma Organization/Enterprise.  
  - Ancora una volta il legame è “repo → Figma”, non “Figma → Storybook” in senso di aggiornamento da design.

- **Addon Designs (@storybook/addon-designs)**  
  - Incorpora **Figma in Storybook** (tab Design nella story).  
  - Non fornisce API per un nostro backend per “leggere/scrivere” Storybook.

Conclusione: le integrazioni ufficiali non espongono un “API di sync Figma → Storybook” pronta all’uso. Dobbiamo costruire noi il pezzo “connetti a Storybook e confronta con Figma”.

### 0.3 Fattibilità tecnica: leggere da Storybook (per drift)

Per **rilevare il drift** servono:
- lato Figma: **file_key** (e opzionale file_json) — già coperti da `get-file-context` / pattern Audit;
- lato Storybook: **elenco componenti/story e loro metadati** (nome, props/args, eventuale link a Figma).

Opzioni concrete:

| Opzione | Descrizione | Fattibilità |
|--------|-------------|-------------|
| **A) Storybook esposto via HTTP (deploy o locale)** | L’utente fornisce l’URL della Storybook (es. `https://storybook.example.com` o tunnel su localhost). Un pacchetto come **storybook-api** (npm) espone REST: `/api/stories`, `/api/components`, `/api/components/:id` (metadata, args, design links). Il backend Comtra chiama questo endpoint (con eventuale API key se richiesta) e confronta con il file Figma. | **Fattibile.** Richiede che l’utente abbia Storybook raggiungibile (deploy pubblico o URL esposto). CORS/retrieval lato backend gestibili. |
| **B) Chromatic** | Storybook Connect si appoggia a Chromatic (build, versioni, access control). Chromatic ha CLI e integrazioni CI; non risulta una REST API pubblica “lista storie” per terze parti. Si potrebbe esplorare API/GraphQL Chromatic per progetti collegati. | **Da verificare.** Se Chromatic espone “lista storie/build” per un progetto, si potrebbe usare quello come sorgente; altrimenti si punta su A). |
| **C) Export statico / index** | Build di Storybook (static export) o index generato a build-time: il backend potrebbe ricevere un URL a un JSON di index (se il team lo genera) e usarlo per il confronto. | **Fattibile** se il cliente è disposto a esporre un index; meno standard di A). |

Raccomandazione per la **priorità Storybook**: basare la “Connect Storybook” su **URL Storybook (deploy)** e, lato backend, **chiamate a un’API di lettura** (es. storybook-api o equivalente: storie + componenti + metadati). Il backend riceve anche `file_key` (o file_json) dal plugin, recupera il design da Figma (come per Audit), e confronta: stesso componente? Stesse props/token? → drift items (id, name, desc, ecc.) in formato già compatibile con SyncTab.

### 0.4 Fattibilità tecnica: “scrivere” verso Storybook (Sync Fix / Sync All)

Le story sono **file sorgente** (.stories.tsx, ecc.). Storybook non espone un’API “scrivi questa story”. Quindi:

- **Aggiornare “Storybook”** in pratica significa: generare/aggiornare **contenuto** (story, token, props) e persisterlo dove vive il codice → **repo Git**.
- Quindi il flusso naturale è: **Sync to Storybook** = generiamo/aggiorniamo file (storie, token, ecc.) e li **pushiamo su GitHub/Bitbucket** (commit/PR). Storybook si aggiorna quando il repo viene buildato (CI o locale).
- In questo modo **Storybook** e **GitHub/Bitbucket** si allineano: la “connessione Storybook” serve per **leggere** (drift); la “scrittura” passa da **connessione GitHub/Bitbucket** (priorità successiva). L’UI può restare “Sync to Storybook” ma sotto il cofano: push su repo → Storybook si aggiorna con il prossimo build.

Alternativa solo “output”: mostrare all’utente il diff/codice generato e “Copy” o “Download”, senza push automatico (MVP).

### 0.5 GitHub e Bitbucket (non priorità, stessa logica)

- **Lettura:** API REST (GitHub/Bitbucket) per elenco file, contenuto di `.stories.*`, design tokens, componenti. Fattibile con token utente (OAuth/app).
- **Scrittura:** commit/PR via API. Stesso flusso: “Sync” = push delle modifiche generate; crediti, PRO, contesto file come già previsto.

Priorità: prima **Storybook (lettura per drift + chiarire il canale di “scrittura” via repo)**, poi integrazione esplicita GitHub/Bitbucket per push e statistiche.

### 0.6 Sintesi fattibilità

- **Connessione Storybook (priorità):** **Fattibile.**  
  - Connect = URL Storybook (e opzionale auth se necessario).  
  - Scan drift = backend riceve file_key/file_json (stesso pattern Audit) + legge da Storybook (API tipo storybook-api o index). Output = lista drift come oggi in SyncTab.  
  - Sync Fix / Sync All = generazione contenuti + push via Git (quindi legame con GitHub/Bitbucket) oppure solo export/copy (MVP).  
- **GitHub/Bitbucket:** stessa logica (crediti, PRO, file context); da implementare dopo Storybook.

---

## 1. Riepilogo stato attuale

| Aspetto | Stato | Dettaglio |
|--------|--------|-----------|
| **UI (SyncTab)** | ✅ Placeholder completo | Gate PRO, tab SB/GH/BB, Connect → Scan → Lista drift → Sync Fix / Sync All, cooldown, crediti in UI |
| **Stato e handler (Code.tsx)** | ✅ Implementato | `handleSyncScan` chiama `fetchSyncScan` (POST /api/agents/sync-scan); `handleSyncItem` / `handleSyncAll` con consume crediti |
| **Crediti (consume)** | ✅ Collegati | `scan_sync` 15 crediti, `sync_fix` 5 crediti, `sync_storybook` (Sync All) N×5 crediti |
| **Backend crediti** | ✅ Pronto | `scan_sync` → 15, `sync_fix` / `sync_storybook` → 5; XP per `sync_storybook` / `sync_github` / `sync_bitbucket` (25 ciascuno) |
| **API Sync/Drift/Storybook** | ⚠️ Parziale | Endpoint `POST /api/agents/sync-scan` implementato (Figma vs Storybook); GitHub/Bitbucket da implementare |
| **Contesto file Figma** | ❌ Non usato in Code | Tab Code non richiede `get-file-context` né `file_key`; solo Tokens usa `get-design-tokens` (Variables) |
| **Statistiche sync (user.stats)** | ⚠️ Solo default 0 | Backend restituisce sempre `syncedStorybook: 0` (e GH/BB); nessuna colonna DB né logica che le aggiorni |

---

## 2. Pattern da riutilizzare (Audit e crediti)

### 2.1 Flusso crediti (Audit)

1. **Stima:** `estimateCredits({ action_type: 'audit' | 'a11y_audit', node_count })` → `POST /api/credits/estimate`.
2. **Conferma utente:** modale/ricevuta con costo (es. “Questo scan consumerà X crediti”).
3. **Consumo:** prima dell’azione (o dopo successo) → `consumeCredits({ action_type, credits_consumed, file_id? })` → `POST /api/credits/consume`.
4. **Esecuzione:** chiamata all’agente/servizio (es. `fetchDsAudit`, `fetchA11yAudit`).

Per la Sync andrebbe replicato: stima (con `action_type: 'sync'` o varianti), conferma, consume, poi chiamata a un eventuale servizio di drift/sync.

### 2.2 Flusso contesto file (Audit)

1. **Plugin (UI):** `window.parent.postMessage({ pluginMessage: { type: 'get-file-context', scope, pageId } }, '*')`.
2. **Controller (Figma):** risponde con `file-context-chunked-start` + `file-context-chunk` (o `file-context-result` con `fileKey` + opzionale `fileJson`).
3. **AuditView:** ascolta `file-context-result`, estrae `fileKey` / `fileJson`, poi chiama `fetchDsAudit` / `fetchA11yAudit` con `file_key` o `file_json`.

La **tab Code (Sync)** oggi non invia mai `get-file-context`. Per uno “scan drift” reale servirà:
- ottenere `file_key` (e opzionalmente `file_json`) come in Audit, oppure
- un nuovo messaggio plugin che espone solo `fileKey` (già disponibile in `controller` come `figma.fileKey` su file salvato).

### 2.3 Backend: estimate e consume

- **estimateCreditsByAction** (`auth-deploy/oauth-server/app.mjs`):
  - `action_type === 'scan_sync'` → **15 crediti** (Scan Project).
  - `action_type === 'sync_fix'` o `'sync_storybook'` → **5 crediti** (Fix singolo o Sync All: N×5).
  - Non ci sono bande per `node_count` sulla sync (a differenza di `audit` / `a11y_audit`).
- **XP_TABLE:** già definiti `sync_storybook`, `sync_github`, `sync_bitbucket`, `sync` (25 XP ciascuno); nessun codice che li usi ancora.

---

## 3. Cosa manca per una Sync “reale”

### 3.1 Plugin (UI + controller)

- **Code.tsx / SyncTab:**
  - Chiamare `estimateCredits` con `action_type: 'scan_sync'` (15) o `'sync_fix'`/`'sync_storybook'` (5) prima di Scan / Sync Fix / Sync All.
  - Chiamare `consumeCredits` con `action_type` appropriato e `credits_consumed` effettivo (15 per scan, 5 per fix, ecc.) quando l’azione va a buon fine.
- **Contesto Figma per lo scan drift:**
  - Decidere se riusare `get-file-context` (come Audit) o introdurre un messaggio tipo `get-sync-context` che restituisca almeno `fileKey` (e opzionale `fileJson`).
  - Il controller già espone `figma.fileKey` in `get-design-tokens`; si può riusare o estendere per la Sync.

### 3.2 Backend

- **Endpoint Sync/Drift:**
  - Nuovo endpoint (es. `POST /api/agents/sync-scan` o `/api/sync/drift`) che:
    - accetta `file_key` o `file_json` (come ds-audit/a11y-audit),
    - opzionale: URL/ID Storybook (o repo GitHub/Bitbucket) e credenziali/token,
    - restituisce una lista di “drift items” (componente, descrizione, tipo di mismatch) invece di “issues” DS/A11Y.
  - Implementazione reale richiede:
    - **Storybook:** collegamento a Storybook (API o export) per confrontare componenti/props con il design (Figma/file JSON).
    - **GitHub/Bitbucket:** confronto con repo (es. file di componenti, design tokens) e eventuale push; oggi solo placeholder “Soon”.
- **Statistiche utente:**
  - Oggi `user.stats.syncedStorybook` (e GH/BB) sono sempre 0 (hardcoded in risposta login/oauth).
  - Per aggiornarle servono: colonne o tabelle che contano le sync per tipo (es. `synced_storybook_count`) oppure deriva da `credit_transactions`/`xp_transactions` con `action_type` tipo `sync_storybook`; poi nella risposta di login (o in un endpoint tipo `GET /api/credits` che già restituisce dati utente) includere questi numeri in `stats`.

### 3.3 Crediti e cooldown

- **Crediti Sync (implementati):** Scan Project 15 crediti (`scan_sync`), Fix singolo 5 crediti (`sync_fix`), Sync All N×5 crediti (`sync_storybook`).
- **Backend:** `estimateCreditsByAction` supporta `scan_sync` (15), `sync_fix` e `sync_storybook` (5); `consumeCredits` accetta gli stessi `action_type`.

---

## 4. Messaggi plugin esistenti (controller)

Rilevanti per la Sync:

- `get-file-context` (scope, pageId) → fileKey + fileJson (chunked o result): usato da Audit; riutilizzabile per “scan drift” se il backend avesse bisogno del file.
- `get-design-tokens` → payload Variables (fileKey incluso): usato da Code/TokensTab; non fornisce albero componenti ma solo variabili.
- `select-layer` (layerId): già usato da Audit per “Vai al layer”; SyncTab ha “Select Layer” per item drift ma non invia questo messaggio (solo feedback locale).
- **Nessun** messaggio `sync-scan`, `sync-push`, `connect-storybook` oggi.

Se lo “scan drift” richiederà solo `file_key` (e il backend farà GET file via Figma API con token utente), si può aggiungere un messaggio semplice tipo `get-file-key` che risponde con `figma.fileKey` (se disponibile), senza serializzare il documento.

---

## 5. File e riferimenti utili

| File | Ruolo |
|------|--------|
| `views/Code.tsx` | Stato Deep Sync, SYNC_ITEMS_MOCK, handleSyncScan / handleSyncItem / handleSyncAll, handleConnectSb, cooldown |
| `views/Code/tabs/SyncTab.tsx` | UI: gate PRO, tab SB/GH/BB, Connect, Scan, lista drift, Sync Fix, Sync All, Rescan |
| `views/Code/types.ts` | SyncTabProps |
| `App.tsx` | estimateCredits, consumeCredits, fetchFigmaFile, fetchDsAudit, fetchA11yAudit; stats in user (syncedStorybook ecc.) |
| `controller.ts` | get-file-context, get-design-tokens, select-layer; figma.fileKey in design-tokens |
| `auth-deploy/oauth-server/app.mjs` | estimateCreditsByAction (scan_sync 15, sync_fix/sync_storybook 5), consume, XP_TABLE (sync_*), GET /api/credits; endpoint POST /api/agents/sync-scan |
| `auth-deploy/schema.sql` | credit_transactions.action_type, users; nessuna colonna synced_* |
| `views/Documentation.tsx` | Copy Deep Sync & Drift (Figma = source of truth, push to Storybook/GitHub) |
| `docs/DESIGN-HANDOFF-DRIFT-RULESET.md` | Ruleset cluster tematici (handoff, drift, token, governance, ecc.) + severity + **consigli durante risultati Sync**; usare per arricchire messaggi e suggerimenti in output drift. |
| `storybook-test/` | Storybook di test interno: Button, Input, Card. `npm run build && npm run serve` → server su :6006 con `/api/stories`. Per Comtra: esporre con ngrok e usare l'URL pubblico. Vedi `storybook-test/README.md`. |
| `docs/SYNC-ENTERPRISE-SSO.md` | **Enterprise:** SSO e Storybook protetto — come risolverlo (bridge, export, token M2M) e cosa chiedere al cliente. |

---

## 6. Flusso utente: da link allo schermo Drift → correzione

Per **coprire i casi in cui è possibile** arrivare allo schermo del prototipo (Deep Sync, tab Storybook, Drift Detected, N Violations, Sync All) e poi correggere:

1. **Inserire il link (e opzionale token)**  
   - Tab Code → Sync → tab Storybook.  
   - URL: Storybook deployato (Vercel, Netlify, Chromatic, server interno) o esposto in locale con ngrok.  
   - Token (opzionale): se lo Storybook è privato e richiede `Authorization: Bearer <token>`, l’utente lo inserisce nel campo “Access token (optional)”.  
   - Clic su **Connect Storybook**.

2. **Salvare il file Figma**  
   - Il scan usa il contesto del file (file_key). Se il file non è salvato, compare l’errore “Save the file to run the scan.”.

3. **Scan Project**  
   - Clic su **Scan Project** (−15 crediti).  
   - Il plugin chiede il contesto file a Figma (`get-file-context`, scope `all`), invia al backend `file_key` + `storybook_url` (+ `storybook_token` se presente).  
   - Il backend recupera il file Figma e chiama lo Storybook (`/api/stories` o `/api/components` o `/index.json`); confronta componenti e restituisce gli item di drift.

4. **Schermo “Drift Detected”**  
   - Lista violazioni (nome componente, descrizione, “Select Layer” se c’è un layer Figma associato).  
   - **Sync Fix** (singolo): −5 crediti, l’item viene rimosso dalla lista (correzione registrata lato Comtra; push reale verso repo/Storybook in fase successiva).  
   - **Sync All**: −(N×5) crediti, tutti gli item vengono rimossi e si mostra “Everything Synchronized”.

5. **Casi coperti**  
   - Storybook **pubblico** (solo URL).  
   - Storybook **privato** con token Bearer (URL + token opzionale).  
   - File Figma **salvato** (file_key disponibile).  
   - Crediti sufficienti e cooldown rispettato.

6. **Casi non coperti (o parziali)**  
   - Storybook solo in **localhost** senza ngrok/deploy → backend non raggiungibile.  
   - Accesso Storybook con **solo SSO/login interattivo** → nessun token da inviare dal backend.  
   - “Correzione” oggi = rimozione dalla lista e consumo crediti; **push verso repo/Storybook** (commit, PR) è step successivo.

---

## 7. Prossimi passi suggeriti

Per il **caso comune** (Storybook pubblico / privato con Bearer token, push via Git opzione A, requisito repo): vedi **`docs/SYNC-COMMON-CASE.md`**.

1. **Storybook (priorità):** Validare in proof-of-concept: “Connect Storybook” = URL (+ auth se serve) → backend chiama API lettura (es. storybook-api) e confronta con file_key/file_json; output drift in formato SyncTab. Decidere se “Sync Fix” in v1 è solo export/copy o push via Git (GitHub/Bitbucket).
2. **Crediti e stima:** Definire `action_type` per scan_sync / sync_fix / sync_all (o unico `sync` con `credits_consumed` variabile) e collegare in Code.tsx: stima prima dell’azione, consume dopo successo (stessa logica Audit).
3. **Contesto file:** Per “Scan Project” riusare `get-file-context` (come Audit) o messaggio leggero `get-file-key`; passare `file_key` (e opzionale `file_json`) all’endpoint di drift.
4. **Backend Sync/Drift:** Progettare `POST /api/agents/sync-scan` (o simile): input file_key/file_json + storybook_url (e opzionale config); output lista drift items (id, name, status, lastEdited, desc).
5. **Statistiche:** Persistenza e lettura di syncedStorybook/syncedGithub/syncedBitbucket (DB o da credit_transactions/xp_transactions) e inclusione in risposta login o GET /api/credits.
6. **Select Layer da drift:** Collegare “Select Layer” in SyncTab a `postMessage({ type: 'select-layer', layerId: item.id })` quando gli id drift mappano node id Figma.
7. **GitHub/Bitbucket (dopo Storybook):** Stessa logica (crediti, PRO, contesto); API per lettura repo e push commit/PR.

---

Fine indagine. Il flusso **link → Connect → Scan → Drift Detected → Sync Fix / Sync All** è implementato; token opzionale copre i casi di Storybook con accesso protetto da Bearer. La **priorità** è la fattibilità della connessione con **Storybook** (lettura per drift; scrittura via repo o export); **GitHub/Bitbucket** seguono la stessa logica e sono non prioritarie per ora. Per domande su un punto specifico (schema API drift, crediti, messaggi plugin) si può espandere la sezione corrispondente.
