# Sconti da livelli e piano finanziario

Applicazione delle logiche di sconto gamification (Level Up) al piano di abbonamento, con simulazioni realistiche e calcolo del guadagno futuro. **Scenario assunto:** i codici sconto (5%, 10%, 15%, 20%) verranno creati nel tempo (medio/lungo termine); qui si definiscono le regole e i numeri.

Riferimenti: [GAMIFICATION.md](./GAMIFICATION.md) (curva livelli, XP), [COST-ESTIMATE-DS-AUDIT.md](./COST-ESTIMATE-DS-AUDIT.md) (prezzi, netto per piano).

---

## 1. Regola sconto per livello

- **Sconto:** 5% ogni 5 livelli, massimo 20%.
- **Applicazione:** solo sul **piano Annual Pro** (1y), come in Level Up Modal.
- **Livelli e percentuale:**

| Livello | Sconto | Note |
|---------|--------|------|
| 1–4     | 0%     | Nessuno sconto livello |
| 5       | 5%     | Primo codice sbloccabile |
| 10      | 10%    | |
| 15      | 15%    | |
| 20+     | 20%    | Cap |

Prezzi piani (da `UpgradeModal` / README):

| Tier | Prezzo | Crediti |
|------|--------|---------|
| 1w   | €7     | 20 |
| 1m   | €25    | 100/mese |
| 6m   | €99    | 800 |
| **1y**| **€250** | Unlimited (2 000) |

Quindi gli sconti livello si applicano a **€250** (Annual).

---

## 2. Prezzo scontato Annual (1y) per livello

| Livello | Sconto | Prezzo pagato | Risparmio utente |
|---------|--------|----------------|-------------------|
| 1–4     | 0%     | €250           | €0 |
| 5       | 5%     | €237,50        | €12,50 |
| 10      | 10%    | €225           | €25 |
| 15      | 15%    | €212,50        | €37,50 |
| 20+     | 20%    | €200           | €50 |

---

## 3. “Uso il 5% a L5 o aspetto il 10%?” — Comportamento al rinnovo

**Domanda:** Sblocco il 5% al livello 5, lo uso e acquisto Annual. Poi raggiungo il livello 10 e sblocco il 10%. Posso applicare il 10% subito o devo aspettare il prossimo rinnovo?

**Risposta:** Il **nuovo sconto (es. 10%) si applica al prossimo rinnovo** (alla prossima scadenza dell’Annual), non in mezzo al periodo già pagato.

