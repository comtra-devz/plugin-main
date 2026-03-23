# Stima costi e ricavi — consumo crediti e piani

Documento di **analisi finanziaria** in ottica **consumo crediti**: i crediti sono l’unità di valore (erogati dai piani, consumati dalle azioni). Qui si modellano costo Kimi, ricavo e netto **per credito consumato**; **quanti crediti consuma ogni azione** (Scan DS, Generate, Sync, A11Y, ecc.) è definito altrove (constants, product).  
**Oggi** la baseline costo/credito resta DS Audit, ma è stata aggiunta anche una stima operativa per **Generate con A/B test** (A diretto, B con pianificazione ASCII) per aggiornare margini e buffer.

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

### 1.2 Crediti consumati per azione (riferimento)

Ogni azione nel plugin **consuma** un certo numero di crediti (definito in **`constants.ts`** e in product: Scan DS, Generate, Code/Sync, future A11Y, ecc.). In questo documento non si decide *come* si consumano; si usa il **flusso di crediti** (erogati dal piano, consumati dall’uso) per costi e ricavi.

Esempio — **Scan DS** (da `SCAN_SIZE_TIERS`, `getScanCostAndSize(nodeCount)`): ad ogni scan vengono addebitati 2–11 crediti in base alla dimensione del file. Altre azioni hanno il loro mapping credito/azione (es. Generate 3; Deep Sync: Scan Project 15, Fix singolo 5, Sync All N×5).

| Azione | Dimensione / parametro | Crediti consumati |
|--------|------------------------|-------------------|
| **Scan DS** | ≤500 (Small) | 2 |
| Scan DS | ≤5k (Medium) | 5 |
| Scan DS | ≤50k (Large) | 8 |
| Scan DS | >50k (200k+) | 11 |
| **A11Y Audit** | ≤500 (Small) | 1 |
| A11Y Audit | ≤5k (Medium) | 2 |
| A11Y Audit | ≤50k (Large) | 4 |
| A11Y Audit | >50k (200k+) | 6 |
| **UX Logic Audit** | Attualmente flat (backend) | **4** |
| UX Logic Audit (ruleset) | Formula: BASE 3 + pages×1 × mult. nodi | 4–20+ (es. 5 pag, 300 nodi → 12) |
| **Generate** | Standard (action plan) | **3** |
| Generate | Screenshot conversion | +2 (sul tier) |

- **Scan DS:** `getScanCostAndSize(nodeCount)` in `constants.ts`; backend `audit` / `scan`. Dettaglio: questo documento (§ 3–5).
- **A11Y Audit:** `getA11yCostAndSize(nodeCount)`; backend `a11y_audit`. Dettaglio: **docs/COST-ESTIMATE-A11Y.md**.
- **Prototype Audit:** dettaglio **docs/COST-ESTIMATE-PROTOTYPE-AUDIT.md**.
- **UX Logic Audit:** agente Kimi (design statico, 60 regole UXL). Backend: `estimateCreditsByAction('ux_audit')` = 4 (flat). Ruleset: formula BASE 3 + pages×1 × mult. nodi. Dettaglio: **docs/COST-ESTIMATE-UX-AUDIT.md**.
- **Generate:** credito dopo canvas render; stima da `estimateCreditsByAction('generate')` in backend.
- **Code → Tokens (Generate CSS, Generate JSON):** sempre **gratuiti** per tutti (FREE e PRO), nessun credito.
- **Deep Sync** (tab Sync in Code): **solo PRO** (FREE non può usarla). Con PRO: `scan_sync` 15 crediti, `sync_fix` / `sync_storybook` 5 crediti (Sync All = N×5).

---

## 2. Modello Kimi e prezzi token

