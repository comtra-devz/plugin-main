# Proposta: sistema di alert intelligente (dashboard admin)

Proposta di **sistema di alert** basata sul documento [COST-ESTIMATE-DS-AUDIT.md](./COST-ESTIMATE-DS-AUDIT.md), in ottica **CFO** (controllo di cassa, margini, sostenibilità) e **UX** della dashboard (chiarezza, azione, non rumore).

---

## 1. Principi (CFO + UX)

- **Un solo posto dove guardare:** lo stato operativo e finanziario si capisce dalla Home (e da una eventuale pagina “Alert / Operatività” per il dettaglio).
- **Alert = qualcosa da fare o da sapere:** ogni avviso è **azione** (ricarica Kimi, verifica uso) o **informazione** (runway, tendenza).
- **Soglie configurabili:** le soglie (cassa minima, runway minimo, ecc.) sono **parametri** (env o futuro pannello), così la stessa logica vale in beta e in scala senza cambiare codice.
- **Severità chiara:** **info** (blu), **warning** (giallo/arancione), **critical** (rosso). Niente più di 1–2 critical in home; il resto in sezione “Altri avvisi” o pagina dedicata.
- **Niente allarmi inutili:** dove serve, usare **conferma** (es. “runway < 7 giorni per 2 giorni consecutivi”) o soglie conservative per evitare falsi positivi.

---

## 2. Categorie di alert (allineate al doc costi)

### 2.1 Cassa e liquidità (Kimi)

**Obiettivo (doc §6):** nessun blocco del servizio per mancanza di credito API Kimi.

| Alert | Condizione (esempio) | Severità | Messaggio tipo (UX) | Azione suggerita |
|-------|----------------------|----------|----------------------|------------------|
| **Cassa sotto soglia** | Saldo Kimi (inserito a mano o da API se esiste) &lt; cassa minima consigliata (es. §6.2–6.3) | Critical | “Cassa Kimi sotto la soglia consigliata ($X). Rischio blocco servizio.” | Ricarica conto Kimi. Link a platform.moonshot.ai. |
| **Runway basso** | “Runway” = cassa / consumo_medio_giornaliero; se runway &lt; 14 giorni | Warning | “Con il consumo attuale la cassa dura circa X giorni.” | Valutare ricarica. |
| **Runway critico** | Runway &lt; 7 giorni | Critical | “Cassa Kimi: circa X giorni al consumo attuale. Ricarica consigliata.” | Ricarica urgente. |
| **Consumo in crescita** | Consumo ultimi 7d &gt; 1,5× media dei 7d precedenti (o simile) | Warning | “Consumo scan in aumento negli ultimi 7 giorni rispetto alla settimana prima.” | Monitorare; verificare se picco legittimo o anomalia. |

**Note implementative:**
- **Saldo Kimi:** oggi non c’è API; si può avere un **campo “Saldo Kimi (USD) – inserimento manuale”** in dashboard (aggiornato dall’admin). Gli alert di cassa/runway si basano su quel valore. In futuro: integrazione con provider se disponibile.
- **Cassa minima “consigliata”:** calcolata come nel doc: consumo_medio_giornaliero (scan/giorno × $0.013) × giorni_buffer (es. 30). Il consumo medio può essere **ultimi 7d o 30d** (configurabile). Opzione: usare la tabella §6.3 per scala utenti (es. 100 utenti → $10–15, 500 → $20–40) e prendere il max tra “formula” e “tabella per utenti”.

### 2.2 Margini e unit economics

**Obiettivo (doc §7):** margine netto ~61–65%; costo Kimi trascurabile sul ricavo (&lt;2%); break-even su costi fissi.

| Alert | Condizione (esempio) | Severità | Messaggio tipo (UX) | Azione suggerita |
|-------|----------------------|----------|----------------------|------------------|
| **Costo/scan anomalo** | (Solo se in futuro loghiamo token.) Costo medio per scan (reale) &gt; $0.02 (soglia conservativa) | Warning | “Costo medio per scan sopra la soglia ($X vs $0.02 atteso). Verificare mix dimensioni o tariffe Kimi.” | Controllare uso (molti Large/200k?) o prezzi provider. |
| **Ricavi vs costo Kimi** | (Solo con dati ricavi reali, es. Lemon Squeezy.) Se costo Kimi ultimi 30d &gt; 5% del ricavo ultimi 30d | Warning | “Costo Kimi (30d) supera il 5% del ricavo (30d).” | Verificare mix piani e uso. |

