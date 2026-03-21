# Dashboard admin: errori 500 e riepilogo sezioni

## Perché vedevi molti 500

Le route della dashboard (Sicurezza e log, Supporto, A/B tests, Codici sconto, ecc.) leggono da **tabelle Postgres** create da migration o dallo `schema.sql` completo. Se sul DB:

- **migration non eseguita** (es. `user_level_discounts`, `generate_ab_requests`, `throttle_events`, `support_tickets`), oppure  
- **DB creato da uno schema vecchio** senza quelle tabelle,

allora le query falliscono e l’API restituiva **500**.

### Cosa è stato fatto

Gli handler delle route che dipendono da tabelle “opzionali” sono stati resi **resilienti**:

- Se l’errore è del tipo “relation/table/column does not exist”, la risposta è **200** con dati vuoti (0, `[]`, struttura minima) invece di 500.
- Le pagine della dashboard si aprono comunque e mostrano “nessun dato” / “0” invece di errore generico.

Route interessate: **discounts-stats**, **discounts-level**, **discounts-throttle**, **generate-ab-stats**, **support-feedback**, **plugin-logs**, **users** (colonna ricarica), **recharge**, **credits-timeline** (vedi sotto).

### Timeline crediti / grafico (`credits-timeline`)

- Se la query aggregata su `credit_transactions` fallisce (tabella assente, errore SQL, ecc.), l’handler risponde **200** con `timeline: []`, `by_action_per_day: {}` e un messaggio in **`kimi_note`** (testo di diagnosi troncato), così la Home / Crediti non restano con fetch in 500 a cascata.
- Con filtro **`plan=PRO|FREE`**, se il join con `users` fallisce (schema diverso), si fa **fallback** alla timeline non filtrata e `kimi_note` spiega il fallback.
- Per dati reali sul grafico: migration/schema allineati e `POSTGRES_URL` corretto sul progetto Vercel della dashboard.

Mapping architettura dashboard ↔ plugin (nessun canale diretto): **[DASHBOARD-PLUGIN-COMUNICAZIONI.md](./DASHBOARD-PLUGIN-COMUNICAZIONI.md)**.

Per avere **dati reali** in quelle sezioni serve:

1. Eseguire le migration (o lo schema completo) sul DB usato dalla dashboard.  
2. Dove serve, avere i servizi attivi (Lemon per codici sconto, Kimi per A/B Generate, ecc.).

---

## Riepilogo sezioni

### A/B test Generate (pagina “A/B tests”)

- **Cosa sono:** test A/B sulla tab **Generate** del plugin. Due varianti:
  - **A:** flusso “Direct” (Kimi genera direttamente il risultato).
  - **B:** flusso “ASCII wireframe first” (prima wireframe in testo, poi conversione in componenti).
- **Cosa fa la dashboard:** mostra richieste per variante, token/costi Kimi, crediti consumati, latenza, **feedback** (thumbs up/down + commento) lasciato dall’utente dopo la generazione.
- **Tabelle DB:** `generate_ab_requests` (user_id, variant, input_tokens, output_tokens, credits_consumed, latency_ms, created_at), `generate_ab_feedback` (request_id, variant, thumbs, comment).
- **Perché “manca il risultato”:** i dati si riempiono quando il **plugin chiama il backend** (auth) per la generazione e il backend usa **Kimi**. Se Kimi non è ancora collegato o il flusso Generate non scrive ancora in queste tabelle, la dashboard mostra 0 richieste / dati vuoti. La logica A/B (assegnazione variante, salvataggio richiesta e feedback) è già implementata lato backend/plugin; manca solo il collegamento Kimi e il flusso completo che popola le tabelle.

Riferimento implementazione: `auth-deploy/oauth-server/app.mjs` (route generate/agents), `auth-deploy/migrations/002_generate_ab.sql` (o schema.sql).

---

### Codici sconto (pagina “Codici sconto”)

- **Cosa sono:**  
  - **Livello (gamification):** codici univoci 5% / 10% / 15% / 20% sbloccati ai livelli 5, 10, 15, 20 (solo piano Annual). Creati via **Lemon Squeezy API** quando l’utente fa level up.  
  - **Throttle:** codice 5% una tantum (valido 1 settimana) dato a chi ha ricevuto 503/throttle.
