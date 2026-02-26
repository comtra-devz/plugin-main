# Strategia test integrazioni (Auth, Credits, XP, Trofei, Affiliazione)

Come testare in modo puntuale le integrazioni con il backend (auth.comtra.dev) e Supabase, incluso l’affiliazione senza acquisti reali.

---

## Account di test e Supabase

**Gli account di test (es. ben.bugli@gmail.com, foscacordidonne@gmail.com) finiscono già in Supabase** come tutti gli altri: al primo **Login with Figma** il callback OAuth fa `INSERT INTO users ... ON CONFLICT DO UPDATE`, quindi viene creata/aggiornata la riga in `users` (id = Figma user id, email, name, crediti, total_xp, current_level, ecc.). Non c’è nessun bypass per gli account di test: stessi flusso e stesse tabelle.

La sola differenza è **nel frontend** (`constants.ts` → `TEST_USER_EMAILS`): per quelle email il plugin può dare crediti “infiniti” e la voce “Simula Free Tier”. Il backend non conosce il concetto di “test user” e tratta tutti allo stesso modo. Quindi sì, gli account di test risultano nelle tabelle Supabase non appena fai login con uno di quegli account.

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

## 5. Affiliazione (senza acquisti reali)

Non potendo fare acquisti veri su Lemon Squeezy, puoi testare così:

### A) Registrazione affiliato e link

- Login con un account (anche di test).
- Profilo → Affiliate Program → “Ottieni il tuo codice affiliato”. Il backend crea una riga in `affiliates` (user_id, affiliate_code).
- Verifica in Supabase: tabella `affiliates` con una riga per quell’utente, `total_referrals = 0`.
- Copia il link con `?aff=CODICE` e verifica che apra il checkout Lemon (non serve completare l’acquisto).

### B) Simulazione referral (endpoint di test)

Per simulare “qualcuno ha comprato con il tuo codice” senza usare il webhook reale di Lemon:

1. **Variabile in Vercel**: aggiungi `TEST_AFFILIATE_SECRET` (es. una stringa casuale tipo `openssl rand -hex 16`). Se **non** la imposti, l’endpoint risponde 401 e non fa nulla (puoi lasciarlo disattivato in produzione).
2. **Endpoint**: `POST https://auth.comtra.dev/api/test/simulate-referral`
3. **Header**: `X-Test-Secret: <valore di TEST_AFFILIATE_SECRET>`
4. **Body**: `{ "affiliate_code": "IL_CODICE_AFFILIATO" }` (il codice che vedi in Affiliate Program).
5. **Effetto**: il backend incrementa `total_referrals` per quella riga in `affiliates`, come farebbe il webhook Lemon.
6. **Verifica**: in Supabase `affiliates.total_referrals` aumentato; al prossimo login (o refresh profilo) il contatore AFFILIATES in profilo/STATS aggiornato.

Esempio con curl (sostituisci SECRET e CODICE):

```bash
curl -X POST https://auth.comtra.dev/api/test/simulate-referral \
  -H "Content-Type: application/json" \
  -H "X-Test-Secret: IL_TUO_TEST_AFFILIATE_SECRET" \
  -d '{"affiliate_code":"IL_CODICE_AFFILIATO"}'
```

Così puoi testare il flusso “codice → referral accreditato → contatore in profilo” senza acquisti.

### C) Replay del webhook Lemon (opzionale)

Se vuoi testare anche la firma e il formato del webhook:

1. Costruisci un JSON simile a quello che invia Lemon per `order_created`, con `meta.custom_data.aff = "CODICE"`.
2. Calcola l’HMAC-SHA256 del body con `LEMON_SQUEEZY_WEBHOOK_SECRET` e mettilo in header `X-Signature`.
3. Invia POST a `https://auth.comtra.dev/api/webhooks/lemonsqueezy` con quel body e header.
4. Verifica in DB che `affiliates.total_referrals` sia incrementato.

Uno script (Node o curl) può fare i punti 1–3; in repo si può aggiungere uno script `scripts/replay-affiliate-webhook.js` che legge codice e secret e fa la chiamata.

---

## Riepilogo checklist

| Area        | Cosa verificare |
|------------|------------------|
| Auth       | Login → riga in `users` in Supabase; `npm run check-auth` OK. |
| Crediti    | Consumo da plugin → `credits_used` e `credit_transactions` aggiornati. |
| XP/Livelli | Consumo → `total_xp`, `current_level`, `xp_transactions`; UI livello e barra; level up modal. |
| Trofei     | Azioni che soddisfano condizioni → `user_trophies`; GET `/api/trophies`; toast e Trophy Case. |
| Affiliazione | Registrazione affiliato → riga in `affiliates`; simulazione referral (endpoint test o replay webhook) → `total_referrals` e contatore in profilo. |

---

## Account di test in Supabase

Non serve nessuna configurazione speciale: **fai login con un account di test (es. ben.bugli@gmail.com)** e la sua riga viene creata/aggiornata in `users` come per qualsiasi altro account. Per vederla in Supabase basta controllare la tabella `users` dopo il login (cercando per email o per Figma user id). Il fatto che nel frontend siano in `TEST_USER_EMAILS` non cambia il comportamento del backend né l’inserimento in Supabase.

Implementando l’endpoint **POST /api/test/simulate-referral** (protetto da `X-Test-Secret`) si completa la strategia per testare l’affiliazione in modo puntuale senza acquisti.
