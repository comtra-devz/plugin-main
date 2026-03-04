# Stima costi e ricavi — Kimi (DS Audit e piani)

Documento di **analisi finanziaria**: sistema piani, consumo token, costo per utente, cassa minima per non bloccare Kimi, margine piano ↔ consumo.  
**Scope attuale:** DS Audit (unica funzione con stima token). Altre funzioni (A11Y, Generate, ecc.) si aggiungeranno qui quando disponibili.

---

## 1. Sistema piani attuale

### 1.1 Crediti erogati (fonte: webhook Lemon Squeezy)

I crediti effettivamente assegnati al pagamento sono definiti in **`auth-deploy/api/webhooks/lemonsqueezy.mjs`** (`VARIANT_TO_PRO`). I limiti mostrati in UI possono usare `constants.ts` (TIER_LIMITS): in caso di discrepanza, **per costi/ricavi fa fede il webhook**.

| Piano | Variant ID | Crediti inclusi | Durata |
|-------|------------|------------------|--------|
| FREE | — | 25 (una tantum) | — |
| 1w | 1345293 | 20 | 7 giorni |
| 1m | 1345303 | 100 | 30 giorni |
| 6m | 1345310 | 800 | 180 giorni |
| 1y | 1345319 | 2 000 | 365 giorni |

**Nota:** `constants.ts` ha `TIER_LIMITS['6m'] = 600` e `TIER_LIMITS['1y'] = 3000`; il webhook usa 800 e 2000. Allineare se si vuole coerenza UI/backend.

### 1.2 Crediti addebitati per azione (DS Audit)

Da **`constants.ts`** (`SCAN_SIZE_TIERS`, `getScanCostAndSize(nodeCount)`):

| Dimensione file (nodi) | Label | Crediti addebitati |
|------------------------|--------|---------------------|
| ≤ 500 | Small | 2 |
| ≤ 5 000 | Medium | 5 |
| ≤ 50 000 | Large | 8 |
| > 50 000 (cap 200k) | 200k+ | 11 |

---

## 2. Modello Kimi e prezzi token

