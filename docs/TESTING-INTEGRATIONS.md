# Strategia test integrazioni (Auth, Credits, XP, Trofei, Affiliazione)

Come testare le integrazioni con il backend (auth.comtra.dev) e Supabase. **Approccio consigliato:** account di test nel plugin + **Lemon Squeezy in Test Mode** per acquisti e affiliazione finti (carte di test, webhook reali). In alternativa, endpoint di simulazione o replay webhook quando non puoi usare il Test Mode (es. CI).

---

## Account di test e Supabase

**Gli account di test** (vedi `constants.ts` → `TEST_USER_EMAILS`; attualmente vuoto) **finiscono già in Supabase** come tutti gli altri: al primo **Login with Figma** il callback OAuth crea/aggiorna la riga in `users`. Nessuna configurazione speciale: stessi flusso e stesse tabelle.

Nel **frontend** le email in `TEST_USER_EMAILS` abilitano crediti “infiniti” e la voce “Simula Free Tier”; il backend non distingue i test user e li tratta come gli altri.

---

## 1. Auth e utenti in DB

- **Check server**: dalla root del plugin, `npm run check-auth` (verifica che auth.comtra.dev risponda e che le route OAuth esistano).
- **Login**: apri il plugin in Figma → “Login with Figma” → completa il flusso nel browser.
- **Verifica DB**: in Supabase → Table Editor → `users`. Cerca la riga con `email` = l’email con cui hai fatto login (o `id` = Figma user id se lo conosci). Dopo il primo login la riga c’è; ai login successivi viene aggiornata (email, name, img_url, updated_at). Gli account di test sono in tabella come gli altri.

---

## 2. Crediti

- **Stato iniziale**: dopo il login, GET `/api/credits` (o il plugin che lo chiama) deve restituire `credits_remaining` (es. 25 per nuovo utente). In Supabase, `users.credits_total` e `credits_used`.
- **Consumo**: dal plugin, esegui un’azione che consuma crediti (es. Audit → Scan → Authorize Charge). Poi controlla:
  - Plugin: il contatore crediti scende.
  - Supabase: `users.credits_used` aumentato, una nuova riga in `credit_transactions` con `action_type` e `credits_consumed`.
- **Test user**: con “Simula Free Tier” OFF le chiamate vanno al backend e i dati sono reali in DB. Con “Simula Free Tier” ON il consumo è solo locale e il backend non viene chiamato.

---

## 3. XP e livelli

- **Dopo un consumo**: la risposta di POST `/api/credits/consume` include `total_xp`, `current_level`, `xp_for_next_level`, `level_up` (se sei salito). In Supabase: `users.total_xp` e `current_level` aggiornati, una riga in `xp_transactions`.
- **UI**: vista STATS/Analytics mostra livello e barra XP; dopo un level up appare il modal “Level Up!”.
- **Test**: fai più audit (o altre azioni che danno XP) e verifica in DB che `total_xp` e le righe in `xp_transactions` crescano; al superamento soglia che `current_level` aumenti e che il frontend mostri il modal.

---

## 4. Trofei

- **GET `/api/trophies`**: con utente loggato (Bearer token) restituisce la lista trofei con `unlocked` e `unlocked_at`. In Supabase, `user_trophies` ha una riga per ogni trofeo sbloccato.
- **Sblocco**: dopo un’azione che fa scattare una condizione (es. primo audit → NOVICE_SPROUT), la risposta di `consume` può contenere `new_trophies: [{ id, name }]`; il plugin mostra il toast e aggiorna la Trophy Case.
- **Test puntuale**: esegui azioni che soddisfano condizioni (es. 10 audit per SOLID_ROCK, 500 XP per SILVER_SURFER) e verifica in `user_trophies` le nuove righe e in UI il contatore X/20 e i trofei colorati. Per test rapidi puoi temporaneamente abbassare una soglia in DB (es. `audits_min` da 10 a 1) e poi rimetterla.

---

## 5. Affiliazione

### Percorso consigliato: Lemon Squeezy Test Mode + account di test

Lemon Squeezy ha una **Test Mode** (attiva di default per store nuove): acquisti finti con carte di test, **webhook reali** (Order created, ecc.). Puoi testare l’intero flusso affiliazione senza soldi veri.

