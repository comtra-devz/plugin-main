# Mappatura messaggi d'errore e toast

Documento di riferimento: dove nascono gli errori, come arrivano all’utente (toast vs banner inline vs stato), e possibili toast aggiuntivi da considerare.

---

## Riferimento ufficiale: copy e gravità

**Per la generazione di nuovi messaggi d'errore e la gestione della gravità usare sempre:**

- **[docs/comtra-error-messages.md](./comtra-error-messages.md)** — spec completa: titolo, descrizione, CTA, **variant** (`error` | `warning` | `info` | `default`), **surface** (toast | banner | inline | figma-notify), e regole di copy (tone, niente codici HTTP, credit safety).
- **Severity mapping** (stesso doc, sezione "Severity mapping"): 401/402/403 Figma/503/504 → `warning`; 404/502/500 → `error`; "file not saved" → `info`. Mai esporre messaggi raw all'utente; catch-all "Something went wrong" per il resto.

L'implementazione futura (helper `showSystemToast`, variant `warning`/`info` nel componente Toast) deve allinearsi a quel documento.

---

## 1. Toast attuali (plugin UI)

| Contesto | Titolo / Descrizione | Variant | Quando |
|----------|----------------------|--------|--------|
| **503 / Throttle** | "Servizio temporaneamente non disponibile" + "Riprova più tardi." (o dopo 15 min messaggio sconto + CTA) | error | Ogni fetch che riceve 503 (credits, trophies, estimate, consume, figma/file, ds-audit, a11y-audit, sync-scan, generate, linkedin-shared). |
| **503 → Richiedi codice** | "Codice non ancora disponibile" / "Attendi 15 minuti dall'errore…" | error | Click su "Richiedi codice sconto" prima dei 15 min. |
| **503 → Codice ottenuto** | "Codice sconto 5%" / "Usa il codice: …" | default | Richiesta codice throttle andata a buon fine. |
| **503 → Errore richiesta codice** | "Errore" / data.error o "Non disponibile" o "Riprova più tardi." | error | POST throttle-discount fallita o eccezione. |
| **Audit (token/connessione)** | "Errore A11Y" o "Errore Design System" / "La connessione non è completa. Riprova tra poco." | error | Audit fallito e `isTokenRelatedError(message)` (Figma non connesso, token, file non trovato). CTA "Riprova" se `onRetryConnection`. |

---

## 2. Errori mostrati senza toast (solo banner / stato)

### Audit (AuditView)

| Origine | Messaggio tipico | Dove appare |
|---------|-------------------|-------------|
| `msg.error` (file-context-result) | "Save the file to run the audit." / errore da controller | `showAuditErrorToast` + `setDsAuditError` / `setA11yAuditError` (banner + toast) |
| `consumeCredits` → Insufficient credits | — | `onUnlockRequest()` (modal upgrade), nessun testo errore in Audit |
| `consumeCredits` → altro errore | result.error (es. "Server error", "Unauthorized", "Network error") | `setAuditError` + `showAuditErrorToast` (banner + toast) |
| fetchA11yAudit / fetchDsAudit throw | err.message (es. "Servizio temporaneamente non disponibile", "Kimi API error", "Figma non connesso…") | `setAuditError` + `showAuditErrorToast` (banner + toast) |
| Timeout / 504 | "L'audit ha impiegato troppo tempo. Prova con una singola pagina…" | `setAuditError` (banner + toast via showAuditErrorToast) |
| Fix (Apply) → consumeCredits error | "Crediti insufficienti. Upgrade o riprova più tardi." / result.error | `setAuditFixError` (banner inline sotto issue), **no toast** |
| "Audit not available" | Testo letterale | setAuditError + showAuditErrorToast |

### Generate (Generate.tsx)

| Origine | Messaggio | Dove appare |
|---------|-----------|-------------|
| requestFileContext → error | ctxError o "Salva il file per generare." | `setGenError` (banner inline), **no toast** |
| fetchGenerate → risposta non valida | "Risposta non valida." | setGenError |
| consumeCredits → error | consumed.error | setGenError |
| fetchGenerate throw | err.message | setGenError |

### Code / Sync (Code.tsx, SyncTab)

| Origine | Messaggio | Dove appare |
|---------|-----------|-------------|
| Messaggio `sync-scan-result` con msg.error | msg.error | `setSyncScanError` (banner in SyncTab), **no toast** |
| "Save the file to run the scan." | Testo da file-context | setSyncScanError |
| "Invalid data received. Try again." | Fallback parsing | setSyncScanError |
| consumeCredits / fetchSyncScan error | "Crediti insufficienti" / result.error / err.message | setSyncScanError |
| design-tokens-error | msg.error ?? "Failed to read variables" | setSyncScanError (o JSON con error) |

### Login (App.tsx + LoginModal)

| Origine | Messaggio | Dove appare |
|---------|-----------|-------------|
| Init OAuth: fetch fail / throw | "Impossibile contattare il server (…)" o msg | `setLoginError` (LoginModal inline), **no toast** |
| Init: "Risposta server non valida" | Testo letterale | setLoginError |
| Poll: data?.error o tokenSaved === false | "Qualcosa non è andato a buon fine. Riprova il login." | setLoginError |

### Affiliate (Affiliate.tsx)

| Origine | Messaggio | Dove appare |
|---------|-----------|-------------|
| GET affiliates fail | "Impossibile caricare il programma affiliati." | setError (banner rosso inline) |
| POST register: data.error | data.error o "Registrazione fallita." | setError |

### Subscription (Subscription.tsx)