Oggi **senza** ricavi reali in DB e senza log token, questi alert possono essere **placeholder** (testo “Quando ci saranno ricavi e/o costi reali per scan, qui compariranno avvisi su margini”) oppure **nascosti** fino all’integrazione.

### 2.3 Sostenibilità e break-even (doc §7.7)

**Obiettivo:** netto da PRO ≥ costi fissi + costo Kimi FREE; ~7 PRO (o ~34 utenti con 20% PRO) per €500/mese fissi.

| Alert | Condizione (esempio) | Severità | Messaggio tipo (UX) | Azione suggerita |
|-------|----------------------|----------|----------------------|------------------|
| **PRO sotto break-even** | Numero PRO &lt; 7 (soglia configurabile, es. “PRO_min_break_even”) | Info / Warning | “PRO attuali: X. Stima break-even costi fissi: ≥ 7 PRO (per €500/mese fissi).” | Informativo; utile in fase early. |
| **Conversione bassa** | % FREE→PRO (su base attivi) &lt; 5% (soglia configurabile) | Info | “Conversione FREE→PRO (stima): X%. Sotto la soglia di riferimento (5%).” | Monitorare funnel e offerta. |

Questi sono **informativi** più che operativi: danno contesto, non “qualcosa da fare subito”.

### 2.4 Operatività e trend

| Alert | Condizione (esempio) | Severità | Messaggio tipo (UX) | Azione suggerita |
|-------|----------------------|----------|----------------------|------------------|
| **Scadenze PRO** | Numero PRO in scadenza nei prossimi 7 giorni &gt; 0 (già in dashboard) | Info | “X abbonamenti PRO in scadenza nei prossimi 7 giorni.” | Possibile campagna rinnovi o reminder. |
| **Signup a zero** | Signup ultimi 7d = 0 (e utenti totali &gt; 0) | Warning | “Nessun nuovo signup negli ultimi 7 giorni.” | Verificare canali e visibilità. |

---

## 3. Dati necessari (oggi vs futuro)

| Dato | Oggi in dashboard / DB | Per gli alert |
|------|-------------------------|----------------|
| Scan per giorno / 7d / 30d | Sì (credit_transactions) | Già usabile per consumo, runway, trend. |
| Costo stimato (scan × $0.013) | Sì | Già usabile per cassa minima e runway (se c’è “saldo” manuale). |
| Utenti totali, FREE, PRO | Sì | Già usabile per break-even e conversione. |
| PRO in scadenza 7d | Sì | Già usabile per alert “scadenze”. |
| Signup 7d / 30d | Sì | Già usabile per “signup a zero”. |
| **Saldo Kimi (USD)** | No | **Input manuale** in dashboard (campo “Saldo Kimi attuale”) + eventuale “Ultimo aggiornamento”. |
| Ricavo reale (Lemon Squeezy) | No | Futuro: integrazione LS o tabella ordini → alert margini. |
| Costo reale per scan (token) | No | Futuro: log token → alert costo/scan anomalo. |

---

## 4. UX in dashboard (proposta)

### 4.1 Home

- **Blocco “Stato operativo”** in alto (sotto il titolo o sopra le card KPI):
  - Se **nessun alert** o solo info: una riga neutra, es. “Stato: operativo” con icona ✓ (verde).
  - Se **warning:** “1 avviso” (o “2 avvisi”) con icona ⚠ e breve testo (es. “Runway Kimi &lt; 14 giorni”); clic → espande o porta a sezione/dettaglio.
  - Se **critical:** “Attenzione: cassa Kimi sotto soglia” (o runway &lt; 7d) in evidenza (bordo/colore rosso), con azione chiara (“Ricarica Kimi” come link esterno).
- **Non** elencare tutti gli alert in home: al massimo 1–2 righe di riepilogo + “Vedi tutti gli avvisi” → pagina o drawer.

### 4.2 Pagina / sezione “Alert” o “Operatività”

- Elenco di **tutti** gli alert attivi (per categoria: Cassa, Margini, Sostenibilità, Operatività).
- Per ogni alert: **severità**, **messaggio**, **soglia usata** (opzionale, es. “Soglia: $15”), **azione suggerita**.
- Opzionale: **soglie configurabili** (in un secondo step: env vars tipo `ALERT_RUNWAY_DAYS=7`, `ALERT_CASSA_MIN_USD=15`, `ALERT_PRO_BREAKEVEN=7`; in UI solo lettura “Soglie attive” o futuro pannello settings).

### 4.3 Crediti e costi (pagina esistente)

- Nella card “Costi Kimi” / “Cassa minima”:
  - Mostrare **runway** se c’è un “saldo” (es. “Runway stimato: X giorni”).
  - Se sotto soglia: stesso messaggio di alert (warning/critical) **in contesto**, con link “Dettaglio alert” se serve.

