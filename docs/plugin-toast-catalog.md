# Catalogo messaggi toast / snackbar / feedback breve (plugin Comtra)
### Versione 2 — revisionata da Ben & Cordiska

Documento di riferimento per copy, comportamento e logica di risoluzione di tutti i feedback brevi del plugin.

**Ultima revisione:** maggio 2026  
**Basato su:** `lib/errorCopy.ts`, `ToastContext`, `AuditView`, `App.tsx` e sessione di revisione UX

---

## Principi di tono

- Professionale e diretto. L'utente è un designer senior, non un utente consumer.
- Niente "Oops!", niente punti esclamativi, niente emoji.
- Ogni messaggio risponde in ordine a: (1) cosa è successo, (2) perché, (3) cosa fare adesso.
- Il titolo risponde alla (1). La descrizione risponde alla (2) e (3).
- La via d'uscita deve essere sempre esplicita, anche in assenza di CTA tecnica.

---

## Classificazione per tipo di risoluzione

Ogni errore appartiene a una delle tre categorie che determinano quale via d'uscita mostrare:

| Categoria | Definizione | Via d'uscita |
|-----------|-------------|--------------|
| **A — Self-service** | L'utente risolve da solo con un'azione in Figma o nel plugin | Nessuna CTA di supporto. Istruzioni chiare nel testo. |
| **B — Retry guidato** | Il problema è transitorio, l'utente riprova con CTA diretta. Se il problema si ripete nella stessa sessione, compare CTA "Contact support" | CTA primaria di retry. "Contact support" al secondo fallimento. |
| **C — Escalation diretta** | L'utente non può fare nulla da solo | CTA "Contact support" presente subito nel toast. |

La dialog "Contact support" è la stessa usata nel flusso discard degli audit. Si apre pre-popolata con: error key, timestamp, HTTP status (se disponibile), engine context, versione plugin.

---

## Legenda colonne

| Colonna | Significato |
|--------|-------------|
| **Categoria errore** | Area funzionale (vedi struttura §1–5) |
| **Chiave** | Identificativo interno (`SystemToastType`) |
| **Titolo** | Testo titolo mostrato |
| **Descrizione** | Corpo del messaggio |
| **CTA primaria** | Prima azione (`actions[]`), se presente |
| **CTA secondaria** | Azione secondaria o fallback |
| **Tipo risoluzione** | A / B / C (vedi classificazione sopra) |
| **Note implementative** | Stato tecnico, flag, dipendenze |

---

## 1. Infrastruttura

Errori causati da indisponibilità o sovraccarico dei server Comtra.

### 1a. Server Comtra occupato / throttle

| Chiave | Titolo | Descrizione | CTA primaria | CTA secondaria | Tipo | Note implementative |
|--------|--------|-------------|--------------|----------------|------|---------------------|
| `service_unavailable` | Comtra is temporarily unavailable | Our servers are restarting or under heavy load. Wait a couple of minutes, then retry from where you left off. No data has been lost. | — | × | B | Primo toast del ciclo 503. Se l'outage supera la finestra temporale, si scala al toast 503+sconto (vedi §1b). |
| `throttle_discount_ok` | Discount code ready | Use code `{CODE}` at checkout on your next plan upgrade. It expires in 48 hours. | — | × | B | Codice esposto nel testo. Solo dismiss. |
| `throttle_code_not_ready` | Code not available yet | The discount code unlocks 15 minutes after the outage started. Come back then from the same screen, or continue working and request it later. | — | × | B | Solo dismiss. |
| `throttle_code_failed` | Could not generate code | We could not issue the discount right now. Your account is fine. Wait a moment and use "Request discount code" again. | — | × | C | CTA "Contact support" se si ripete. |

### 1b. Toast 503 con finestra sconto attiva (`App.tsx` → `handle503`)

| Scenario | Titolo | Descrizione | CTA primaria | CTA secondaria | Tipo |
|----------|--------|-------------|--------------|----------------|------|
| Outage prolungato, finestra sconto attiva | Service disruption in progress | Comtra has been unavailable for a while. You can request a one-time 5% discount code as a courtesy, or wait and retry once the service stabilizes. | Request discount code | × + Dismiss | B |
| Outage senza finestra sconto | Comtra is temporarily unavailable | (come `service_unavailable`) | — | × | B |