- **Tabelle DB:** `user_level_discounts`, `user_throttle_discounts` (entrambe con `lemon_discount_id`, `code`, ecc.).
- **Perché potresti vedere 0 o 500:**  
  - Se le **migration** che creano `user_level_discounts` e `user_throttle_discounts` non sono state eseguite → prima davano 500, ora la dashboard risponde con dati vuoti.  
  - Se **Lemon non è ancora attivo** (`LEMON_SQUEEZY_API_KEY`, `LEMON_SQUEEZY_STORE_ID`), il backend non crea/aggiorna codici su Lemon quindi le tabelle restano vuote (0 codici). I level up e il throttle funzionano comunque lato logica; mancano solo i codici effettivi creati via API Lemon.

Riferimento: [GAMIFICATION-DISCOUNT-FINANCIAL.md](./GAMIFICATION-DISCOUNT-FINANCIAL.md), [GAMIFICATION.md](./GAMIFICATION.md), `auth-deploy/oauth-server/lemon-discounts.mjs`.

---

### Sicurezza e log (Throttle / Plugin logs)

- **Cosa sono:**  
  - **Throttle events:** eventi “utente ha ricevuto 503” (rate limit). La dashboard mostra totali, andamento per giorno, ultimi eventi.  
  - **Plugin logs:** stessa fonte dati (`throttle_events`) con etichetta “Limite richieste” e suggerimento di fix (attendere 15 min, piano superiore, verificare rate limit backend).
- **Tabella DB:** `throttle_events` (user_id, occurred_at).
- Se la tabella non esisteva, la route andava in 500; ora in quel caso restituisce 200 con liste vuote.

---

### Supporto (Supporto / Feedback)

- **Cosa sono:** elenco unificato di:  
  - **Feedback A/B Generate:** thumbs + commento lasciati dagli utenti dopo una generazione (da `generate_ab_feedback` + `generate_ab_requests`).  
  - **Support tickets:** messaggi inviati dalla sezione Documentation & Help (tabella `support_tickets`).
- **Tabelle DB:** `generate_ab_feedback`, `generate_ab_requests`, `support_tickets` (opzionale).
- Se una di queste tabelle non esiste, la route ora restituisce 200 con gli item disponibili (o lista vuota) invece di 500.

---

## Cosa fare per avere dati reali

1. **DB:** Eseguire tutte le migration (o applicare `auth-deploy/schema.sql`) sul database usato dalla dashboard (stesso `POSTGRES_URL` / `DATABASE_URL`).  
2. **Lemon:** Configurare `LEMON_SQUEEZY_API_KEY` e `LEMON_SQUEEZY_STORE_ID` nel backend auth per creare i codici sconto (livello e throttle).  
3. **Kimi / Generate:** Collegare il flusso Generate al backend che usa Kimi e che scrive in `generate_ab_requests` (e feedback in `generate_ab_feedback`) per popolare la pagina A/B tests.  
4. **Ricarica crediti admin:** Eseguire la migration `007_admin_recharge.sql` e configurare Resend per l’email del PIN (vedi [ADMIN-RECHARGE-CREDITS.md](./ADMIN-RECHARGE-CREDITS.md)).

Dopo questi passi, le stesse route che prima potevano dare 500 restituiranno dati pieni (e la dashboard mostrerà risultati reali invece di zeri).

---

## Consumi per piano (PRO vs FREE)

- **Stats (`GET /api/admin?route=stats`):** in `credits` compaiono `credits_consumed_30d` (tutti), `credits_consumed_30d_pro` e `credits_consumed_30d_free` (join `credit_transactions` → `users`, escluso `admin_recharge`, solo `GREATEST(credits_consumed, 0)`).  
- **Timeline (`GET /api/admin?route=credits-timeline&period=…&plan=PRO|FREE`):** opzionale `plan` per filtrare scan/crediti giornalieri per piano. Con `plan` attivo le serie **Kimi** (telemetria anonima) non sono attribuibili al piano: restano a 0 e la risposta include `kimi_note`.  
- **Storico utilizzo (`function-executions`, `executions-users`):** query opzionale `plan=PRO|FREE` per elenchi e conteggi solo utenti con quel `users.plan` attuale.
