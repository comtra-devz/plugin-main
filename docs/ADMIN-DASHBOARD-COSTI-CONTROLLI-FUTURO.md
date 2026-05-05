# Admin dashboard — Costi & Controlli (idee future)

Documento di **parcheggio** per feature non ancora implementate nella dashboard admin, concentrate su costi, consumo crediti/AI models (Qwen + Kimi legacy) e controlli di utilizzo.

---

## 1. Overview “Salute economica” (fase 2)

Estensioni possibili rispetto alla v1 già presente in `Crediti e costi`:

- **Cassa AI stimata (reale)**:
  - Lettura automatica del saldo provider (Qwen/Kimi) via API ufficiale (se disponibile) **oppure** input manuale del saldo attuale.
  - Calcolo **“giorni di autonomia”** = saldo / (costo medio giornaliero degli ultimi 30 giorni).
  - Semaforo verde/giallo/rosso in base a:
    - >30 giorni ⇒ ok.
    - 15–30 giorni ⇒ attenzione.
    - <15 giorni ⇒ critico.
- **Costo medio per credito target**:
  - Aggiungere un campo configurabile `COSTO_PER_CREDITO_TARGET` (es. da doc `COST-ESTIMATE-DS-AUDIT.md`) per confronto diretto tra costo reale/credito e target.
  - Alert se il costo reale per credito (dai dati AI) > target.

---

## 2. FREE guardrails

Vista dedicata (tab o sezione in `Crediti e costi` / `Storico utilizzo`) focalizzata sul free tier.

- **Istogramma consumo FREE**:
  - Periodo selezionabile (7/30 giorni).
  - Fasce di consumo crediti per utenti FREE (solo `plan = 'FREE'`):
    - 0–10 crediti.
    - 10–25.
    - 25+.
  - Visualizzazione: blocco `brutal-card` con istogramma testuale o barra stilizzata per fascia (`N utenti` per fascia).

- **Tabella “FREE ad alto utilizzo”**:
  - Colonne: `user_masked`, `crediti_ultimi_7g`, `azioni_costose_7g` (es. DS Audit large / 200k, generate, ecc.), `stato` (OK / Near limit / Blocked).
  - Ordinata per crediti ultimi 7 giorni, solo FREE.
  - Possibile filtro per paese.

- **Limiti configurabili (fase successiva)**:
  - Parametri (anche solo letti da env/DB all’inizio):
    - `MAX_FREE_CREDITS_PER_DAY`.
    - `MAX_FREE_HIGH_COST_ACTIONS_PER_DAY` (es. DS Audit large).
  - Testo esplicativo nella UI:
    - “Sopra questo limite blocchiamo le azioni costose fino a domani.”
  - In una fase ancora successiva: form di aggiornamento di questi limiti direttamente dalla dashboard.

- **Integrazione con notifiche**:
  - Se N FREE superano una certa soglia in un giorno/settimana:
    - notifica “N FREE ad alto utilizzo (ultimi 7 giorni)” → link alla sezione guardrails.

---

## 3. Azioni ad alto costo (per funzione/band)

Estensione della sezione “Token AI (chiamate e costo)” gia esistente.

- **Metrica di redditività per band**:
  - Per ogni riga di `by_action` e `by_size_band`, calcolare:
    - `ricavo_teorico` = crediti consumati × prezzo_per_credito (input configurabile, es. da doc costi).
    - `costo_ai` = cost_usd (gia calcolato).
    - `margine` = ricavo_teorico − costo_kimi.
  - Evidenziare in rosso le band **non redditizie** (margine < 0).

- **Vista riassuntiva “Azioni ad alto costo”**:
  - Tabella/heatmap che unisce:
    - tipo azione (`ds_audit_small/medium/large/200k+`, `ux_audit`, `generate`, ecc.),
    - richieste ultime 24h / 7gg,
    - crediti totali consumati,
    - costo AI stimato,
    - margine (o % di margine).
  - Uso: capire rapidamente dove si concentrano i costi e se c’è qualche band da ritarare (crediti o prompt).

- **Notifica dedicata**:
  - Se una band specifica (es. `ds_audit_large`) ha margine < 0 su un certo periodo:
    - notifica “Band DS Audit Large potenzialmente in perdita” → link a `Crediti e costi` sezione Azioni ad alto costo.

---

## 4. Utenti “heavy user” (FREE e PRO)

Vista per individuare utenti con consumo molto alto, per controlli e opportuni interventi.

- **Tab “Utenti intensivi”**:
  - Ordinamento per **crediti consumati negli ultimi 7 giorni** (o 30).
  - Colonne:
    - `user_masked`, `plan` (FREE/PRO), `crediti_7g`, `azioni_costose_7g`, `paese`, `eventuali flag` (es. “multi-account sospetto”, “molti throttle”).
  - Possibilità di filtrare per:
    - solo FREE / solo PRO / tutti.
    - paese.

- **FREE**:
  - Evidenziare se toccano o superano i limiti (quando implementati).
  - Eventuale colonna “bloccato fino al…” se in futuro c’è un blocco temporaneo su azioni costose.

- **PRO**:
  - Nessun blocco automatico, ma highlight se:
    - superano soglie molto alte (es. top 1% consumo),
    - hanno pattern di uso anomalo (molti file 200k, ecc.).
  - Potenziale uso futuro: insight per contatto diretto / upsell / feedback.

---

## 5. Notifiche / Alert (estensioni)

Il sistema notifiche è già in produzione (campanella + `/notifications`). Possibili estensioni:

- **Nuovi tipi di alert**:
  - “Buffer AI < X giorni” (quando la cassa reale sara collegata).
  - “N FREE bloccati oggi per limite consumo” (integrazione con guardrails).
  - “Band DS Audit Large in perdita nel periodo” (integrazione con redditività per band).

- **Collegamento diretto alle nuove sezioni**:
  - Ogni nuovo tipo di alert deve avere `target_path` che punta alle nuove viste:
    - `/credits` con ancoraggio alla sezione “Azioni ad alto costo” per le band non redditizie.
    - `/executions` + filtri preimpostati per vedere subito gli heavy user (es. query string o stato di navigazione).
    - eventuale route futura `/credits/free-guardrails` per la vista dedicata al free tier.

---

## 6. Implementazione consigliata (roadmap minima)

Quando si vorrà implementare queste idee:

1. **Step 1 — FREE guardrails (read-only)**
   - Endpoint backend che aggrega:
     - crediti consumati da FREE per utente in 7/30 giorni,
     - conteggio di azioni costose.
   - Vista in dashboard con istogramma fasce + tabella top FREE.

2. **Step 2 — Azioni ad alto costo con margine**
   - Aggiungere prezzo_per_credito configurabile.
   - Calcolare margine per `by_action` e `by_size_band`; evidenziare band critiche.

3. **Step 3 — Utenti intensivi + notifiche avanzate**
   - Tab “Utenti intensivi” che riusa le aggregazioni di Step 1.
   - Nuovi tipi di notifiche che puntano alle viste create sopra.

Questa roadmap permette di andare per gradi senza rivoluzionare la dashboard esistente, mantenendo chiaro cosa è già in produzione (v1) e cosa è pianificato per dopo.