- **Modello:** `kimi-k2-0905-preview` (default backend).
- **Prezzi indicativi** (verificare su [platform.moonshot.ai](https://platform.moonshot.ai)):
  - Input: **$0.40 / 1M token**
  - Output: **$2.00 / 1M token**

---

## 3. Consumo token per richiesta (solo DS Audit)

| Componente | Token stimati |
|------------|----------------|
| System prompt (ds-audit-system.md) | ~2 500 |
| User message (JSON file, depth=2) | 15 000 – 100 000+ (dipende da nodi) |
| Output (max 6 issue in JSON) | ~600 – 1 000 |

**Casi tipici per singola chiamata DS Audit:**

| Caso | Nodi (stimati) | Token input | Token output | Totale token (appross.) |
|------|-----------------|-------------|--------------|--------------------------|
| Small | ≤500 | ~15k | ~800 | ~16k |
| Medium | ≤5k | ~25k | ~800 | ~26k |
| Large | ≤50k | ~50k | ~800 | ~51k |
| 200k+ | fino 200k | ~90k | ~800 | ~91k |

**Media pesata** (per stime di cassa): assumendo mix 30% Small, 40% Medium, 25% Large, 5% 200k+ → circa **~35k token/scan** (input+output equivalente in costo).

---

## 4. Costo Kimi per singola audit (DS Audit)

| Dimensione | Costo input | Costo output | **Costo totale/scan** |
|------------|-------------|--------------|------------------------|
| Small | ~$0.006 | ~$0.0016 | **~$0.008** |
| Medium | ~$0.010 | ~$0.0016 | **~$0.012** |
| Large | ~$0.020 | ~$0.0016 | **~$0.022** |
| 200k+ | ~$0.036 | ~$0.0016 | **~$0.038** |

**Caso medio:** ~**$0.012–0.015** per scan.

---

## 5. Stima costo per singolo utente (solo DS Audit)

Costo utente = (numero di scan) × (costo medio per scan).

Esempi (costo medio **$0.013**/scan):

| Utente tipo | Scan/mese (stima) | Costo Kimi/mese |
|-------------|--------------------|------------------|
| Free, uso leggero | 5 | ~$0.07 |
| Free, uso intenso | 12 (tutti i 25 crediti in ~2 mesi) | ~$0.16 in 2 mesi |
| PRO 1m (100 crediti) | 20 (mix dimensioni) | ~$0.26 |
| PRO 6m (800 crediti) | 160/mese se consuma tutto in 6m | ~$2.08/mese |
| PRO 1y (2000 crediti) | 167/mese se consuma tutto in 1 anno | ~$2.17/mese |

**Costo per credito (lato Kimi, solo DS Audit):**  
- Small 2 crediti → $0.008 → **$0.004/credito**  
- Large 8 crediti → $0.022 → **~$0.00275/credito**  
Break-even prezzo/credito (per non andare in perdita su costo Kimi): **≥ ~$0.003–0.004 per credito** (~0,3–0,4 cent USD).

---

## 6. Quanto tenere “in cassa” per non bloccare Kimi

Obiettivo: **nessun blocco del servizio** per mancanza di credito API Kimi. Si consiglia un **buffer** in USD sul conto/platform Kimi (o equivalente pre-pagato).

### 6.1 Formula suggerita

- **Cassa minima =** (consumo medio giornaliero USD) × (giorni di buffer).  
- **Consumo medio giornaliero** = (numero utenti attivi stimati) × (scan/utente/giorno) × (costo medio per scan).

Esempio:
- 50 utenti attivi (free + PRO), 0,5 scan/utente/giorno in media → 25 scan/giorno.
- 25 × $0.013 ≈ **$0.33/giorno**.
- Buffer 30 giorni → **~$10 in cassa**.
- Buffer 60 giorni → **~$20 in cassa**.

### 6.2 Raccomandazioni operative

| Scenario | Utenti attivi (stima) | Scan/giorno (stima) | Buffer 30 gg | Buffer 60 gg |
|----------|------------------------|----------------------|--------------|--------------|
| Lancio / beta | 20–50 | 10–25 | **$10–20** | **$20–40** |
| Crescita | 100–200 | 50–100 | **$20–40** | **$40–80** |
| Consolidato | 500+ | 200+ | **$80+** | **$160+** |

### 6.3 Fondo cassa per numero di utenti

Il fondo cassa **cambia al variare del numero di utenti** (e dell’uso reale). Tabella indicativa allineata agli scenari § 7.8 (solo DS Audit; costo medio ~$0,013/scan; uso stimato ~0,2 scan/utente/giorno sulla base attiva):

| Utenti totali (stima) | Utenti attivi/giorno (~20%) | Scan/giorno (stima) | Fondo cassa 30 gg | Fondo cassa 60 gg |
|------------------------|-----------------------------|----------------------|-------------------|-------------------|
| 100 | ~20 | ~10–25 | **$10–15** | **$20–30** |
| 500 | ~100 | ~50–100 | **$20–40** | **$40–80** |
| 2 500 | ~500 | ~250–500 | **$100–200** | **$200–400** |
| 12 500 | ~2 500 | ~1 250–2 500 | **$500–1 000** | **$1 000–2 000** |

**Nota:** Se il numero di utenti (o gli scan per utente) aumenta, il fondo va **rialzato** in proporzione; se cala l’uso, si può ridurre. Aggiornare la stima quando si aggiungono altre funzioni che usano Kimi (A11Y, Generate, ecc.).

- Impostare **alert** (email/Slack) quando il saldo Kimi scende sotto la cassa minima (es. sotto $15 in fase beta).
- Prevedere **ricarica automatica** o rinnovo prepagato se la piattaforma Kimi lo consente, così da non bloccare mai le chiamate.

---

## 7. Piano ↔ Consumo: quanto paghiamo noi vs ricavo

### 7.1 Prezzi di vendita (da store Lemon Squeezy / UI)

I prezzi mostrati nel plugin sono in **`components/UpgradeModal.tsx`** e README, allineati alle varianti dello store Lemon Squeezy.

| Piano | Prezzo vendita | Crediti | Prezzo/credito (vendita) | Fonte |
|-------|----------------|---------|--------------------------|--------|
| 1w | **€7** | 20 | €0,35 | UpgradeModal, README |
| 1m | **€25** | 100 | €0,25 | UpgradeModal, README |
| 6m | **€99** | 800 | €0,124 | UpgradeModal, README |
| 1y | **€250** | 2 000 | €0,125 | UpgradeModal, README (crediti da webhook) |

### 7.2 Costo Kimi per piano (solo DS Audit)

Assumendo che l’utente usi **tutti** i crediti in scan DS Audit con **costo medio $0.013/scan** e **crediti medi 5/scan** (mix dimensioni):

- Costo Kimi per credito (medio) ≈ **$0.0026** (conservativo).
- Costo totale Kimi per piano = (crediti inclusi) × (costo per credito medio).

| Piano | Crediti | Costo Kimi (max, solo DS Audit) | Nota |
|-------|---------|----------------------------------|------|
| 1w | 20 | ~$0.05 | 20/5 = 4 scan × $0.013 |
| 1m | 100 | ~$0.26 | 100/5 = 20 scan |
| 6m | 800 | ~$2.08 | 800/5 = 160 scan |
| 1y | 2 000 | ~$5.20 | 2000/5 = 400 scan |

(Se l’utente usa crediti anche per Generate/altro, il costo Kimi per quel piano può aumentare; qui si considera solo DS Audit.)

### 7.3 Margine lordo per piano (prezzi store attuali)

Con i prezzi da UpgradeModal/README (€ → USD appross. 1,08):

| Piano | Ricavo (vendita) | Costo Kimi (solo DS) | Margine lordo | % costo Kimi su ricavo |
|-------|------------------|----------------------|---------------|--------------------------|
| 1w | ~$7,55 (€7) | ~$0,05 | ~$7,50 | ~0,7% |
| 1m | ~$27 (€25) | ~$0,26 | ~$26,74 | ~1% |
| 6m | ~$107 (€99) | ~$2,08 | ~$105 | ~2% |
| 1y | ~$270 (€250) | ~$5,20 | ~$265 | ~2% |

Il **costo Kimi per DS Audit** è una frazione minima del ricavo (<2% sui piani lunghi).

**Attenzione — 98% non è il guadagno netto.** Quello che “avanza” dopo Kimi (~98%) è il **margine lordo rispetto al solo costo API**. Da lì vanno ancora tolte le altre spese, quindi **il guadagno netto è inferiore**:
- **Lemon Squeezy**: commissione tipica ~5% + fee per transazione (es. €0,50 per ordine) → sul ricavo lordo può uscire ~6–8%.
- **Tax / IVA**: in funzione del regime e del paese.
- **Altri costi**: hosting (Vercel, DB), eventuali altri provider, supporto.

Esempio indicativo su un piano 1m (€25): ricavo €25 − Kimi ~€0,24 − LS ~€1,75 (7%) ≈ **~€23** prima di tax. Il “98%” significa solo: Kimi ci costa quasi nulla rispetto al prezzo di vendita; il margine **netto** (quello che resta in tasca) dipende da LS, tax e resto.

### 7.4 Guadagno netto per piano (Lemon Squeezy + 30% tasse Italia)

Assunzioni:
- **Lemon Squeezy:** 5% sul ricavo + €0,50 a transazione ([fees LS](https://docs.lemonsqueezy.com/help/getting-started/fees)). Eventuali +1,5% transazioni fuori US non inclusi.
- **Tasse locali Italia:** 30% sull’utile (ricavo − costi). Il 30% è una stima; il regime reale (IRES, IRAP, forfettario, ecc.) va verificato con un commercialista.
- Tutti i valori in **€**. Costo Kimi convertito da USD con tasso ~1,08.

| Piano | Ricavo | − Kimi | − LS (5%+€0,50) | = Lordo (utile prima tasse) | − 30% tasse | = **Netto (in tasca)** |
|-------|--------|--------|------------------|-----------------------------|-------------|------------------------|
| 1w | €7,00 | €0,05 | €0,85 | €6,10 | €1,83 | **€4,27** |
| 1m | €25,00 | €0,24 | €1,75 | €23,01 | €6,90 | **€16,11** |
| 6m | €99,00 | €1,93 | €5,45 | €91,62 | €27,49 | **€64,13** |
| 1y | €250,00 | €4,81 | €13,00 | €232,19 | €69,66 | **€162,53** |

**In percentuale sul ricavo (netto):** 1w ~61%, 1m ~64%, 6m ~65%, 1y ~65%. Il resto è Kimi + LS + tasse.

### 7.5 Riepilogo: break-even e margine

- **Break-even prezzo/credito (solo Kimi DS Audit):** ~**$0.003–0.004** per credito.
- **Margine lordo vs. Kimi:** ~98–99% (il costo API è trascurabile sul ricavo).
- **Margine netto (con LS + 30% tasse Italia):** ~**61–65%** del ricavo resta come utile netto (vedi tabella § 7.4).

### 7.6 Funnel (ipotesi)

Flusso tipico da “scoperta” a PRO, con percentuali indicative (da aggiornare con dati reali):

| Step | Descrizione | Tasso (ipotesi) | Esempio su 10 000 partenza |
|------|-------------|-----------------|----------------------------|
| 1. Visit / Install | Visita store Figma, installazione plugin | 100% | 10 000 |
| 2. Signup | Login con Figma OAuth, account creato | 25% | 2 500 |
| 3. FREE attivi | Usano almeno una volta (Scan, Generate, …) | 60% degli signup | 1 500 |
| 4. Upgrade PRO | Acquisto piano (1w / 1m / 6m / 1y) | 15% dei FREE attivi | 225 PRO |

In questo esempio: **10 000 install** → **2 500 signup** → **1 500 FREE attivi** → **225 PRO**. Conversione finale install → PRO = **2,25%**. Il rapporto FREE/PRO = (1500−225)/225 ≈ **5,7 FREE per PRO** (solo sugli attivi); se contiamo tutti i signup come “utenti”, 2500 totali con 225 PRO ≈ **11% PRO**.

I tassi sono da sostituire con metriche reali (analytics, Lemon Squeezy); il funnel serve a stimare quante install servono per avere un dato numero di PRO.

---

### 7.7 Break-even: quando i FREE “non sono troppi”

Due modi per definire un **punto di pareggio** sostenibile:

**1) Costo FREE coperto dal netto PRO (rapporto massimo FREE/PRO)**  
Costo medio per FREE ≈ **€0,05** (Kimi sui 25 crediti, uso stimato). Netto medio per PRO (mix 10% 1w, 25% 1m, 35% 6m, 30% 1y) ≈ **€75,66** per vendita.

- Per avere il **costo FREE ≤ 10% del netto PRO**: (N_FREE × 0,05) ≤ 0,10 × (N_PRO × 75,66) → N_FREE / N_PRO ≤ **151**. In pratica qualsiasi funnel realistico (es. 4–20 FREE per PRO) sta abbondantemente sotto: il costo FREE resta trascurabile.
- **Conclusione:** con i prezzi e il mix attuali, “troppi free” non è un problema di costo Kimi, ma eventualmente di **cassa** (molti free che consumano subito) o **supporto**.

**2) Break-even su costi fissi (FREE “sostenibili” perché i PRO coprono i fissi)**  
Se ci sono **costi fissi mensili** (hosting Vercel/DB, dominio, buffer Kimi, ecc.), il break-even è: **netto da PRO ≥ costi fissi + costo Kimi dei FREE**.

Esempio: **€500/mese** di fissi. Con 80% FREE e 20% PRO e mix piani come sopra, il netto per utente totale ≈ **€15,09** (vedi sotto).  
→ Utenti totali minimi per break-even: **500 / 15,09 ≈ 34 utenti** (di cui **~7 PRO**).

| Break-even (esempio €500/mese fissi) | Valore |
|--------------------------------------|--------|
| Netto per utente (80% FREE, 20% PRO, mix piani) | ~€15,09 |
| **Utenti totali minimi** | **~34** |
| **PRO minimi** | **~7** |
| FREE in quel scenario | ~27 |

Sotto questa soglia (es. pochi PRO e molti FREE) il netto non copre i fissi: i FREE “pesano” in senso di sostenibilità, non di costo marginale Kimi. Sopra, ogni nuovo utente (con quella mix) aggiunge margine.

**Riepilogo break-even**
- **Costo FREE vs PRO:** anche con molti FREE per PRO (es. 10:1), il costo Kimi sui free è <1% del netto PRO; il vincolo non è il rapporto FREE/PRO.
- **Vincolo reale:** **costi fissi**. Stima conservativa: **~7 PRO (o ~34 utenti totali con 20% PRO)** per coprire **€500/mese** di fissi. Con il funnel § 7.6 (15% FREE→PRO), per avere 7 PRO servono ~47 FREE attivi → ~78 signup → ~310 install; numeri da sostituire con i tassi reali.

---

### 7.8 Stima netto per scenari (crescita esponenziale, distribuzione per piano)

**Assunzioni sulla distribuzione utenti**
- **FREE vs PRO:** alla scala piccola più FREE; crescendo si assume un miglioramento di conversione (più PRO). Percentuali usate:
  - 100 utenti: 80% FREE, 20% PRO
  - 500 utenti: 75% FREE, 25% PRO
  - 2 500 utenti: 70% FREE, 30% PRO
  - 12 500 utenti: 65% FREE, 35% PRO
- **Mix tra piani PRO** (sul totale PRO): 10% 1w, 25% 1m, 35% 6m, 30% 1y (6m consigliato in UI).
- **Costo Kimi per utente FREE:** 25 crediti, uso medio stimato ~40% → ~5 scan × €0,012 ≈ **€0,05** per free user (costo una tantum sui crediti bonus).

**Netto per singola vendita** (da § 7.4): 1w **€4,27** | 1m **€16,11** | 6m **€64,13** | 1y **€162,53**.

Crescita **esponenziale** del totale utenti: 100 → 500 → 2 500 → 12 500 (×5 per step).

---

**Scenario A — 100 utenti**

| Tipologia | N. utenti | Ricavo | Netto (in tasca) |
|-----------|-----------|--------|-------------------|
| FREE | 80 | €0 | −€4,00 (costo Kimi stimato) |
| PRO 1w | 2 | €14 | €8,54 |
| PRO 1m | 5 | €125 | €80,55 |
| PRO 6m | 7 | €693 | €448,91 |
| PRO 1y | 6 | €1 500 | €975,18 |
| **Totale** | **100** | **€2 332** | **~€1 509** |

---

**Scenario B — 500 utenti**

| Tipologia | N. utenti | Ricavo | Netto (in tasca) |
|-----------|-----------|--------|-------------------|
| FREE | 375 | €0 | −€18,75 |
| PRO 1w | 12 | €84 | €51,24 |
| PRO 1m | 31 | €775 | €499,41 |
| PRO 6m | 44 | €4 356 | €2 821,72 |
| PRO 1y | 38 | €9 500 | €6 176,14 |
| **Totale** | **500** | **€14 815** | **~€9 530** |

---

**Scenario C — 2 500 utenti**

| Tipologia | N. utenti | Ricavo | Netto (in tasca) |
|-----------|-----------|--------|-------------------|
| FREE | 1 750 | €0 | −€87,50 |
| PRO 1w | 75 | €525 | €320,25 |
| PRO 1m | 187 | €4 675 | €3 012,57 |
| PRO 6m | 262 | €25 938 | €16 802,06 |
| PRO 1y | 226 | €56 500 | €36 731,78 |
| **Totale** | **2 500** | **€87 638** | **~€56 779** |

---

**Scenario D — 12 500 utenti**

| Tipologia | N. utenti | Ricavo | Netto (in tasca) |
|-----------|-----------|--------|-------------------|
| FREE | 8 125 | €0 | −€406,25 |
| PRO 1w | 437 | €3 059 | €1 865,99 |
| PRO 1m | 1 094 | €27 350 | €17 624,34 |
| PRO 6m | 1 531 | €151 569 | €98 189,03 |
| PRO 1y | 1 313 | €328 250 | €213 401,89 |
| **Totale** | **12 500** | **€510 228** | **~€329 675** |

---

**Riepilogo netto per scala (crescita ×5)**

| Utenti totali | Ricavo totale | Netto (dopo LS, tasse 30%, costo FREE) |
|---------------|---------------|----------------------------------------|
| 100 | €2 332 | **~€1 509** |
| 500 | €14 815 | **~€9 530** |
| 2 500 | €87 638 | **~€56 779** |
| 12 500 | €510 228 | **~€329 675** |

Il netto è circa **65% del ricavo** (il costo Kimi sui FREE è piccolo rispetto al ricavo dei PRO). Cambiando le % FREE/PRO o il mix piani, si ricalcola con gli stessi netti unitari (§ 7.4).

---

## 8. Riepilogo numeri chiave

| Voce | Valore (DS Audit only) |
|------|-------------------------|
| Costo medio per scan Kimi | ~$0.012–0.015 |
| Break-even prezzo/credito | ~$0.003–0.004 |
| Cassa minima consigliata (beta, 30 gg) | **$10–20** |
| **Fondo cassa per numero utenti** | Vedi **§ 6.3** (100 → ~\$10–15, 12.5k → ~\$500–1k, 30 gg; cambia con utenti e uso) |
| Margine lordo vs. Kimi (prezzi store) | ~98–99% (solo costo API) |
| **Netto per vendita (LS + 30% tasse Italia)** | **~61–65%** del ricavo → vedi § 7.4 |

---

## 9. Controllo costi (già in essere)

1. **Max 6 issue** nel prompt DS Audit (output contenuto).
2. **max_completion_tokens: 4096** nella chiamata API.
3. **depth=2** per il file Figma (riduce token input).
4. Modello economico: **kimi-k2-0905-preview**.
5. (Futuro) Per file molto grandi: troncare il JSON a un max token prima di inviare a Kimi.

---

## 10. Aggiornamenti futuri (altre funzioni)

Quando saranno disponibili:
- **A11Y Audit** (Kimi + API gratuite): stimare token/costo solo per la parte Kimi e aggiungere una sezione “Costo per richiesta A11Y”.
- **Generate / altre azioni**: stimare token (o costo fisso) per azione e inserire in una tabella “Costo per azione per tipo”.
- **Ricalcolo cassa minima**: includere tutte le chiamate Kimi (DS + A11Y + Generate + …) nel consumo medio giornaliero e aggiornare la formula del § 6.
- **Ricalcolo margine per piano**: sommare costo Kimi (e eventuali altri provider) per tutte le azioni consumate con i crediti del piano.

---

## Riferimenti

- Crediti e variant: **auth-deploy/api/webhooks/lemonsqueezy.mjs** (`VARIANT_TO_PRO`), **constants.ts** (`TIER_LIMITS`, `SCAN_SIZE_TIERS`, `FREE_TIER_CREDITS`).
- Modello e env: **auth-deploy/SETUP.md** (KIMI_API_KEY, KIMI_MODEL).
- Prompt DS Audit: **auth-deploy/prompts/ds-audit-system.md**.
- Tariffe Kimi: [platform.moonshot.ai](https://platform.moonshot.ai).
