# "No Figma token; re-login to grant file access" — guida

Quando vedi questo errore, il plugin è loggato (hai la sessione) ma il **backend** non ha un token Figma valido per te. Il token serve per chiamate come "Tutto" e "Una pagina" (il backend scarica il file da Figma per conto tuo).

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

Anche con la tabella presente, l’INSERT può fallire (rete, timeout, constraint). In quel caso nei log del backend (es. Vercel) compare:  
`figma_tokens save failed (user_id= ...)`.

**Cosa fare:**  
- Controlla i log del backend subito dopo aver fatto "Login with Figma" e aver visto "Login completato".  
- Se vedi `figma_tokens save failed`, leggi il messaggio di errore (es. violazione di chiave, tipo di dato).  
- Correggi il problema (schema, permessi, variabili) e rifai **Logout** + **Log in with Figma**.

---

### 3. Verificare se il backend ha un token per te

È disponibile un endpoint di debug che risponde solo se sei autenticato (JWT valido):

- **GET** (o **POST**) **`/api/figma/token-status`**  
  Header: `Authorization: Bearer <il_tuo_jwt>`

Risposta possibile:

- `{ "ok": true, "hasToken": true }` — token presente e utilizzabile (o rinfrescabile).  
- `{ "ok": false, "hasToken": false, "reason": "no_row" }` — nessuna riga in `figma_tokens` per il tuo `user_id`.  
- `{ "ok": false, "hasToken": false, "reason": "expired" }` — token scaduto e refresh fallito.

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