### 1c. Timeout di rete lato plugin

| Chiave | Titolo | Descrizione | CTA primaria | CTA secondaria | Tipo | Note implementative |
|--------|--------|-------------|--------------|----------------|------|---------------------|
| `figma_not_responding` | Figma is not responding | Figma's API is slow or temporarily unavailable. Check status.figma.com for incidents, then retry from Comtra. Ongoing edits in Figma are not affected. | — | × | B | Copy only. |

---

## 2. Identità e accesso

Errori relativi a sessione, login e accesso al file Figma.

### 2a. Sessione

| Chiave | Titolo | Descrizione | CTA primaria | CTA secondaria | Tipo | Note implementative |
|--------|--------|-------------|--------------|----------------|------|---------------------|
| `session_expired` | Session expired | Your session ended for security. Sign in again to continue. Your work in Figma is intact. | Sign in | × | A | **Azione raccomandata:** CTA "Sign in" deve aprire direttamente il login modal, senza passare dal menu profilo. Attualmente `actions: []` — da implementare. |

### 2b. Login

| Chiave | Titolo | Descrizione | CTA primaria | CTA secondaria | Tipo | Note implementative |
|--------|--------|-------------|--------------|----------------|------|---------------------|
| `login_failed` | Sign-in failed | We could not reach the login service. Check your internet connection, then try signing in again. | Try again | — | B | Non collegato a `showToast` nel repo attuale. CTA "Contact support" al secondo fallimento. |
| `login_timed_out` | Sign-in timed out | The browser window may have closed too soon. Start the sign-in again and complete it in one go. Disable pop-up blockers for this site if needed. | Try again | — | B | Non collegato a `showToast` nel repo attuale. |

### 2c. Connessione Figma

| Chiave | Titolo | Descrizione | CTA primaria | CTA secondaria | Tipo | Note implementative |
|--------|--------|-------------|--------------|----------------|------|---------------------|
| `figma_connection_lost` | *(deprecato)* | *(non deve comparire in produzione)* | — | — | — | **DISABILITATO.** Il flusso OAuth Figma è attualmente disabilitato. L'accesso Figma è gestito tramite PAT-gate: le azioni che richiedono il PAT sono disabilitate a livello UI fino a quando l'utente non inserisce il token in Profile → Personal details. Se questo toast compare in produzione, è un bug da investigare. Aggiungere `console.warn` se il path che porta a questo toast viene raggiunto. |

---

## 3. File e canvas

Errori relativi al file Figma aperto o alla selezione attiva.

> **Nota PAT-gate:** L'Audit è disabilitato finché il PAT non è inserito. Gli errori di questa sezione si presentano solo a PAT configurato, tranne `file_not_saved` che è indipendente.

| Chiave | Titolo | Descrizione | CTA primaria | CTA secondaria | Tipo | Note implementative |
|--------|--------|-------------|--------------|----------------|------|---------------------|
| `file_not_saved` | Save your file first | This action requires a saved Figma file. Press Cmd+S (Mac) or Ctrl+S (Windows), wait for the file to finish saving, then try again. | — | — | A | Usato principalmente come **banner**, non toast. Indipendente dal PAT. |
| `file_link_unavailable` | File link not available | This audit type requires a published Figma file with a shareable link. Switch the scope to Current selection, or open a file you own or have edit access to. | — | — | A | In **Audit**: banner nel tab. In **Code/Generate**: testo errore inline. Può comparire anche con PAT configurato se il file è un draft o non ha link condivisibile. |

---

## 4. Risorse e piano

Errori relativi a crediti, pagamento e codici promozionali.

### 4a. Crediti

| Chiave | Titolo | Descrizione | CTA primaria | CTA secondaria | Tipo | Note implementative |
|--------|--------|-------------|--------------|----------------|------|---------------------|
| `out_of_credits` | Out of credits | This action requires {N} credits and your balance is too low. Top up or upgrade your plan to continue. | View plans | — | A | CTA "View plans" deve navigare alla tab Subscription. Non collegato a `showToast` nel repo attuale — **da implementare**. |

### 4b. Pagamento e checkout

