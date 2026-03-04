# Telemetria uso token (Kimi) — contatore anonimo per dashboard

Specifica per un **contatore di token utilizzati per azione** che gira in modo **anonimo**, non è visibile in UI nel plugin, e invia i dati alla **dashboard** così che il team abbia conteggi precisi (soprattutto in fase di test) e possa tarare la matrice token ↔ crediti (vedi [COST-ESTIMATE-DS-AUDIT.md § 2.1](./COST-ESTIMATE-DS-AUDIT.md)).

---

## 1. Obiettivo

- **Misurare in modo reale** quanti token (input + output) consuma ogni chiamata a Kimi per azione (DS Audit, future A11Y, Generate, ecc.) e, dove applicabile, per dimensione/band del file.
- **Non mostrare nulla in UI** nel plugin: l’utente non vede contatori o log; i dati sono solo lato backend/dashboard.
- **Anonimità:** non inviare user_id, file_key, email o altri identificativi; solo aggregati o record anonimi (action_type, token_in, token_out, eventuale band di dimensione, timestamp).

Risultato: in dashboard avremo **token per azione** (e per band) reali, per:
- confrontare con le stime del doc costi;
- verificare che la conversione token ↔ crediti sia profittevole;
- decidere se ricalibrare crediti per azione/dimensione.

---

## 2. Dove contare i token

**I token sono noti solo dove si chiama Kimi**, cioè nel **backend** (es. `auth-deploy/oauth-server/app.mjs` per `POST /api/agents/ds-audit`). La risposta dell’API Kimi (Moonshot) include in genere un oggetto **`usage`** con ad es. `input_tokens` e `output_tokens` (o `prompt_tokens` / `completion_tokens` a seconda del formato).

Quindi:
- **Il “contatore” non gira nel plugin:** il plugin invia la richiesta (es. Scan DS con `file_key`); il backend chiama Kimi, riceve la risposta con `usage` e **a quel punto** legge i token e li invia alla dashboard (o li salva in DB).
- **Nessun nuovo flusso lato UI:** nessun componente nel plugin mostra token o telemetria; tutto è invisibile all’utente.

Flusso:

1. **Plugin** → chiama `POST /api/agents/ds-audit` (o altro endpoint agente) con i parametri necessari (es. `file_key`, `depth`).
2. **Backend** → chiama Kimi, ottiene `kimiData` con `kimiData.usage` (input_tokens, output_tokens).
3. **Backend** → subito dopo la risposta Kimi, **registra** l’uso token (anonimo) e lo invia alla dashboard o lo persiste in DB.
4. **Dashboard** → espone (solo ad admin) metriche aggregate: token per azione, per band di dimensione, per giorno/settimana; nessun dato per singolo utente/file.

---

## 3. Cosa registrare (payload anonimo)

Per ogni chiamata Kimi completata con successo, registrare almeno:

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `action_type` | string | Es. `ds_audit`, `a11y_audit`, `generate`, … |
| `input_tokens` | number | Token in input (prompt + user message) |
| `output_tokens` | number | Token in output (completion) |
| `created_at` | ISO timestamp | Quando è avvenuta la chiamata |

Opzionali (utili per tarare la matrice crediti per dimensione):

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `size_band` | string | Es. `small`, `medium`, `large`, `200k+` (derivato da node count o da tier già calcolato nel backend) |
| `model` | string | Modello Kimi usato (es. `kimi-k2-0905-preview`) |

**Non** includere: `user_id`, `file_key`, `email`, o qualsiasi dato che identifichi utente o file.

---

## 4. Dove persistere / inviare i dati

Due opzioni coerenti con il resto del progetto:

- **Opzione A — Tabella in Postgres (consigliata)**  
  Creare una tabella tipo `kimi_usage_log` (o `token_usage`) con colonne: `id`, `action_type`, `input_tokens`, `output_tokens`, `size_band` (nullable), `model` (nullable), `created_at`.  
  Il backend, dopo ogni risposta Kimi con `usage`, fa un `INSERT` anonimo. La **dashboard** legge da questa tabella (aggregati per action_type, size_band, data) e non espone mai righe singole identificabili.

- **Opzione B — Endpoint dedicato verso la dashboard**  
  Il backend, dopo la risposta Kimi, invia un `POST` a un endpoint interno della dashboard (o a un servizio di logging) con il payload anonimo; la dashboard (o un job) aggrega e mostra. Richiede che la dashboard esponga un API sicura (solo backend, auth) e che si definisca dove vengono conservati i dati.

La **dashboard** (vedi [ADMIN-DASHBOARD-PROPOSAL.md](./ADMIN-DASHBOARD-PROPOSAL.md)) già prevede “Costi Kimi” e “Opzione B (futuro): salvare in una tabella kimi_usage …”. Questa spec implementa proprio quella opzione: **tabella `kimi_usage` (o simile) + lettura in dashboard per metriche aggregate**.

---

## 5. Implementazione backend (punto di integrazione)

Nel file dove si gestisce la risposta Kimi (es. `auth-deploy/oauth-server/app.mjs`, handler `POST /api/agents/ds-audit`):

1. Dopo `const kimiData = await kimiRes.json();`
2. Estrarre `usage` da `kimiData` (es. `kimiData.usage?.input_tokens`, `kimiData.usage?.output_tokens` — verificare il nome esatto dei campi nella risposta Moonshot).
3. Calcolare eventuale `size_band` se già disponibile (es. dal node count del file Figma usato per la richiesta, mappato a small/medium/large/200k+).
4. Inserire una riga in `kimi_usage_log` (o chiamare l’endpoint di telemetria) con i campi anonimi sopra.
5. Non restituire `usage` nella risposta al plugin (opzionale: si può lasciare fuori dal JSON così l’UI non vede mai i token).

Se l’API Kimi non restituisse `usage`, si può comunque registrare `action_type` + `size_band` + `created_at` e stimare i token in dashboard con la formula del doc costi, fino a quando non si ha un formato di risposta con usage.

---

## 6. Dashboard — cosa mostrare

- **Nascosto al pubblico:** solo utenti admin vedono queste metriche.
- **Nessun dato per utente/file:** solo aggregati, ad es.:
  - Token totali (input + output) per `action_type` (oggi / 7d / 30d).
  - Token medi per chiamata per `action_type` e, se presente, per `size_band`.
  - Costo Kimi stimato nel periodo (token × prezzo per token dal doc costi).
  - Confronto con le stime del doc (es. “DS Audit: stimati ~35k token/scan, reali medi 28k”) per tarare meglio la matrice.

Così, **quando testeremo**, avremo un conteggio preciso e potremo aggiornare il doc costi e la conversione token ↔ crediti per restare in guadagno.

---

## 7. Riferimenti

- Matrice token ↔ crediti e profittabilità: **docs/COST-ESTIMATE-DS-AUDIT.md** § 2.1.
- Dashboard admin e costo Kimi: **docs/ADMIN-DASHBOARD-PROPOSAL.md** § 1.3 (Opzione B).
- Backend DS Audit: **auth-deploy/oauth-server/app.mjs** (route `POST /api/agents/ds-audit`).
- Prezzi Kimi per token: **docs/COST-ESTIMATE-DS-AUDIT.md** § 2.
