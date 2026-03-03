# Piano d'azione: Agenti Kimi per Comtra

Piano dettagliato punto-punto per creare, istruire e integrare gli agenti Kimi nel progetto Comtra. Include materiali necessari per ogni funzionalità.

- **Chi fa cosa (in ordine)** per l’agente DS Audit: **docs/DS-AUDIT-WHO-DOES-WHAT.md**
- **Guida pratica “for dummies”** (setup, test su kimi.com, replicare per altri agenti, allenare i prompt): **docs/KIMI-FOR-DUMMIES.md**
- **Pipeline analisi (export JSON vs analisi reale) e dove gestire la knowledge:** **docs/AUDIT-PIPELINE-AND-KNOWLEDGE.md**
- **Come modificare le regole e passare il lavoro ad altri:** **audit-specs/MAINTAINING-RULES.md**

---

## Fase 0 — Prerequisiti e setup

### 0.1 Account e API Kimi

| Step | Azione | Dove | Materiale |
|------|--------|------|-----------|
| 0.1.1 | Creare account Kimi | [kimi.com](https://kimi.com) | Email o telefono |
| 0.1.2 | Accedere alla piattaforma sviluppatori | [platform.moonshot.ai](https://platform.moonshot.ai) | Stesso account Kimi |za<sX>
| 0.1.3 | Creare una API Key | platform.moonshot.ai → Console → API Keys | Copiare e salvare la chiave in modo sicuro |
| 0.1.4 | Aggiungere variabile d'ambiente | Vercel → auth-deploy → Environment Variables | `KIMI_API_KEY` = la chiave creata |

### 0.2 Verificare la pipeline dati esistente

**Cosa significa “pipeline dati”:** per far analizzare un file dall’agente Kimi, il backend deve (1) avere i **token Figma** dell’utente (access + refresh) per chiamare l’API Figma, (2) poter chiedere a Figma il **JSON del file** (endpoint `GET /v1/files/:key`). Lo step 0.2 serve a verificare che questa catena funzioni **prima** di collegare Kimi: file aperto nel plugin → plugin invia `file_key` al backend → backend usa i token per scaricare il JSON → (in seguito) quel JSON verrà inviato a Kimi. Se 0.2 fallisce, anche l’agente non potrà ricevere il file.

| Step | Azione | Verifica |
|------|--------|----------|
| 0.2.1 | Eseguire migrazione DB | Supabase SQL Editor → `CREATE TABLE IF NOT EXISTS figma_tokens ...` | Tabella `figma_tokens` presente |
| 0.2.2 | Re-login Figma | Plugin → Logout → Login with Figma | Nuovo scope `file_content:read` concesso |
| 0.2.3 | Test `POST /api/figma/file` | Plugin → Scan su file salvato → Network tab | Risposta 200 con JSON del file |

**Dettaglio dei passi:**

- **0.2.1 — Migrazione DB**  
  La tabella `figma_tokens` salva, per ogni utente, `access_token`, `refresh_token` e `expires_at` restituiti da Figma OAuth. Senza questa tabella il backend non può chiamare l’API Figma al posto dell’utente.  
  **Come fare:** apri il progetto Supabase (o il DB usato da auth-deploy) → **SQL Editor**. Esegui lo script che crea `figma_tokens` (in `auth-deploy/schema.sql` è il blocco `CREATE TABLE IF NOT EXISTS figma_tokens ...`). Controlla in **Table Editor** che la tabella `figma_tokens` esista (può essere vuota).

- **0.2.2 — Re-login Figma (solo se serve)**  
  Per scaricare il contenuto del file (nodi, stili, ecc.) l’API Figma richiede lo scope **`file_content:read`**. Se hai fatto il login Figma **prima** che questo scope fosse aggiunto alla richiesta OAuth, il tuo token salvato non ha il permesso e `GET /v1/files/:key` può restituire 403 o dati limitati.  
  **Re-login** = una **sola volta**: nel plugin fai **Logout** (o “Disconnetti”), poi di nuovo **Login with Figma**. Durante l’autorizzazione accetta la schermata di permessi Figma; il backend salverà i nuovi token (con `file_content:read`) in `figma_tokens`.  
  **Non c’entra** con il “ricaricare il plugin da locale”: il token vive nel backend (DB); una volta fatto il re-login, non devi rifarlo ogni volta che apri o ricarichi il plugin in sviluppo.

- **0.2.3 — Test `POST /api/figma/file`**  
  È l’endpoint che il backend usa per ottenere il JSON del file: il plugin invia il `file_key` (e opzionalmente parametri), il backend legge i token da `figma_tokens`, eventualmente fa refresh se scaduti, chiama Figma `GET /v1/files/:key` e restituisce il JSON al plugin.  
  **Come fare:** nel plugin apri un **file Figma salvato** (non “untitled”, deve essere un file reale con un ID). Avvia uno **Scan** (o il flusso che chiama il backend con quel file). Apri gli **strumenti sviluppatore** del browser (F12) → tab **Network**. Cerca la richiesta a `POST .../api/figma/file` (o il path configurato). Controlla: **Status 200**; in **Response** vedi un JSON che rappresenta il file (es. oggetto con `name`, `document`, `components`, ecc.). Se vedi 401/403/500 o un messaggio di errore, controlla token, scope e log del backend (vedi `auth-deploy/SETUP.md` e `docs/OAUTH-FIGMA.md`).

---

## Fase 1 — Agente Design System Audit

### 1.1 Definire le regole di audit DS

| Step | Azione | Output |
|------|--------|--------|
| 1.1.1 | Elencare le regole da controllare | Documento o foglio | Lista numerata di regole (es. 10–20) |
| 1.1.2 | Per ogni regola: nome, descrizione, come rilevarla nel JSON Figma | Es. "Hardcoded Hex: colore in `fills` senza `boundVariables`" | Specifica operativa |
| 1.1.3 | Definire le categorie di issue | `adoption`, `coverage`, `naming`, `copy` (come in `types.ts`) | Mappatura regola → categoryId |
| 1.1.4 | Definire il formato di output JSON | Schema compatibile con `AuditIssue` (vedi `audit-specs/ds-audit/OUTPUT-SCHEMA.md`) | Esempio JSON di risposta attesa |

**Materiale da produrre:** cartella `audit-specs/ds-audit/` con:
- `DS-AUDIT-RULES.md` — elenco regole, dove cercare nel JSON Figma, severity, esempio di fix
- `OUTPUT-SCHEMA.md` — schema JSON di output e regole per l’agente
- `README.md` — guida alla cartella (vedi file già creati in repo)

### 1.2 Creare il prompt di sistema (system prompt)

| Step | Azione | Contenuto |
|------|--------|-----------|
| 1.2.1 | Scrivere l'intestazione del prompt | Ruolo e obiettivo | "Sei un auditor di design system. Analizzi file Figma in formato JSON." |
| 1.2.2 | Inserire le regole (da 1.1) | Elenco numerato | Copia-incolla da audit-specs/ds-audit/DS-AUDIT-RULES.md |
| 1.2.3 | Specificare il formato di output | JSON schema | "Restituisci solo un JSON valido con array `issues`. Ogni issue: id, categoryId, msg, severity, layerId, fix, tokenPath?, pageName?" |
| 1.2.4 | Aggiungere esempi (opzionale) | 1–2 issue di esempio | Aiuta il modello a capire il formato |
| 1.2.5 | Salvare in un file | `auth-deploy/prompts/ds-audit-system.md` (opzionale: riferirsi a `audit-specs/ds-audit/`) | File Markdown riutilizzabile |

**Materiale da produrre:** `auth-deploy/prompts/ds-audit-system.md`. Le regole dettagliate sono in `audit-specs/ds-audit/DS-AUDIT-RULES.md` e `OUTPUT-SCHEMA.md`.

### 1.3 Testare il prompt su kimi.com

**Guida operativa:** **docs/DS-AUDIT-FIRST-TEST.md** (passo-passo: copia prompt, JSON di test, incolla su kimi.com, verifica output).

| Step | Azione | Dove | Verifica |
|------|--------|------|----------|
| 1.3.1 | Esportare un file Figma di test | Figma → qualsiasi file con componenti, colori, testo | JSON scaricabile (o via `/api/figma/file`) |
| 1.3.2 | Ridurre il JSON se troppo grande | Tagliare a ~50–100 nodi per il test | File < 100 KB per evitare limiti contesto |
| 1.3.3 | Aprire [kimi.com](https://kimi.com) o [kimi.com/agent-swarm](https://www.kimi.com/agent-swarm) | Browser | Chat attiva |
| 1.3.4 | Primo messaggio: incollare il system prompt (da 1.2) | Campo messaggio | Invio |
| 1.3.5 | Secondo messaggio: "Ecco il JSON del file Figma: [incolla JSON]. Esegui l'audit e restituisci le issue in JSON." | Campo messaggio | Invio |
| 1.3.6 | Verificare la risposta | Output Kimi | JSON valido? Issue sensate? Severity corrette? |
| 1.3.7 | Iterare sul prompt | Modificare ds-audit-system.md e ritestare | Migliorare qualità e formato |

**Materiale da produrre:** 1–2 screenshot o copia della conversazione di test (per riferimento)

### 1.4 Implementare l'endpoint backend

| Step | Azione | File | Descrizione |
|------|--------|------|-------------|
| 1.4.1 | Creare `POST /api/agents/ds-audit` | `auth-deploy/oauth-server/app.mjs` | Nuova route che richiede JWT |
| 1.4.2 | Leggere `file_key` dal body | — | Validare presenza |
| 1.4.3 | Ottenere token Figma (getFigmaAccessToken) | — | Come per `/api/figma/file` |
| 1.4.4 | Chiamare Figma REST `GET /v1/files/:key` | — | Recuperare JSON (opzionale `depth=2` per file grandi) |
| 1.4.5 | Chiamare API Kimi | `https://api.moonshot.cn/v1/chat/completions` (o base URL ufficiale) | System message = contenuto di ds-audit-system.md, user message = JSON file |
| 1.4.6 | Parsare la risposta di Kimi | — | Estrarre JSON dalle risposte (può essere in blocchi ```json) |
| 1.4.7 | Validare e mappare a `AuditIssue[]` | — | Assicurare id, categoryId, msg, severity, layerId, fix |
| 1.4.8 | Restituire `{ issues: AuditIssue[] }` | — | Status 200 |
| 1.4.9 | Creare handler Vercel | `auth-deploy/api/agents/ds-audit.mjs` | Forward a app.mjs (come credits/consume) |

**Materiale necessario:** `KIMI_API_KEY` in Vercel, `auth-deploy/prompts/ds-audit-system.md`

### 1.5 Integrare nel plugin

| Step | Azione | File | Descrizione |
|------|--------|------|-------------|
| 1.5.1 | Aggiungere `fetchDsAudit(fileKey)` in App | `App.tsx` | Simile a `fetchFigmaFile`, chiama `POST /api/agents/ds-audit` |
| 1.5.2 | Passare `fetchDsAudit` ad Audit | `App.tsx` | Nuova prop |
| 1.5.3 | In AuditView, dopo `fetchFigmaFile` (o in parallelo) | `views/Audit/AuditView.tsx` | Chiamare `fetchDsAudit(fileKey)` |
| 1.5.4 | Salvare le issue ricevute in stato | `useState<AuditIssue[]>` | Sostituire o affiancare i mock |
| 1.5.5 | Filtrare le issue per tab DS | `DesignSystemTab` o `AuditView` | Mostrare solo `categoryId` in adoption, coverage, naming, copy |
| 1.5.6 | Gestire loading ed errori | — | Spinner, messaggio se fallisce |

**Materiale necessario:** Nessuno aggiuntivo; usa `AUTH_BACKEND_URL` e JWT già presenti

---

## Fase 2 — Agente Accessibility Audit

### 2.1 Definire le regole A11Y

| Step | Azione | Output |
|------|--------|--------|
| 2.1.1 | Elencare controlli A11Y | Documento | Contrast ratio, touch target, heading, alt text, color blindness |
| 2.1.2 | Per ogni controllo: come ricavarlo dal JSON | Es. contrast da `fills` + bounds, touch da `absoluteBoundingBox` | Specifica |
| 2.1.3 | Definire categorie | `contrast`, `touch`, `focus`, `alt`, ecc. | Mappatura |
| 2.1.4 | Definire formato output | Stesso `AuditIssue` | Coerenza con DS |

**Materiale da produrre:** `docs/A11Y-AUDIT-RULES.md`

### 2.2 Creare il prompt A11Y

| Step | Azione | File |
|------|--------|------|
| 2.2.1 | Scrivere system prompt | Ruolo + regole + formato output |
| 2.2.2 | Salvare | `auth-deploy/prompts/a11y-audit-system.md` |
| 2.2.3 | Testare su kimi.com | Come 1.3 |

### 2.3 Implementare e integrare

| Step | Azione |
|------|--------|
| 2.3.1 | Endpoint `POST /api/agents/a11y-audit` |
| 2.3.2 | `fetchA11yAudit` in App, prop ad Audit |
| 2.3.3 | Chiamare dopo/con DS audit, salvare issue A11Y |
| 2.3.4 | Mostrare nel tab A11Y |

**Materiale necessario:** `A11Y-AUDIT-RULES.md`, `a11y-audit-system.md`

---

## Fase 3 — Agente UX Audit

### 3.1 Definire le regole UX

| Step | Azione | Output |
|------|--------|--------|
| 3.1.1 | Elencare euristiche (Nielsen, spacing, navigazione, breakpoint) | Documento |
| 3.1.2 | Mappare su dati JSON Figma | Specifica |
| 3.1.3 | Formato output | `AuditIssue` |

**Materiale da produrre:** `docs/UX-AUDIT-RULES.md`

### 3.2 Prompt, endpoint, integrazione

| Step | Azione |
|------|--------|
| 3.2.1 | `auth-deploy/prompts/ux-audit-system.md` |
| 3.2.2 | Test su kimi.com |
| 3.2.3 | `POST /api/agents/ux-audit` |
| 3.2.4 | `fetchUxAudit`, tab UX |

---

## Fase 4 — Agente Prototype Audit

### 4.1 Definire le regole Prototype

| Step | Azione | Output |
|------|--------|--------|
| 4.1.1 | Elencare controlli (dead-end, missing interaction, flow completeness, Smart Animate) | Documento |
| 4.1.2 | Verificare dati `prototype` nel JSON Figma | Documentazione Figma REST |
| 4.1.3 | Formato output | `AuditIssue` |

**Materiale da produrre:** `docs/PROTO-AUDIT-RULES.md`

### 4.2 Prompt, endpoint, integrazione

| Step | Azione |
|------|--------|
| 4.2.1 | `auth-deploy/prompts/proto-audit-system.md` |
| 4.2.2 | Test su kimi.com |
| 4.2.3 | `POST /api/agents/proto-audit` |
| 4.2.4 | `fetchProtoAudit`, tab Prototype |

---

## Fase 5 — Code Agent (generazione codice)

### 5.1 Definire input e output

| Step | Azione | Output |
|------|--------|--------|
| 5.1.1 | Framework target (React, Vue, Liquid, Swift) | Scelta |
| 5.1.2 | Formato output (componente, Storybook story) | Specifica |
| 5.1.3 | Regole (Semantic HTML, Tailwind, ecc.) | Documento |

**Materiale da produrre:** `docs/CODE-AGENT-SPEC.md`

### 5.2 Prompt e integrazione

| Step | Azione |
|------|--------|
| 5.2.1 | System prompt per generazione codice |
| 5.2.2 | Endpoint `POST /api/agents/code-gen` |
| 5.2.3 | Integrazione nella view Code |

---

## Fase 6 — Generate Agent (wireframe, varianti)

### 6.1 Definire funzionalità

| Step | Azione | Output |
|------|--------|--------|
| 6.1.1 | Wireframe da token esistenti | Specifica |
| 6.1.2 | Varianti da componenti base | Specifica |
| 6.1.3 | Layout suggestions | Specifica |

**Materiale da produrre:** `docs/GENERATE-AGENT-SPEC.md`

---

## Riepilogo materiali per funzionalità

| Funzionalità | Documenti regole | Prompt | Endpoint | Note |
|--------------|------------------|--------|----------|------|
| DS Audit | `audit-specs/ds-audit/DS-AUDIT-RULES.md` | `ds-audit-system.md` | `/api/agents/ds-audit` | Priorità 1 |
| A11Y Audit | `A11Y-AUDIT-RULES.md` | `a11y-audit-system.md` | `/api/agents/a11y-audit` | Priorità 2 |
| UX Audit | `UX-AUDIT-RULES.md` | `ux-audit-system.md` | `/api/agents/ux-audit` | Priorità 3 |
| Prototype Audit | `PROTO-AUDIT-RULES.md` | `proto-audit-system.md` | `/api/agents/proto-audit` | Priorità 4 |
| Code Gen | `CODE-AGENT-SPEC.md` | `code-gen-system.md` | `/api/agents/code-gen` | Priorità 5 |
| Generate | `GENERATE-AGENT-SPEC.md` | `generate-system.md` | `/api/agents/generate` | Priorità 6 |

---

## Checklist ordine di esecuzione (MVP)

1. [ ] Fase 0: Account Kimi, API key, pipeline dati OK  
2. [ ] 1.1: Regole DS (già in `audit-specs/ds-audit/DS-AUDIT-RULES.md`)  
3. [ ] 1.2: Scrivere `ds-audit-system.md`  
4. [ ] 1.3: Testare su kimi.com con JSON reale  
5. [ ] 1.4: Implementare `POST /api/agents/ds-audit`  
6. [ ] 1.5: Integrare nel plugin, tab DS con issue reali  
7. [ ] (Opzionale) Lanciare DS + A11Y in parallelo dopo Fase 2  

---

## Note su limiti Vercel (12 funzioni)

Ogni nuovo file in `auth-deploy/api/` = 1 funzione. Con `api/agents/ds-audit.mjs` si aggiunge 1. Per aggiungere più agenti senza superare 12:

- **Opzione A:** Usare un unico handler `api/agents/[...slug].mjs` che instrada in base al path (ds-audit, a11y-audit, ecc.).
- **Opzione B:** Passare a piano Pro Vercel.
- **Opzione C:** Rimuovere temporaneamente un altro endpoint non critico.