| Chiave | Titolo | Descrizione | CTA primaria | CTA secondaria | Tipo | Note implementative |
|--------|--------|-------------|--------------|----------------|------|---------------------|
| `payment_hiccup` | Payment not processed | We could not complete the payment. Nothing was charged. Check your card details in Subscription and retry. | Go to Subscription | Contact support | C | Dialog pre-popolata con: "Payment failed" + timestamp. |
| `checkout_failed` | Checkout could not open | The payment page failed to load. Nothing was charged. If the problem continues, try in a different browser. | Try again | Contact support | C | Dialog pre-popolata con: "Checkout failed" + timestamp. |
| `discount_unavailable` | Discount unavailable | We could not load your promo code. Your subscription is unchanged. Try again later from Subscription. | — | — | B | Copy only. |

---

## 5. Motori

Errori specifici di ciascun engine del plugin.

### 5a. Audit

#### Errori base (`lib/errorCopy.ts`)

| Chiave | Titolo | Descrizione | CTA primaria | CTA secondaria | Tipo | Note implementative |
|--------|--------|-------------|--------------|----------------|------|---------------------|
| `audit_couldnt_start` | Audit could not start | This run could not complete. Try narrowing the scope to a single frame or page, confirm you are online, and start the audit again. | — | × | B | `actions: []`. Recovery manuale nel tab Audit. CTA "Contact support" al secondo fallimento nella sessione. |
| `audit_timed_out` | Audit timed out | The scan ran longer than expected. Select a smaller frame or a single page and try again. | — | × | B | `actions: []`. |
| `analysis_interrupted` | Analysis interrupted | Our AI pipeline returned an error, usually load-related. Wait briefly, reduce the selection size, and start the audit again. | — | × | B | `actions: []`. CTA "Contact support" se si ripete. |
| `audit_not_available` | Audit not available | This audit type does not apply to the current selection. Choose a frame, instance, or page that matches the audit scope, then try again. | — | — | A | Copy only. |

#### Varianti dinamiche (`AuditView` → `showAuditError`)

Tutte con `actions: []`. Il titolo e la struttura base corrispondono alle chiavi sopra, ma la descrizione viene sostituita in base alla condizione rilevata.

| Condizione | Titolo | Descrizione | Tipo |
|------------|--------|-------------|------|
| Rete / CORS (`isLikelyNetworkOrCorsFetchFailure`) | Audit could not start | We could not reach Comtra from the plugin. Check your Wi-Fi or VPN, confirm other sites load, then run the audit again. | B |
| Rate limit / coda AI — UX | Audit could not start | The UX audit is temporarily busy. Retry in a minute from the Audit tab. | B |
| Rate limit / coda AI — A11Y | Audit could not start | The accessibility audit is temporarily busy. Retry in a minute from the Audit tab. | B |
| Rate limit / coda AI — DS | Audit could not start | The DS audit is temporarily busy. Retry in a minute from the Audit tab. | B |
| Input troppo grande — UX | Audit timed out | This selection may be too large for a single UX audit run. Try a smaller frame or a single component. | A |
| Input troppo grande — A11Y | Audit timed out | This page has more layers than the accessibility audit can process at once. Switch to Current selection and retry. | A |
| Input troppo grande — DS | Audit timed out | This selection is too large for the DS audit. Narrow the scope to a single frame or a few components. | A |
| Upstream / gateway (502/504/503 non coda) | Analysis interrupted | The audit service hit an upstream error. Retry shortly. Very large selections make this more likely. | B |
| A11Y generico fallito | Audit could not start | Accessibility scan could not finish. Check your Figma connection, try Current selection, or retry in a moment. This audit does not use generative AI. | B |
| Validazione Kimi — UX | Audit could not start | The UX audit request was rejected by the AI engine. Reduce the selection size or simplify the scope and try again. | B |
| Validazione Kimi — DS | Audit could not start | The DS audit request was rejected by the AI engine. Reduce the selection size or simplify the scope and try again. | B |
| HTTP status noto | Audit could not start | We could not finish this audit (HTTP {status}). Retry once. Very tall frames often need a smaller scope. | B |
| Fallback | Audit could not start | (come chiave base `audit_couldnt_start`) | B |

