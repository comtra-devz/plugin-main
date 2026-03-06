# Figma token e "Riconnetti Figma" — guida

## Comportamento attuale (seamless)

Quando il backend chiama l’API Figma e riceve **403** (token rifiutato), **prima di restituire errore** prova una volta a **rifare il refresh** del token e a **ritentare** la richiesta. Solo se anche il refresh fallisce (es. utente ha revocato l’app su Figma) viene restituito l’errore e in plugin vedi il messaggio **"Figma non connesso"** con un solo pulsante **"Riconnetti Figma"**. In tutti gli altri casi (token scaduto ma refresh ancora valido) l’utente non vede alcun errore.

Quando vedi il messaggio "Figma non connesso" / "Riconnetti Figma", il plugin è loggato (hai la sessione) ma il **backend** non ha un token Figma valido per te. Il token serve per "Tutto" e "Una pagina" (il backend scarica il file da Figma per conto tuo).

## Dove vive il token

- **Plugin**: salva solo la sessione (JWT) in `clientStorage`. Non salva il token Figma.
- **Backend**: salva il token in DB nella tabella **`figma_tokens`** (colonne: `user_id`, `access_token`, `refresh_token`, `expires_at`). Viene scritto **solo** al termine del flusso OAuth Figma (callback `/auth/figma/callback`).

Quindi: se il salvataggio in `figma_tokens` fallisce o la tabella non esiste, avrai sempre "No Figma token" anche se il login sembra andato a buon fine.

---

## Cause possibili e cosa fare

### 1. Tabella `figma_tokens` assente o schema vecchio

Se il DB è stato creato prima dell’introduzione di `figma_tokens`, la tabella non c’è. L’INSERT nel callback va in errore (noi lo logghiamo come `figma_tokens save failed`), ma la sessione viene comunque creata.

**Cosa fare:**  
Esegui nel DB (Supabase SQL Editor o altro client) la parte di schema che crea `figma_tokens`:

```sql
CREATE TABLE IF NOT EXISTS figma_tokens (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Poi fai di nuovo **Logout** nel plugin e **Log in with Figma**, e completa il flusso fino alla pagina "Login completato".

---

### 2. Salvataggio token fallito al primo login

Il backend ora salva **users** e **figma_tokens** in una **transazione atomica**: se il salvataggio del token fallisce, l’intero login fallisce e l’utente vede la pagina "Qualcosa non è andato a buon fine" invece di "Login completato". Non si crea più una sessione senza token.

Se il salvataggio fallisce, nei log compare:  
`OAuth callback: users+figma_tokens transaction FAILED — user_id= ... error= ...`

**Cosa fare:**  
- Controlla i log del backend subito dopo aver fatto "Login with Figma".  
- Leggi il messaggio di errore (es. violazione di chiave, RLS, permessi).  
- Correggi il problema (schema, permessi, variabili) e rifai **Log in with Figma**.

---

### 3. Verificare se il backend ha un token per te

È disponibile un endpoint di debug che risponde solo se sei autenticato (JWT valido):

- **GET** (o **POST**) **`/api/figma/token-status`**  
  Header: `Authorization: Bearer <il_tuo_jwt>`

Risposta possibile:

- `{ "ok": true, "hasToken": true }` — token presente e **verificato con Figma** (chiamata a `GET /v1/me`): puoi usare audit/file.  
- `{ "ok": false, "hasToken": false, "reason": "no_row" }` — nessuna riga in `figma_tokens` per il tuo `user_id`.  
- `{ "ok": false, "hasToken": false, "reason": "expired_or_invalid" }` — token scaduto e refresh fallito.  
- `{ "ok": false, "hasToken": false, "reason": "figma_rejected" }` — il token in DB non è più accettato da Figma (revocato o scaduto lato Figma). Fai Logout e Log in with Figma.

**Come usarlo:**  
Dopo il login, da browser o da Postman chiama l’endpoint con l’`authToken` che il plugin ha in sessione (se hai un modo per leggerlo, es. da `clientStorage` in sviluppo). In alternativa, possiamo aggiungere nel plugin un pulsante "Verifica token" che chiama questo endpoint e mostra il risultato.

---

### 4. Flusso OAuth non completato

Se chiudi la finestra di Figma prima di arrivare alla pagina "Login completato" del nostro backend, il callback non viene chiamato e il token non viene mai salvato.

**Cosa fare:**  
Rifare **Log in with Figma** e attendere di vedere la pagina "Login completato" (e, se previsto, che la finestra si chiuda da sola). Poi verificare con l’endpoint sopra.

---

### 5. Ambiente diverso (local vs Vercel)

Se il plugin in sviluppo punta a un backend (es. locale) e in produzione a un altro (es. Vercel), il token è salvato solo nel DB usato dal backend che ha gestito il callback. Stesso utente su un altro ambiente = nessun token su quell’ambiente.

**Cosa fare:**  
Assicurarsi che dopo il login il browser venga reindirizzato allo **stesso** backend che userai per l’audit (stesso `BASE_URL` / stesso deploy). Rifare il login su quell’ambiente e controllare di nuovo con `/api/figma/token-status`.

---

## Checklist rapida

1. [ ] Nel DB esiste la tabella `figma_tokens` (vedi schema sopra).  
2. [ ] Dopo "Log in with Figma" arrivi alla pagina "Login completato".  
3. [ ] Nei log del backend dopo il login **non** compare `figma_tokens save failed`.  
4. [ ] Chiamata a `/api/figma/token-status` con il tuo JWT restituisce `hasToken: true`.  
5. [ ] Il plugin usa lo stesso backend (stesso dominio) per login e per le chiamate audit.

Se tutti i punti sono ok e l’errore persiste, condividi l’output di `/api/figma/token-status` e, se possibile, le righe di log del backend subito dopo un login (senza token sensibili).

---

## "Errore di rete: Failed to fetch" (Verifica token o audit)

Se cliccando **Verifica token** o avviando l’audit compare **"Failed to fetch"**, il plugin **non riesce proprio a contattare il backend**. Non è un problema di token in DB.

**Possibili cause:**

1. **Backend spento o URL sbagliata**  
   Il plugin usa `AUTH_BACKEND_URL` (in build: variabile `VITE_AUTH_BACKEND_URL`; default `https://auth.comtra.dev`). Controlla che:
   - il backend sia online (apri in browser l’URL base, es. `https://auth.comtra.dev`);
   - in sviluppo non stia usando `http://localhost:...` mentre il plugin gira in Figma (dominio diverso: il browser può bloccare la richiesta).

2. **CORS**  
   La richiesta è cross-origin (dal dominio Figma al tuo backend). Il backend deve rispondere con intestazioni CORS che consentano l’origine del plugin (es. `Access-Control-Allow-Origin: *` o l’origine corretta). Se il backend non le invia, il browser blocca la richiesta e vedi "Failed to fetch".

3. **Deploy non aggiornato**  
   Se hai aggiunto da poco l’endpoint `/api/figma/token-status`, assicurati di aver fatto il deploy (es. su Vercel) così che quella route esista davvero.

4. **Estensioni / firewall**  
   Un’estensione del browser (blocco annunci, privacy) o un firewall aziendale possono bloccare le richieste verso il dominio del backend.

**Cosa fare:**  
Verifica l’URL mostrata nel messaggio di errore (ora è inclusa). Apri quella URL in un altro tab (senza Authorization): se non carica, il problema è raggiungibilità o deploy. Se carica ma il plugin continua a dare "Failed to fetch", è probabile CORS o blocco lato client.