### 4.4 Input “Saldo Kimi”

- In Home o in “Crediti e costi”: **campo “Saldo Kimi (USD)”** (numero) + pulsante “Aggiorna” (salvataggio in localStorage o, meglio, in backend se avete una tabella `admin_settings` / env).
- Se non è mai stato impostato: gli alert di cassa/runway mostrano “Inserisci il saldo Kimi per vedere runway e alert di cassa” (info, non bloccante).

---

## 5. Logica tecnica (riepilogo)

- **Cassa minima consigliata:**  
  `max( consumo_medio_giornaliero_30d × 30, valore_tabella_per_utenti(§6.3) )`  
  Consumo medio giornaliero = (scan ultimi 30d / 30) × $0.013.
- **Runway (giorni):**  
  `saldo_kimi_usd / consumo_medio_giornaliero` (se saldo impostato e consumo &gt; 0).
- **Alert cassa:**  
  `saldo_kimi_usd < cassa_minima_consigliata` → critical.
- **Alert runway:**  
  `runway < 14` → warning; `runway < 7` → critical.
- **Alert consumo in crescita:**  
  `scan_ultimi_7d > 1.5 × scan_7d_precedenti` (conferma opzionale: solo se anche media 7d &gt; soglia assoluta, es. 5 scan/giorno, per evitare rumore con numeri piccoli).
- **Alert PRO sotto break-even:**  
  `count_PRO < 7` (soglia configurabile) → info.
- **Alert conversione:**  
  `(PRO / (FREE_attivi + PRO)) * 100 < 5` → info (solo se FREE_attivi + PRO &gt; 10 per non rumore).
- **Alert scadenze:**  
  già disponibile (PRO in scadenza 7d) → info.
- **Alert signup a zero:**  
  signup_7d === 0 && utenti_totali &gt; 0 → warning.

Parametri da env (o default in codice):  
`ALERT_CASSA_MIN_MULTIPLIER_DAYS=30`, `ALERT_RUNWAY_WARNING_DAYS=14`, `ALERT_RUNWAY_CRITICAL_DAYS=7`, `ALERT_PRO_BREAKEVEN=7`, `ALERT_CONVERSION_MIN_PCT=5`, `ALERT_CONSUMPTION_SPIKE_RATIO=1.5`.

---

## 6. Ordine di implementazione suggerito

1. **Fase 1 (subito):**  
   - Input **Saldo Kimi (USD)** in dashboard (persistenza: localStorage o backend).  
   - Calcolo **cassa minima** (formula §6) e **runway** (se saldo presente).  
   - Alert **cassa sotto soglia** (critical) e **runway &lt; 14** (warning) / **&lt; 7** (critical).  
   - Blocco **Stato operativo** in Home con riepilogo (ok / 1 warning / 1 critical) + messaggio breve.

2. **Fase 2:**  
   - Alert **consumo in crescita** (7d vs 7d precedenti).  
   - Alert **PRO sotto break-even** e **conversione bassa** (info).  
   - **Scadenze PRO** e **signup a zero** in elenco alert.  
   - Pagina o sezione “Tutti gli avvisi” con elenco completo.

3. **Fase 3 (quando ci sono i dati):**  
   - Alert **costo/scan anomalo** (con log token).  
   - Alert **ricavi vs costo Kimi** (con integrazione ricavi).  
   - Soglie configurabili da env (e in UI “soglie attive”).

---

## 7. Riepilogo

| Cosa | Descrizione |
|------|-------------|
| **Principio** | Alert = azione o informazione; soglie da doc costi; severità chiara; poca confusione in Home. |
| **Categorie** | Cassa/runway Kimi (critical/warning), trend consumo (warning), break-even e conversione (info), scadenze e signup (info/warning). |
| **Dato mancante** | Saldo Kimi → input manuale in dashboard (obbligatorio per alert cassa/runway). |
| **UX** | Blocco “Stato operativo” in Home; dettaglio in pagina “Alert”; campo Saldo Kimi; runway in sezione Crediti e costi. |
| **Implementazione** | Fase 1: saldo + cassa + runway + alert critici in Home. Fase 2: altri alert + pagina avvisi. Fase 3: margini e soglie configurabili quando ci sono i dati. |

Se questa proposta va bene, il passo successivo è implementare la **Fase 1** nella dashboard (backend admin: eventuale endpoint per salvare/leggere saldo e calcolo soglie; frontend: input saldo, calcolo runway/cassa, blocco stato operativo e messaggi di alert).