> **`file_link_unavailable` in Audit:** non passa da `showToast`. Imposta il testo del **banner** nel tab DS / A11Y / UX. Vedi §3.

---

### 5b. Generate

| Chiave | Titolo | Descrizione | CTA primaria | CTA secondaria | Tipo | Note implementative |
|--------|--------|-------------|--------------|----------------|------|---------------------|
| `generation_failed` | Generation failed | The model returned an unexpected result. Try a simpler prompt or reduce the number of components requested, then generate again. | — | — | B | Copy only. |
| `generate_something_wrong` | Something went wrong | Comtra could not build the output. Check your connection, confirm DS components exist in this file, then generate again. | Try again | — | B | Non collegato a `showToast` nel repo attuale. |
| `generation_timed_out` | Generation timed out | The request took too long. Try again with fewer components or a smaller frame. No credits were deducted for this attempt. | Try again | — | B | Copy only. La nota sui crediti non detratti è importante per ridurre l'ansia dell'utente. |

---

### 5c. Code e Sync

| Chiave | Titolo | Descrizione | CTA primaria | CTA secondaria | Tipo | Note implementative |
|--------|--------|-------------|--------------|----------------|------|---------------------|
| `scan_failed` | Scan failed | The Storybook sync could not finish. Verify the URL and token, confirm Storybook is running, then run the scan again from the Code tab. | — | — | B | Copy only. |
| `unexpected_data` | Unexpected data | The server sent a response we could not parse, usually a transient issue. Run the scan once more. If it keeps happening, re-save the file and retry. | — | — | B | Copy only. |
| `cant_read_design_tokens` | Design tokens unavailable | Comtra could not read your variables. Publish your local variables in Figma (Assets panel → right-click library → Publish), then open Tokens again. | — | — | A | Copy only. |
| `storybook_not_reachable` | Storybook not reachable | We could not reach your Storybook URL. Confirm the URL uses https, start your dev server, check any VPN or firewall rules, then paste the URL again and retry. | — | — | A | Copy only. |
| `sync_timed_out` | Sync timed out | The file or Storybook response was too large. Sync fewer pages or components, or increase your local Storybook heap, then run sync again. | — | — | B | Copy only. |

---

### 5d. DS Import

| Chiave | Titolo | Descrizione | CTA primaria | CTA secondaria | Tipo | Note implementative |
|--------|--------|-------------|--------------|----------------|------|---------------------|
| `ds_import_snapshot_missing` | Import incomplete | The Components step in the import wizard was not completed. Go back and finish it so the full index is captured, then confirm again. | — | × | A | Solo dismiss. |
| `ds_import_server_save_failed` | Design system not saved | The server did not accept this import. Your local file is intact, but the catalog is not live until the server confirms. `{msg}` Fix the issue if you can, then save again from the wizard. | Try again | Contact support | C | Dialog pre-popolata con: messaggio errore server `{msg}` + timestamp. |
| `ds_import_metadata_local_failed` | Local catalog not updated | The snapshot is on the server but local metadata could not be refreshed. `{err}` Your catalog is live. Repeat the import later if you need local metadata aligned. | — | × | B | Solo dismiss. |

---

## 6. Affiliate

| Chiave | Titolo | Descrizione | CTA primaria | CTA secondaria | Tipo | Note implementative |
|--------|--------|-------------|--------------|----------------|------|---------------------|
| `affiliate_load_failed` | Could not load affiliate data | Reopen the plugin or refresh the page. If the problem persists, contact support from the menu. | — | Contact support | C | Nessun `showToast` collegato nel repo attuale. Dialog pre-popolata con: "Affiliate load failed" + timestamp. |
| `affiliate_registration_failed` | Registration failed | We could not complete your affiliate registration. Your account is unchanged. Check the required fields and try again. | Try again | Contact support | C | Dialog pre-popolata con: "Affiliate registration failed" + timestamp + campo che ha generato l'errore se disponibile. |

---

## 7. Generico

| Chiave | Titolo | Descrizione | CTA primaria | CTA secondaria | Tipo | Note implementative |
|--------|--------|-------------|--------------|----------------|------|---------------------|
| `something_went_wrong` | Something went wrong | An unexpected error occurred. Note what you clicked, wait a moment, and try once more. | Try once more | — | B | Fallback da `getSystemToastOptions` se chiave sconosciuta. Nessun `actions` tipico. |
| `count_layers_failed` | Could not count layers | Counting stopped mid-way. The file may have changed during the scan. Click away, reselect the target frame, and start the audit again. | — | — | B | Copy only. |