| Origine | Messaggio | Dove appare |
|---------|-----------|-------------|
| GET /api/discounts/me fail | — | .catch(() => {}) silenzioso, nessun messaggio |

---

## 3. Controller / Figma (messaggi verso UI)

| Evento / azione | Contenuto errore | Chi lo riceve in UI |
|------------------|------------------|----------------------|
| file-context-result con error | "Save the file to run the audit." / String(e) | AuditView → showAuditErrorToast + banner |
| count-nodes-error | errMsg (es. "Layer not found", timeout) | AuditView solo console; figma.notify con error: true |
| design-tokens-error | errMsg | Code.tsx → setSyncScanError / JSON error |
| Layer not found (apply fix) | figma.notify("Layer not found", { error: true }) | Solo notifica Figma, nessun toast UI |

---

## 4. Backend (auth-deploy) → possibili messaggi che arrivano al client

Riepilogo risposte che possono diventare `data.error` o corpo risposta:

- **401** Unauthorized → "Unauthorized" / "Server error"
- **402** Insufficient credits → gestito a parte (onUnlockRequest / "Crediti insufficienti")
- **403** Figma non connesso → "Figma non connesso. Clicca \"Riconnetti Figma\" nel plugin." (+ code FIGMA_RECONNECT)
- **404** File not found / User not found / Not an affiliate → msg o "Server error"
- **400** Validazione (file_key required, credits_consumed must be positive, invalid body, ecc.) → msg in body
- **502** Figma API error / Kimi API error / Invalid response from AI → error + eventuale details
- **503** Database not configured, KIMI not configured, throttle, "Impossibile creare il codice" → msg in body (o Vercel 503 senza body → handle503)
- **500** Server error → "Server error" generico

---

## 5. Possibili toast d’errore da aggiungere (analisi environment)

Errori che oggi sono solo banner inline o silenziosi e che potrebbero avere un toast unificato:

| Scenario | Attuale | Suggerimento |
|----------|---------|--------------|
| **401 dopo sessione scaduta** (es. credits/trophies/agents) | Spesso diventa "Server error" o "Unauthorized" in banner; a volte nessun refresh sessione | Toast: "Sessione scaduta. Esegui di nuovo l’accesso." + CTA "Accedi" (opzionale). Può essere mostrato quando `r.status === 401` su chiamate con Bearer. |
| **403 Figma non connesso** (ds-audit, a11y, generate, figma/file) | Già gestito in Audit con showAuditErrorToast e "Riconnetti"; in Generate/Code può essere solo setGenError/setSyncScanError | Valutare toast unificato quando `data?.code === 'FIGMA_RECONNECT'` o messaggio contiene "Figma non connesso", con CTA "Riconnetti Figma" ovunque. |
| **Crediti insufficienti (402)** su consume | Audit: onUnlockRequest senza messaggio; Fix: banner "Crediti insufficienti. Upgrade…"; Generate/Code: setGenError/setSyncScanError | Toast opzionale: "Crediti insufficienti" + "Upgrade o riprova più tardi." + CTA "Upgrade" per coerenza con altri errori bloccanti. |
| **Timeout / 504** (audit, generate, sync-scan) | Audit: messaggio dedicato in banner + toast; Generate/Code: solo setGenError/setSyncScanError | Estendere toast "L’operazione ha impiegato troppo tempo…" anche a Generate e Sync quando il messaggio è timeout/504. |
| **502 / Kimi API error / Figma API error** | Arrivano come err.message in banner (Audit/Generate/Code) | Toast generico: "Errore temporaneo del servizio. Riprova tra poco." per 502, lasciando il dettaglio in banner se serve. |
| **Subscription: GET discounts/me fallisce** | .catch vuoto | Toast opzionale: "Impossibile caricare il codice sconto. Riprova più tardi." (solo se vogliamo dare feedback). |
| **Checkout redirect** (buildCheckoutRedirectUrl + redirect) | L’utente va su Lemon Squeezy; eventuale errore di redirect non gestito in UI | Se in futuro intercetti redirect fallito (es. tab chiusa, errore), toast: "Impossibile aprire la pagina di pagamento. Riprova." |
| **Count-nodes fallito** (controller) | figma.notify + count-nodes-error; UI non mostra toast | Opzionale: toast "Conteggio nodi non disponibile. Riprova lo scan." quando count-nodes-error blocca l’audit. |
| **Sync: Storybook unreachable** | Backend restituisce connectionStatus: 'unreachable' + error | Oggi in setSyncScanError; si può aggiungere toast: "Storybook non raggiungibile. Verifica l’URL e che il server sia avviato." |

---

## 6. Riepilogo azioni consigliate

1. **Mappatura completata**: questo doc è la mappatura aggiornata (toast esistenti + errori solo banner/stato + backend).
2. **Toast unificati da valutare**:
   - 401 → "Sessione scaduta. Esegui di nuovo l’accesso."
   - 403 Figma → stesso messaggio e CTA "Riconnetti Figma" in Audit, Generate, Code (eventualmente tramite un unico helper che mostra il toast).
   - 402 (crediti) → toast opzionale con CTA "Upgrade".
   - Timeout/504 → stesso tipo di messaggio in Generate e Sync (e toast se non già presente).
   - 502 / errori esterni → toast generico "Errore temporaneo del servizio. Riprova." dove oggi c’è solo banner.
3. **Coerenza**: dove oggi c’è solo banner (es. auditFixError, genError, syncScanError), decidere quali casi devono anche mostrare un toast (stile error) per visibilità sopra la nav, come per Audit e 503.