- **Modello:** `kimi-k2-0905-preview` (default backend).
- **Prezzi indicativi** (verificare su [platform.moonshot.ai](https://platform.moonshot.ai)):
  - Input: **$0.40 / 1M token**
  - Output: **$2.00 / 1M token**

---

## 2.1 Matrice token ↔ crediti e profittabilità

**Punto importante:** Sappiamo quanto il modello fa pagare **per singolo token**; ogni azione nel plugin fa cose diverse su **file diversi e di dimensioni diverse**, quindi i token per chiamata variano. Per **guadagnarci** serve che la **matrice e la conversione token ↔ crediti** siano tarate in modo che:

**(crediti addebitati all’utente) × (prezzo per credito che incassiamo) > (token effettivamente usati) × (costo per token Kimi)**

In altre parole:
- **Crediti per azione** (es. Scan DS: 2–11 in base a dimensione) devono essere sufficienti a coprire il costo Kimi (token × $/token) e lasciare margine.
- Se un’azione su file grandi consuma molti token ma addebitiamo pochi crediti, andiamo in perdita; se addebitiamo troppi crediti per file piccoli, l’utente paga “di più” del costo reale (accettabile per margine, ma da bilanciare con UX).

**Cosa fare in pratica:**
- Tenere aggiornata la **matrice** azione × dimensione (o band) → crediti addebitati (già in constants/product).
- Verificare che, per ogni band, **costo Kimi (token × prezzo)** < **crediti × prezzo_minimo_break_even** (vedi § 5).
- Per avere **dati reali** sui token usati (e non solo stime), serve una **telemetria uso token** lato backend → dashboard: vedi **docs/TOKEN-USAGE-TELEMETRY.md**. Con quei dati si può ricalcolare la matrice e la conversione in modo che si guadagni su ogni azione/dimensione.

---

## 3. Consumo token per richiesta (fonte attuale per costo per credito: DS Audit)

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

## 4. Costo Kimi per singola richiesta DS Audit (usato per derivare costo per credito)

| Dimensione | Costo input | Costo output | **Costo totale/scan** |
|------------|-------------|--------------|------------------------|
| Small | ~$0.006 | ~$0.0016 | **~$0.008** |
| Medium | ~$0.010 | ~$0.0016 | **~$0.012** |
| Large | ~$0.020 | ~$0.0016 | **~$0.022** |
| 200k+ | ~$0.036 | ~$0.0016 | **~$0.038** |

**Caso medio:** ~**$0.012–0.015** per scan.

### 4.1 Generate (v2, con A/B test 50/50)

Generate usa due pipeline:

- **Variante A (50%)**: prompt -> action plan JSON (1 chiamata Kimi)
- **Variante B (50%)**: prompt -> wireframe ASCII -> action plan JSON (2 chiamate Kimi)

Stima token/costo per richiesta:

| Variante | Token input stimati | Token output stimati | Costo stimato/richiesta |
|----------|----------------------|----------------------|--------------------------|
| **A** (1 call) | ~16K–28K | ~1K–3K | **~$0.008–0.017** |
| **B** (2 call) | ~32K–53K | ~2K–5K | **~$0.017–0.031** |
| **Mix reale A/B 50/50** | — | — | **~$0.013–0.024** (tipico ~**$0.018–0.020**) |

Con addebito attuale **3 crediti** per generate standard:

- costo/credito stimato (mix A/B): **~$0.0043–0.0080**
- zona tipica: **~$0.006/credito**

Nota screenshot: in product/UI è previsto un sovrapprezzo credito su screenshot conversion (`+2` sul tier), da mantenere allineato al costo reale perché tende ad alzare token input (descrizioni + contesto visuale).

Telemetria consigliata: oltre a `kimi_usage_log` `action_type='generate'`, tracciare sempre la **variante** (`A`/`B`) e i token per richiesta (già presenti nelle tabelle `generate_ab_requests`/`generate_ab_feedback`).

---

## 5. Stima costo per credito e per utente (in ottica consumo crediti)

In ottica **consumo crediti**: **costo Kimi per utente** = (crediti consumati dall’utente) × (costo medio per credito).  
Il **costo per credito** (lato Kimi) oggi va letto almeno su due blocchi:

- **DS Audit baseline**: ~`$0.003–0.004/credito`
- **Generate (mix A/B)**: ~`$0.0043–0.0080/credito` (tipico ~`$0.006/credito`)

Per forecasting mensile conviene usare un **mix pesato per azione** (quota crediti DS vs Generate vs altri audit).

**Costo per credito (lato Kimi, oggi da DS Audit):**  
- Small 2 crediti → $0.008 → **~$0.004/credito**  
- Large 8 crediti → $0.022 → **~$0.00275/credito**  
→ Break-even prezzo/credito (per non andare in perdita su costo Kimi): **≥ ~$0.003–0.004 per credito** (~0,3–0,4 cent USD).

**Costo per utente** = crediti consumati × costo per credito (es. €0,0026/credito medio). Esempi assumendo **solo consumo tipo DS Audit** (mix ~5 crediti per “azione equivalente”):

| Utente tipo | Crediti consumati (stima) | Costo Kimi (stima) |
|-------------|---------------------------|---------------------|
| Free, uso leggero | ~10/mese | ~$0.07 |
| Free, uso intenso | 25 (tutti i bonus) in ~2 mesi | ~$0.16 in 2 mesi |
| PRO 1m (100 crediti) | 100 nel periodo | ~$0.26 |
| PRO 6m (800 crediti) | 800 nel periodo | ~$2.08 |
| PRO 1y (2000 crediti) | 2000 nell’anno | ~$5.20 |

Quando il consumo è misto (Scan + Generate + altro), il costo per credito varia per tipo di azione; la logica resta: **crediti consumati × costo per credito** (medio pesato o per tipo).

---

## 6. Quanto tenere “in cassa” per non bloccare Kimi

Obiettivo: **nessun blocco del servizio** per mancanza di credito API Kimi. Si consiglia un **buffer** in USD sul conto/platform Kimi (o equivalente pre-pagato).

### 6.1 Formula suggerita (in ottica consumo crediti)

- **Cassa minima =** (consumo medio giornaliero USD) × (giorni di buffer).  
- **Consumo medio giornaliero** = **(crediti consumati/giorno)** × (costo medio per credito).  
  Equivalente: (utenti attivi × crediti/utente/giorno) × costo per credito.

Esempio (oggi con stima da DS Audit: ~5 crediti per “azione” media, costo ~$0,0026/credito):
- 50 utenti attivi, ~125 crediti consumati/giorno in totale (es. 2,5 crediti/utente/giorno) → 125 × $0,0026 ≈ **$0,33/giorno**.
- Buffer 30 giorni → **~$10 in cassa**; per sicurezza in beta si usano **$10–20** (30 gg) / **$20–40** (60 gg).

### 6.2 Raccomandazioni operative

| Scenario | Utenti attivi (stima) | Crediti/giorno (stima) | Buffer 30 gg | Buffer 60 gg |
|----------|------------------------|-------------------------|--------------|--------------|
| Lancio / beta | 20–50 | ~50–125 | **$10–20** | **$20–40** |
| Crescita | 100–200 | ~250–500 | **$20–40** | **$40–80** |
| Consolidato | 500+ | ~1 250+ | **$80+** | **$160+** |

*(Crediti/giorno convertiti in USD con costo per credito ~$0,0026; quando il consumo include altre azioni il costo per credito può variare.)*

### 6.3 Fondo cassa per numero di utenti

Il fondo cassa **cambia al variare del numero di utenti** e del **consumo di crediti** (non della singola azione: DS Audit, Generate, ecc.). Tabella indicativa: stesso numero di utenti degli scenari § 7.8; uso stimato ~0,2× crediti equivalenti/utente/giorno sulla base attiva (oggi allineato a un mix tipo DS Audit).

| Utenti totali (stima) | Utenti attivi/giorno (~20%) | Crediti/giorno (stima) | Fondo cassa 30 gg | Fondo cassa 60 gg |
|------------------------|-----------------------------|-------------------------|-------------------|-------------------|
| 100 | ~20 | ~50–125 | **$10–15** | **$20–30** |
| 500 | ~100 | ~250–500 | **$20–40** | **$40–80** |
| 2 500 | ~500 | ~1 250–2 500 | **$100–200** | **$200–400** |
| 12 500 | ~2 500 | ~6 250–12 500 | **$500–1 000** | **$1 000–2 000** |

**Nota:** Se il numero di utenti o i **crediti consumati per utente** aumentano, il fondo va **rialzato** in proporzione. Quando si aggiungono altre funzioni che consumano crediti (e Kimi), aggiornare costo per credito e/o crediti/giorno.

### 6.4 Closed beta senza cassa e senza incassi: quante persone possiamo sostenere?

**Domanda:** Abbiamo già il calcolo di quante persone possiamo sostenere in una **closed beta** nel caso **non ci sia ancora cassa** (nessun ricavo accumulato) e **nessuno abbia ancora pagato**?

**Scenario:** Beta chiusa, tutto il costo Kimi è a nostro carico (out of pocket). Nessun incasso PRO → il tetto è dato solo da quanto decidiamo di mettere in Kimi per la beta.

**Costo per utente FREE (in ottica consumo crediti):** 25 crediti in dotazione, uso medio stimato ~40% → **~10 crediti consumati** per utente in beta. Con costo per credito ~€0,005 (da DS Audit): 10 × 0,005 ≈ **€0,05** per utente (costo una tantum per i crediti bonus consumati). *Come l’utente consuma quei 10 crediti (solo Scan, mix Scan+Generate, ecc.) è indifferente per questo calcolo.*

Da qui: **numero massimo di utenti FREE sostenibili** ≈ **budget iniziale (€) / 0,05**.

| Budget iniziale (out of pocket per Kimi) | Max utenti FREE in closed beta (stima) |
|-----------------------------------------|----------------------------------------|
| €20 | ~400 |
| €50 | ~1 000 |
| €100 | ~2 000 |
| €200 | ~4 000 |

**Nota:** La stima assume **~10 crediti consumati** per utente (40% dei 25). Se in beta il consumo è più alto (es. 80% → ~20 crediti), il costo per utente raddoppia e con €50 si sostengono ~500 persone invece di ~1 000. Quando arrivano i primi pagamenti PRO, il ricavo può finanziare nuovo credito Kimi e alzare il tetto.

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

### 7.2 Costo Kimi per piano (in ottica consumo crediti)

**Costo totale Kimi per piano** = (crediti erogati e consumati dal piano) × (costo medio per credito).  
Oggi il **costo per credito** è stimato da DS Audit (medio ≈ **$0,0026** per credito); se il consumo è misto (Scan + Generate + altro) il costo per credito può variare per tipo di azione.

| Piano | Crediti (erogati/consumabili) | Costo Kimi (max, costo/credito da DS Audit) |
|-------|------------------------------|--------------------------------------------|
| 1w | 20 | ~$0,05 |
| 1m | 100 | ~$0,26 |
| 6m | 800 | ~$2,08 |
| 1y | 2 000 | ~$5,20 |

*Come l’utente consuma quei crediti (solo Scan, mix di azioni, ecc.) è definito dal product; qui conta il flusso crediti e il costo medio per credito.*

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
- **Costo FREE vs PRO:** anche con molti FREE per PRO (es. 10:1), il costo Kimi sui free (crediti consumati × costo/credito) è <1% del netto PRO; il vincolo non è il rapporto FREE/PRO.
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
- **Costo Kimi per utente FREE (consumo crediti):** 25 crediti in dotazione, uso medio ~40% → **~10 crediti consumati** per free user; 10 × €0,005 ≈ **€0,05** (costo una tantum sui crediti bonus). *Indipendente da come sono consumati (Scan, Generate, ecc.).*

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

| Voce | Valore |
|------|--------|
| **Unità di conto** | **Crediti consumati** (come si consumano per azione = product/constants) |
| Costo medio per credito Kimi (oggi da DS Audit) | ~$0,0026 (~$0,003–0,004/credito per break-even) |
| Equivalente “per scan” (solo DS Audit, ~5 cred/scan) | ~$0,012–0,015/scan |
| Break-even prezzo/credito | ~$0,003–0,004 |
| Cassa minima consigliata (beta, 30 gg) | **$10–20** |
| **Fondo cassa per numero utenti** | Vedi **§ 6.3** (100 → ~\$10–15, 12.5k → ~\$500–1k, 30 gg; cambia con utenti e uso) |
| **Closed beta senza cassa/incassi** | **§ 6.4** — quante persone sostenere: budget €50 → ~1 000 FREE, ecc. |
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

- **Telemetria token:** per avere **conteggi reali** (e non solo stime) e tarare la matrice token ↔ crediti, è prevista una **telemetria uso token** anonima: il backend legge `usage` dalla risposta Kimi, persiste in DB (o invia alla dashboard) senza PII; la dashboard mostra aggregati. Vedi **docs/TOKEN-USAGE-TELEMETRY.md**. Invisibile in UI nel plugin.

Il documento resta in ottica **consumo crediti**: i crediti sono l’unità di conto; come ogni azione li consuma è definito altrove. Quando saranno disponibili altre funzioni:

- **Crediti per azione:** aggiornare (in constants/product) quanti crediti consumano A11Y, Generate, Sync, ecc.; questo doc non decide il mapping.
- **Costo per credito:** aggiungere stime costo Kimi per le nuove azioni che usano Kimi (es. A11Y, Generate); eventuale “costo medio per credito” pesato per mix di consumo.
- **Cassa (§ 6):** esprimere sempre come (crediti consumati/giorno) × (costo per credito); aggiornare il costo per credito (e/o crediti/giorno) quando il mix di azioni cambia.
- **Margine per piano:** invariato nella logica (crediti erogati × prezzo/credito vs crediti consumati × costo/credito); aggiornare il costo per credito se il mix di consumo include azioni con costo Kimi diverso.

---

## Riferimenti

- **Matrice token ↔ crediti e telemetria:** § 2.1 (profittabilità), **docs/TOKEN-USAGE-TELEMETRY.md** (contatore anonimo token → dashboard).
- Crediti e variant: **auth-deploy/api/webhooks/lemonsqueezy.mjs** (`VARIANT_TO_PRO`), **constants.ts** (`TIER_LIMITS`, `SCAN_SIZE_TIERS`, `FREE_TIER_CREDITS`).
- Modello e env: **auth-deploy/SETUP.md** (KIMI_API_KEY, KIMI_MODEL).
- Prompt DS Audit: **auth-deploy/prompts/ds-audit-system.md**.
- Tariffe Kimi: [platform.moonshot.ai](https://platform.moonshot.ai).