---

## 8. Toast ad hoc

| Categoria | Scenario | Titolo | Descrizione | CTA | Tipo | Note implementative |
|-----------|----------|--------|-------------|-----|------|---------------------|
| Stats / Analytics | Copia codice sconto riuscita | Code copied | Paste it at checkout on your next upgrade. It stays in your clipboard until you overwrite it. | — | A | Auto-dismiss ~1.1s. `dismissible: false`, nessuna ×. |
| Stats / Analytics | Clipboard bloccata | Clipboard blocked | Automatic copy was blocked by this environment. Select the code on screen and press Cmd+C (Mac) or Ctrl+C (Windows), or type it at checkout. | — | A | Auto-dismiss ~1.4s. |

---

## 9. Banner login

| Scenario | Corpo | CTA | Effetto |
|----------|-------|-----|---------|
| Post logout (`LoginModal`) | You are signed out. Use Log in when you are ready. Your files stay in Figma. | × dismiss | `setLogoutToast(null)` |

---

## 10. Snackbar inline UI

Non sono toast globali. Restano nel layout della vista corrente.

| Area | Componente | Contenuto |
|------|------------|-----------|
| Profilo | `PersonalDetails.tsx` | Avviso conflitto nome Figma vs nome manuale. Pulsanti: "Use Figma name" / "Keep my name". |
| DS Import | `GenerateDsImport.tsx` → `WizardImportGapSnackbars` | Hint su variabili, stili o componenti mancanti nell'indice. |

---

## 11. Notifiche native Figma (`figma.notify`)

Nessuna CTA. Solo messaggio + opzione `{ error: true }` per stile errore Figma. Non fanno parte del sistema toast del plugin.

| File sorgente | Contenuto (sintesi) |
|---------------|---------------------|
| `controller.ts` | Creazione layout Comtra, errori di creazione, conteggio nodi fallito, selezione layer, cambio pagina, rename/placeholder sync drift, fix contrasto/touch target, layer non trovato, revert. |
| `action-plan-executor.ts` | Selezione post-modifica, duplicati, istanze e variabili non risolte durante la generation. |

Per i testi esatti fare riferimento ai file sorgente. Troppo dipendenti dal runtime per essere documentati come copy statico.

---

## 12. Modale trofei

Non è un toast. Modale full-screen con CTA "View in Stats" e "Continue". Titoli badge dinamici da API. Fuori scope di questo catalogo.

---

## Gap aperti e decisioni pendenti

| # | Gap | Stato | Priorità |
|---|-----|-------|----------|
| G-01 | Nessun toast di successo documentato oltre "Code copied". Mancano almeno: "Audit complete", "Generation complete", "Tokens exported", "DS import complete". | Aperto | Alta |
| G-02 | `session_expired`: CTA "Sign in" non collegata. Il toast attuale richiede all'utente di navigare manualmente al menu profilo. | Da implementare in Cursor | Alta |
| G-03 | `out_of_credits`: CTA "View plans" non collegata a `showToast`. | Da implementare in Cursor | Alta |
| G-04 | Escalation automatica al secondo fallimento (Tipo B → CTA "Contact support"): non implementata. La logica deve tracciare i fallimenti per chiave nella sessione corrente. | Da progettare | Media |
| G-05 | Pre-popolamento dialog "Contact support": definire il payload esatto (error key, timestamp, HTTP status, engine context, plugin version) e l'interfaccia tra `showToast` e la dialog. | Da progettare con Cursor | Media |
| G-06 | Chiavi con `showToast` non collegato nel repo (`login_failed`, `login_timed_out`, `out_of_credits`, `checkout_failed`, `affiliate_*`, `generate_something_wrong`): verificare se sono backlog intenzionale o dead code. | Da verificare con Cursor | Bassa |

---

*Aggiornare questo file quando si aggiungono chiavi in `errorCopy` o nuovi `showToast`. Versione precedente: v1 generata da Cursor (maggio 2025).*
