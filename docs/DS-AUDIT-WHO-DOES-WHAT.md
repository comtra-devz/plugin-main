# Design System Audit — Chi fa cosa (in ordine)

Elenco **ordinato** degli step per portare l’agente DS Audit dal setup al primo test fino all’integrazione nel plugin. Per ogni step è indicato se **devi farlo tu** (login, browser, deploy, test manuale) o se **può farlo l’assistente** (codice, file, modifiche in repo).

---

## Fase 0 — Prerequisiti

| # | Chi | Cosa fare |
|---|-----|-----------|
| 1 | **Tu** | Creare account su kimi.com e accedere a platform.moonshot.ai. Creare una API Key (Console → API Keys), copiarla e salvarla. Aggiungere in Vercel (progetto auth-deploy → Settings → Environment Variables) la variabile `KIMI_API_KEY` con quel valore. |
| 2 | **Tu** | Verificare la pipeline dati: eseguire la migrazione che crea la tabella `figma_tokens` (Supabase SQL Editor, script in `auth-deploy/schema.sql`). Poi nel plugin: Logout → Login with Figma (per ottenere lo scope `file_content:read`). Infine test: apri un file Figma salvato, fai Scan, in Network controlla che `POST /api/figma/file` risponda 200 con JSON del file. |

*L’assistente non può fare login, creare key, accedere al tuo Vercel o al tuo DB; non può usare il plugin nel browser.*

---

## Fase 1 — Regole e prompt (già pronti)

| # | Chi | Cosa fare |
|---|-----|-----------|
| 3 | **Assistente** | Regole e schema sono già in `audit-specs/ds-audit/` (DS-AUDIT-RULES.md, OUTPUT-SCHEMA.md, ecc.). Il system prompt è già in `auth-deploy/prompts/ds-audit-system.md`. L’assistente può **modificare** regole o prompt su tua richiesta (es. aggiungere una regola, cambiare severity, chiarire il formato output). |

---

## Fase 2 — Primo test su kimi.com

| # | Chi | Cosa fare |
|---|-----|-----------|
| 4 | **Tu** | **Primo test in chat:** apri **docs/DS-AUDIT-FIRST-TEST.md** e segui gli step: (1) copia tutto il contenuto di `auth-deploy/prompts/ds-audit-system.md`; (2) ottieni un JSON di test (da plugin/Network se hai la pipeline, oppure usa il JSON minimo nel doc); (3) apri kimi.com, nuova chat; (4) primo messaggio = incolla il prompt, invia; (5) secondo messaggio = “Ecco il JSON del file…” + incolla JSON, invia; (6) verifica che la risposta sia un JSON valido con `issues` e campi corretti. |
| 5 | **Tu** | Se la risposta non è corretta (testo extra, categoryId sbagliati, campi mancanti): modifica il prompt in `ds-audit-system.md` e ritesta. Puoi chiedere all’**assistente** di proporti le modifiche al prompt (es. “restituisci solo JSON”, “categoryId solo tra: …”). |

*L’assistente non può aprire kimi.com né incollare messaggi per te; può solo suggerire o applicare modifiche al file del prompt.*

---

## Fase 3 — Endpoint backend

| # | Chi | Cosa fare |
|---|-----|-----------|
| 6 | **Assistente** | Implementare l’endpoint `POST /api/agents/ds-audit`: leggere `file_key` (e JWT) dal body; usare getFigmaAccessToken e chiamare Figma `GET /v1/files/:key`; leggere il system prompt da `auth-deploy/prompts/ds-audit-system.md`; chiamare `POST https://api.moonshot.ai/v1/chat/completions` con Bearer `KIMI_API_KEY`, model e messages (system + user con JSON file); estrarre il JSON dalla risposta (anche da blocco \`\`\`json); validare/mappare a `AuditIssue[]`; restituire `{ issues }`. Creare eventuale handler Vercel (rispettando il limite 12 funzioni). |
| 7 | **Tu** | Verificare che il backend sia deployato (push su Vercel o redeploy) e che `KIMI_API_KEY` sia impostata nell’ambiente. Testare l’endpoint (es. con Postman o curl) inviando `file_key` e JWT: risposta 200 con `{ "issues": [ ... ] }`. |

*L’assistente scrive il codice; tu fai deploy e il test della chiamata HTTP.*

---

## Fase 4 — Integrazione nel plugin

| # | Chi | Cosa fare |
|---|-----|-----------|
| 8 | **Assistente** | Implementare nel plugin: in App.tsx creare `fetchDsAudit(fileKey)` che chiama `POST /api/agents/ds-audit` (con JWT); passare `fetchDsAudit` alla vista Audit; in AuditView, dopo o insieme a `fetchFigmaFile`, chiamare `fetchDsAudit(fileKey)` e salvare le issue in stato (sostituendo o affiancando i mock); nel tab Design System mostrare le issue ricevute (lista, severity, fix) e gestire loading/errore. |
| 9 | **Tu** | Test end-to-end: apri il plugin in Figma, apri un file salvato, avvia Scan (o il flusso che usa il file); controlla che nel tab Design System compaiano le issue restituite da Kimi (non più solo mock). In caso di errore (rete, 401, formato): controllare console/Network e, se serve, chiedere all’assistente di correggere il codice o il parsing. |

*L’assistente scrive il codice del plugin; tu esegui il plugin in Figma e verifichi il comportamento.*

---

## Riepilogo

| Ruolo | Step |
|-------|------|
| **Tu** | 1 (account + API key + Vercel), 2 (pipeline: DB, re-login, test /api/figma/file), 4 (test su kimi.com), 5 (iterare prompt se serve), 7 (deploy + test endpoint), 9 (test plugin in Figma). |
| **Assistente** | 3 (modifiche a regole/prompt su richiesta), 6 (implementare endpoint ds-audit), 8 (implementare fetchDsAudit e UI nel plugin). |

Per i dettagli operativi: **docs/DS-AUDIT-FIRST-TEST.md** (test chat), **docs/ACTION-PLAN-KIMI-AGENTS.md** (piano completo), **docs/KIMI-FOR-DUMMIES.md** (setup e uso Kimi).