1. **Lemon Squeezy Dashboard**  
   - Attiva **Test Mode** (toggle in dashboard).  
   - Crea un prodotto “published” in test mode (visibile solo a te).  
   - Configura il webhook per **Order created** su `https://auth.comtra.dev/api/webhooks/lemonsqueezy` (usa il **signing secret di test** in Vercel se Lemon distingue test/live per i webhook).

2. **Plugin con account di test**  
   - Login con un account di test (es. email in `TEST_USER_EMAILS`).  
   - Profilo → Affiliate Program → “Ottieni il tuo codice affiliato”. Verifica in Supabase: tabella `affiliates` con una riga, `total_referrals = 0`.  
   - Copia il link con `?aff=CODICE` (o costruiscilo: checkout Lemon + `?aff=CODICE`).

3. **Acquisto finto**  
   - Apri il link di checkout (Share/Preview dal prodotto in test mode) **con** `?aff=CODICE` nell’URL.  
   - Completa il checkout con **carta di test** (es. Visa: `4242 4242 4242 4242`, scadenza futura, CVC qualsiasi).  
   - Lemon invia il webhook Order created; il backend incrementa `affiliates.total_referrals` per quel codice.

4. **Verifica**  
   - Supabase: `affiliates.total_referrals` aumentato.  
   - Nel plugin: profilo / STATS → contatore AFFILIATES aggiornato.

Così usi **finti acquisti e finte affiliazioni** direttamente su Lemon, senza endpoint custom.

---

### Alternativa: simulazione referral (senza checkout Lemon)

Quando non puoi usare Test Mode (es. CI, automazione), puoi simulare un referral via API:

1. **Vercel**: imposta `TEST_AFFILIATE_SECRET` (es. `openssl rand -hex 16`). Se non è impostata, l’endpoint risponde 401.
2. **Chiamata**:  
   `POST https://auth.comtra.dev/api/test/simulate-referral`  
   Header: `X-Test-Secret: <TEST_AFFILIATE_SECRET>`  
   Body: `{ "affiliate_code": "IL_CODICE_AFFILIATO" }`
3. **Effetto**: il backend incrementa `total_referrals` per quell’affiliato (come farebbe il webhook Lemon).
4. **Verifica**: Supabase `affiliates.total_referrals`; contatore in profilo/STATS.

Esempio:

```bash
curl -X POST https://auth.comtra.dev/api/test/simulate-referral \
  -H "Content-Type: application/json" \
  -H "X-Test-Secret: IL_TUO_TEST_AFFILIATE_SECRET" \
  -d '{"affiliate_code":"IL_CODICE_AFFILIATO"}'
```

### Alternativa: replay del webhook Lemon

Per testare firma e formato del webhook (es. integrazione custom):

1. Costruisci un JSON come quello di Lemon per `order_created`, con `meta.custom_data.aff = "CODICE"`.  
2. Calcola HMAC-SHA256 del body con `LEMON_SQUEEZY_WEBHOOK_SECRET`, header `X-Signature`.  
3. POST a `https://auth.comtra.dev/api/webhooks/lemonsqueezy`.  
4. Verifica in DB `affiliates.total_referrals`.

---

## Riepilogo checklist

| Area        | Cosa verificare |
|------------|------------------|
| Auth       | Login → riga in `users` in Supabase; `npm run check-auth` OK. |
| Crediti    | Consumo da plugin → `credits_used` e `credit_transactions` aggiornati. |
| XP/Livelli | Consumo → `total_xp`, `current_level`, `xp_transactions`; UI livello e barra; level up modal. |
| Trofei     | Azioni che soddisfano condizioni → `user_trophies`; GET `/api/trophies`; toast e Trophy Case. |
| Affiliazione | **Consigliato:** Lemon Test Mode + account di test + link `?aff=CODICE` + acquisto con carta di test → webhook reale → `total_referrals`. **Alternativa:** endpoint `simulate-referral` o replay webhook. |

---

Riferimenti Lemon Squeezy: [Test Mode](https://docs.lemonsqueezy.com/help/getting-started/test-mode), [Simulate Webhook Events](https://docs.lemonsqueezy.com/help/webhooks/simulate-webhook-events).
