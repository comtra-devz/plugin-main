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

- **Netto per vendita 1y senza sconto** (da COST-ESTIMATE): ~**€162,53** (dopo Kimi, LS, tasse).
- Con sconto livello il **ricavo lordo** scende; il **netto** scende in proporzione (costi Kimi/LS circa invariati per utente, la riduzione è sul prezzo pagato).

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

## 7. Riepilogo

| Tema | Conclusione |
|------|-------------|
| Sconto per livello | 5% ogni 5 livelli, max 20%, solo Annual (€250). |
| Uso 5% ora vs aspettare 10% | Se usi il 5% e acquisti, il 10% si applica **al prossimo rinnovo**. Casi documentati: Lemon Squeezy (discount at checkout), Stripe/Woo (nuovo coupon al rinnovo). |
| Guadagno futuro utente | Fino a €125 risparmio su 4 anni (5%→10%→15%→20%). |
| Impatto business | Netto per vendita ridotto in modo limitato (max −20% sul prezzo Annual); beneficio su conversione e retention. |
| Codici | Da creare in LS a medio termine; limitare allo variant 1y; definire duration (once vs forever) per i rinnovi. |