- **Perché:** Lo sconto è applicato **in fase di checkout** (pagamento). Il contratto in corso (es. Annual pagato con 5%) resta valido fino a scadenza; non si “cambia coupon” su una subscription già attiva.
- **Casi documentati:**
  - **Lemon Squeezy** ([Discount object](https://docs.lemonsqueezy.com/api/discounts/the-discount-object)): il discount ha `duration` (`once` / `repeating` / `forever`) e si applica al momento del checkout. Non è previsto “sostituire” un coupon su una subscription già creata; il cliente usa un eventuale nuovo codice al **prossimo** checkout (rinnovo).
  - **Stripe / WooCommerce subscriptions:** in genere il coupon è legato alla subscription creata; per applicare un codice diverso (es. 10% invece di 5%) si fa al rinnovo successivo o tramite “subscription update” che effettua un nuovo charge (quindi di fatto “al prossimo ciclo”).
- **In pratica Comtra:**  
  - **Ora (L5):** usi il 5%, paghi €237,50, hai Annual fino a “oggi + 1 anno”.  
  - **Dopo 1 anno (rinnovo):** se sei a L10 (o superiore), al rinnovo usi il codice 10% e paghi €225. Nessun rimborso per il periodo già consumato con 5%.

**Riepilogo:** Sì, per usare uno sconto migliore (10%, 15%, 20%) devi aspettare il **prossimo rinnovo**; non si “retroapplica” al periodo già pagato.

---

## 4. Simulazioni casi realistici

### 4.1 Scenario A — Acquisto subito con 5% (L5), rinnovo con 10% (L10)

- **T0 (L5):** Acquisto Annual con 5% → **€237,50**.
- **T1 (anno dopo, L10):** Rinnovo Annual con 10% → **€225**.
- **Totale 2 anni:** €237,50 + €225 = **€462,50** (vs €500 senza sconti).  
- **Risparmio utente su 2 anni:** **€37,50**.

### 4.2 Scenario B — Aspetto L10, poi acquisto con 10%

- **T0 (L5):** Non acquisto (resto FREE o compro 6m senza sconto livello).
- **T1 (L10):** Acquisto Annual con 10% → **€225**.
- **Confronto con A:** nel primo anno non hai avuto lo sconto 5%; dal secondo anno paghi come in A al rinnovo. Conveniente aspettare il 10% solo se non ti serve Pro subito.

### 4.3 Scenario C — Progressione lunga (L5 → L10 → L15 → L20)

Assumo rinnovi annuali e che a ogni rinnovo il livello sia già raggiunto:

| Rinnovo | Livello | Sconto | Pagato |
|---------|---------|--------|--------|
| 1       | 5       | 5%     | €237,50 |
| 2       | 10      | 10%    | €225,00 |
| 3       | 15      | 15%    | €212,50 |
| 4       | 20      | 20%    | €200,00 |

**Totale 4 anni:** €237,50 + €225 + €212,50 + €200 = **€875**.  
**Senza sconti:** 4 × €250 = **€1 000**.  
**Risparmio utente su 4 anni:** **€125**.

### 4.4 Guadagno futuro utente (valore attuale sconti)

- **Solo primo acquisto (L5, 5%):** risparmio **€12,50**.
- **Due rinnovi (L5 poi L10):** risparmio **€37,50** (vedi 4.1).
- **Quattro rinnovi (5% → 10% → 15% → 20%):** risparmio **€125** (vedi 4.3).

Il “guadagno futuro” è quindi il risparmio cumulativo sui rinnovi successivi, assumendo che l’utente resti Pro e rinnovi con il codice del livello raggiunto.

---

## 5. Impatto sul ricavo (lato business)

- **Netto per vendita 1y senza sconto** (da COST-ESTIMATE): ~**€162,53** (dopo costi AI, LS, tasse).
- Con sconto livello il **ricavo lordo** scende; il **netto** scende in proporzione (costi AI/LS circa invariati per utente, la riduzione e sul prezzo pagato).

Stima netto con sconto (stessa struttura di costi):

| Sconto | Prezzo pagato | Netto stimato (≈65% del ricavo) |
|--------|----------------|----------------------------------|
| 0%     | €250           | ~€162,53 |
| 5%     | €237,50        | ~€154,38 |
| 10%    | €225           | ~€146,25 |
| 15%    | €212,50        | ~€138,13 |
| 20%    | €200           | ~€130,00 |

**Trade-off:** Minor ricavo per vendita in cambio di maggiore conversione e fidelizzazione (gamification). Le simulazioni sopra mostrano che l’utente “risparmia” fino a €125 su 4 anni; per il business è una riduzione controllata (max 20% sul piano Annual) e applicata solo a chi raggiunge i livelli.

---

## 6. Implementazione codici sconto (Lemon Squeezy)

Quando si creano i codici (medio/lungo termine):

- **Creare 4 discount** nello store: 5%, 10%, 15%, 20%.
- **Prodotto/variante:** limitare ai variant **1y** (Annual) se possibile (`is_limited_to_products`), così lo sconto livello non si applica a 1w/1m/6m.
- **Duration:** per subscription Annual, decidere se:
  - `once`: sconto solo sul primo pagamento (poi al rinnovo prezzo pieno o nuovo codice), oppure
  - `forever`: sconto su tutti i rinnovi (più generoso per l’utente).
- **Comunicazione in UI:** in Level Up Modal e in Subscription/Upgrade chiarire che lo sconto si applica al **piano Annual** e che un eventuale sconto migliore si userà **al prossimo rinnovo**.

---

## 6.1 Identificare se l’utente ha già riscattato un codice sconto (Lemon Squeezy)

Per comunicare in UI che l’utente ha già usato uno sconto livello (es. “Hai già usato il 5% su questo periodo; al prossimo rinnovo potrai applicare il 10%”) è possibile recuperare il dettaglio dai dati Lemon Squeezy.

### Cosa espone Lemon Squeezy

- **Order (dettaglio ordine)**  
  - [The Order Object](https://docs.lemonsqueezy.com/api/orders/the-order-object): l’ordine ha tra gli attributi:
    - `discount_total` (cents) — totale sconto applicato nell’ordine;
    - `user_email` — email acquirente.
  - Se `discount_total > 0` un coupon è stato applicato; non si sa però *quale* codice (5%, 10%, ecc.) solo dall’ordine.

- **Discount Redemptions (quale codice è stato usato)**  
  - [The Discount Redemption Object](https://docs.lemonsqueezy.com/api/discount-redemptions/the-discount-redemption-object): ogni riscatto è legato a un **Order** e a un **Discount** e contiene:
    - `discount_code` — codice inserito a checkout (es. `LEVEL5`, `LEVEL10`);
    - `discount_name` — nome del discount (es. `"10%"`);
    - `discount_amount` + `discount_amount_type` (`percent` | `fixed`) — entità dello sconto;
    - `amount` — importo effettivo dello sconto applicato (cents).
  - Le redemption **non** sono incluse inline nel payload del webhook; l’ordine ha una relationship:
    - `relationships["discount-redemptions"].links.related` → `GET https://api.lemonsqueezy.com/v1/orders/{order_id}/discount-redemptions` (con API key) per ottenere la lista.

### Come recuperare il dettaglio

1. **Dal webhook `order_created`**  
   - Nel payload hai `data.attributes.discount_total` e `data.id` (order id).  
   - Se `discount_total > 0`: chiamare l’API Lemon Squeezy  
     `GET /v1/orders/{order_id}/discount-redemptions`  
     e leggere dalla prima (o dalla lista) redemption `discount_name` / `discount_amount` + `discount_amount_type` per capire se è uno sconto livello (5%, 10%, 15%, 20%) e quale.

2. **A posteriori (senza webhook)**  
   - Listare gli ordini del cliente (es. `GET /v1/orders?filter[user_email]=...` se supportato, oppure tramite `customer_id`).  
   - Per ogni ordine pagato con `discount_total > 0`:  
     `GET /v1/orders/{order_id}/discount-redemptions`  
     e usare `discount_code` / `discount_name` / `discount_amount` per identificare lo sconto livello.

### Salvarlo per l’UI

- **In fase di webhook (consigliato):** quando si aggiorna l’utente (plan PRO, crediti, scadenza), se `attrs.discount_total > 0`:
  - chiamare `GET /v1/orders/{order_id}/discount-redemptions` (con API key LS);
  - se una redemption corrisponde a uno sconto livello (es. codice che inizia con `LEVEL` o nome `"5%"` … `"20%"`), salvare su `users` (o tabella collegata) ad es.:
    - `level_discount_used_percent` (5 | 10 | 15 | 20), oppure
    - `level_discount_used_at` + `level_discount_code` / `level_discount_order_id`.
  - così in plugin/Subscription puoi mostrare: “Hai già riscattato il 5%; al prossimo rinnovo potrai usare il 10%”.
- **On demand:** se non vuoi salvare in DB, puoi esporre un endpoint che per l’utente loggato (email) recupera l’ultimo ordine pagato da LS, poi le redemption di quell’ordine, e restituisce se è stato usato uno sconto livello e quale (percentuale/codice). Più lento e dipendente da API LS a ogni richiesta.

### Riepilogo

| Domanda | Risposta |
|--------|----------|
| Si può sapere se l’utente ha riscattato un codice sconto? | Sì, dai dettagli ordine Lemon Squeezy. |
| Dove? | `Order.discount_total` indica che c’è stato uno sconto; `GET /orders/{id}/discount-redemptions` dà codice/nome/percentuale. |
| Per la UI “hai già usato il 5%, al rinnovo il 10%” | Salvare in DB in webhook (es. `level_discount_used_percent`) dopo aver chiamato l’API redemption, oppure recuperare on demand da LS per l’email utente. |

---

## 6.2 Codice sconto univoco per utente (generazione e disattivazione via API)

Obiettivo: generare un codice sconto **univoco** associato all’utente (email/user_id), non riutilizzabile da altri, e **disabilitare** il codice del livello precedente quando l’utente sblocca uno sconto maggiore. Tutte le operazioni tramite **API Lemon Squeezy**.

### Vincolo “solo questo utente”

Lemon Squeezy **non** espone un attributo “limit to email” o “limit to customer” sui discount. Si ottiene l’effetto così:

1. **Codice univoco per utente + livello**  
   Generare un code che identifichi univocamente l’utente (e il livello), ad es.:
   - `COMTRA-L5-{hash}` dove `hash` = stringa corta (8–12 caratteri, solo lettere maiuscole e numeri) derivata da `userId` + `level` + secret (es. HMAC o hash crittografico troncato).  
   - Il codice è **univoco**: solo il backend lo conosce e lo espone solo all’utente loggato (es. in Level Up Modal o in Subscription).

2. **Uso singolo**  
   Creare il discount in Lemon Squeezy con:
   - `is_limited_redemptions: true`
   - `max_redemptions: 1`  
   Così il codice può essere riscattato **una sola volta** in tutto lo store. Di fatto solo quell’utente lo riceve e può usarlo; se qualcuno lo copiasse, il primo che lo usa “consuma” l’unica redemption.

In questo modo il codice è **di fatto** associato all’utente (univoco + mostrato solo a lui) e non riutilizzabile da altri dopo il primo uso.

### Operazioni via API Lemon Squeezy

- **Creare un discount (codice univoco)**  
  [Create a Discount](https://docs.lemonsqueezy.com/api/discounts/create-discount):  
  `POST /v1/discounts`  
  - `name`: es. `"Level 5 - 5%"`  
  - `code`: il codice univoco generato (es. `COMTRA-L5-A1B2C3D4`)  
  - `amount`: 5 | 10 | 15 | 20  
  - `amount_type`: `"percent"`  
  - `is_limited_to_products`: `true`  
  - `relationships.variants`: solo il variant **1y** (Annual), es. id `1345319`  
  - `is_limited_redemptions`: `true`  
  - `max_redemptions`: `1`  
  - `duration`: `once` (o `forever`/`repeating` se si vuole lo sconto anche sui rinnovi)  
  - `relationships.store`: `store_id` dello store (da env `LEMON_SQUEEZY_STORE_ID` o da API stores)

  Salvare in DB (es. tabella `user_level_discounts`): `user_id`, `level`, `lemon_discount_id`, `code`, `created_at`, così si può mostrare il codice in UI e disabilitarlo in seguito.

- **Disabilitare il codice del livello precedente**  
  L’API Lemon Squeezy **non** espone un PATCH per i discount (né “disable” né cambio status). Per “disabilitare” un codice si usa:  
  [Delete a Discount](https://docs.lemonsqueezy.com/api/discounts/delete-discount):  
  `DELETE /v1/discounts/:id`  
  con l’`id` del discount creato in precedenza per quell’utente e quel livello.

  **Flusso consigliato** quando l’utente passa al livello superiore (es. da L5 a L10):
  1. Leggere da DB il `lemon_discount_id` del codice attualmente attivo per quell’utente (es. livello 5).
  2. Se esiste: chiamare `DELETE /v1/discounts/{lemon_discount_id}` (così il vecchio codice 5% non è più valido).
  3. Creare il nuovo discount per il livello 10 (codice univoco nuovo, 10%, max_redemptions=1, limitato a variant 1y).
  4. Salvare in DB il nuovo `lemon_discount_id` e il nuovo `code` (sostituendo o aggiungendo riga per livello 10).

### Riepilogo implementativo

| Cosa | Come |
|------|------|
| Codice univoco per utente | Generare lato backend (es. `COMTRA-L{level}-{hash(userId,level,secret)}`), solo lettere/numeri maiuscoli, 3–256 caratteri. |
| Non usabile da altri | `max_redemptions: 1`; il codice viene mostrato solo all’utente loggato. |
| Limitato al piano Annual | `is_limited_to_products: true` + `relationships.variants` = variant id 1y. |
| Disabilitare il precedente | Nessun “disable” in API: usare `DELETE /v1/discounts/:id` sul discount del livello precedente quando si sblocca quello superiore. |
| Persistenza | Tabella tipo `user_level_discounts` (user_id, level, lemon_discount_id, code) per sapere quale codice mostrare e quale eliminare al passaggio di livello. |

Variabili d’ambiente utili: `LEMON_SQUEEZY_API_KEY` (per create/delete), `LEMON_SQUEEZY_STORE_ID` (per create). Variant id 1y già in uso: es. `1345319` (o da env).

---

## 7. Riepilogo

| Tema | Conclusione |
|------|-------------|
| Sconto per livello | 5% ogni 5 livelli, max 20%, solo Annual (€250). |
| Uso 5% ora vs aspettare 10% | Se usi il 5% e acquisti, il 10% si applica **al prossimo rinnovo**. Casi documentati: Lemon Squeezy (discount at checkout), Stripe/Woo (nuovo coupon al rinnovo). |
| Guadagno futuro utente | Fino a €125 risparmio su 4 anni (5%→10%→15%→20%). |
| Impatto business | Netto per vendita ridotto in modo limitato (max −20% sul prezzo Annual); beneficio su conversione e retention. |
| Codici | Da creare in LS a medio termine; limitare allo variant 1y; definire duration (once vs forever) per i rinnovi. |
| Sconto già riscattato | Recuperabile da Lemon Squeezy: Order.discount_total + API GET /orders/{id}/discount-redemptions per codice/%; salvare in webhook (es. level_discount_used_percent) per mostrare in UI “hai già usato il X%, al rinnovo il Y%”. |
| Codice univoco per utente | Generare code per user+livello (es. COMTRA-L5-{hash}); creare discount via POST /v1/discounts con max_redemptions=1 e limitato a variant 1y; al passaggio a livello superiore DELETE /v1/discounts/:id del codice precedente (no PATCH in LS). |
