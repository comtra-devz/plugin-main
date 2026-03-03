# Pipeline analisi e gestione knowledge per gli agenti

Risposte rapide a: (1) l’export JSON è un problema per l’analisi reale? (2) quando il file viene analizzato davvero? (3) dove gestire la knowledge per Moonshot/Kimi e altri agenti.

---

## 1. Export JSON nel plugin vs analisi reale

### L’export JSON (“Export file JSON for Kimi”) a cosa serve?

- **Test manuali su kimi.com:** copi il JSON negli appunti, lo incolli in chat, verifichi che il system prompt risponda bene (formato issue, categoryId, severity). Non serve codice backend.
- **Verifica pipeline:** se l’export funziona (200 da `POST /api/figma/file`, JSON in clipboard), allora token Figma, `file_key` e backend sono OK. Stessa catena userà l’endpoint degli agenti.

### L’analisi “vera” del file chi la fa?

**L’analisi la fa il backend**, non il plugin.

Flusso previsto (quando esisterà `POST /api/agents/ds-audit`):

1. **Plugin** invia solo `file_key` (+ JWT) al backend (es. dopo Scan + Conferma, o da un bottone “Run DS Audit”).
2. **Backend** con il token Figma dell’utente (da `figma_tokens`) chiama **Figma** `GET /v1/files/:key` e ottiene il JSON del file.
3. **Backend** invia quel JSON a **Kimi** (system prompt + user message con il JSON).
4. **Kimi** restituisce le issue; il backend le mappa e le restituisce al plugin.
5. **Plugin** mostra le issue nel tab Design System (sostituendo/affiancando i mock).

Quindi **il plugin non deve “generare” o inviare il JSON del file** per l’analisi: deve solo passare il `file_key`. A scaricare il JSON da Figma e a inviarlo a Kimi ci pensa il backend (stesso meccanismo di `POST /api/figma/file`).

### L’export nel plugin deve funzionare “a mani basse”?

**Sì**, per due motivi:

1. **Test rapidi:** poter esportare il JSON e incollarlo su kimi.com senza passare da Network/curl.
2. **Stessa pipeline:** se `POST /api/figma/file` risponde 200 con l’export, allora token e `file_key` sono corretti; quando aggiungerai `POST /api/agents/ds-audit`, userà gli stessi token e lo stesso `GET /v1/files/:key`, quindi l’analisi reale funzionerà.

In sintesi: l’impossibilità di generare l’export non “blocca” l’analisi futura in sé (il backend farà tutto), ma è un segnale che la pipeline (token, file_key, backend) va sistemata; una volta che l’export funziona, anche l’analisi via agenti avrà i dati giusti.

---

## 2. Dove gestire la knowledge per gli agenti (Moonshot / Kimi)

Con “knowledge” si intende: regole di audit, formato di output, esempi, riferimenti che gli agenti devono usare.

### Opzione attuale (consigliata): file nel repo

| Cosa | Dove | Uso |
|------|------|-----|
| **System prompt** (ruolo + regole + formato output) | `auth-deploy/prompts/<nome>-system.md` | Il backend legge il file e lo invia come messaggio di sistema nella chiamata a Moonshot (`POST .../v1/chat/completions`). |
| **Regole dettagliate** (dove cercare nel JSON, severity, fix) | `audit-specs/<nome-agente>/` (es. `DS-AUDIT-RULES.md`, `OUTPUT-SCHEMA.md`) | Fonte per scrivere/aggiornare il system prompt; il prompt può includere una sintesi o riferirsi a esse. |
| **Test del prompt** | kimi.com (chat) | Primo messaggio = contenuto di `*-system.md`, secondo = JSON file (o input di test). |

Esempi:

- **DS Audit:** `auth-deploy/prompts/ds-audit-system.md` + `audit-specs/ds-audit/DS-AUDIT-RULES.md`, `OUTPUT-SCHEMA.md`
- **Altri agenti:** `auth-deploy/prompts/a11y-audit-system.md`, `ux-audit-system.md`, ecc. (vedi **docs/ACTION-PLAN-KIMI-AGENTS.md**).

Nessun “knowledge base” separato su Moonshot: con l’API Chat Completions tutto ciò che l’agente deve sapere va in **system** (e eventualmente **user**) message. I file `.md` nel repo sono la tua unica fonte di truth; il backend li legge a ogni richiesta.

### Moonshot / Kimi: Knowledge “nella piattaforma”?

- **platform.moonshot.ai** (API): l’uso standard è system + user message. Non c’è un concetto “Knowledge base”/RAG nelle chiamate Chat Completions che usiamo.
- Se in futuro Moonshot aggiungesse “Knowledge” o “File upload” come contesto persistente, si potrebbe valutare di spostare lì documenti molto grandi; per ora **gestire la knowledge nei file del repo** è sufficiente e versionabile.

### Riassunto pratica

- **Modificare le regole / il comportamento di un agente:**  
  - Regole → `audit-specs/<agente>/`  
  - Istruzioni per il modello → `auth-deploy/prompts/<agente>-system.md`  
  - Test a mano → kimi.com con prompt + JSON (o altro input).
- **Aggiungere un nuovo agente:**  
  - Nuova cartella in `audit-specs/`, nuovo `*-system.md` in `auth-deploy/prompts/`, nuovo endpoint `POST /api/agents/<nome>` che legge quel prompt e chiama Kimi (vedi **docs/KIMI-FOR-DUMMIES.md** e **docs/ACTION-PLAN-KIMI-AGENTS.md**).

---

## Riferimenti

- **Pipeline dati e step 0.2:** docs/ACTION-PLAN-KIMI-AGENTS.md (Fase 0)
- **Chi fa cosa per DS Audit:** docs/DS-AUDIT-WHO-DOES-WHAT.md
- **Setup Kimi e test prompt:** docs/KIMI-FOR-DUMMIES.md
- **Prompts nel backend:** auth-deploy/prompts/README.md
