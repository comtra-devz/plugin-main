# Deploy OAuth su https://comtra.dev – Istruzioni complete

Non devi creare pagine a mano: il server in questa cartella espone già tutti gli endpoint e la pagina "Torna su Figma". Devi solo hostare questo server sotto il tuo dominio.

---

## Scelta dell’URL

Due opzioni:

- **A) Sotto lo stesso dominio**  
  Il server risponde su `https://comtra.dev/auth/figma/...`  
  Es.: se comtra.dev è già un sito, aggiungi un reverse proxy che inoltra le richieste a `/auth/figma/*` verso questo server (vedi sotto).

- **B) Sottodominio (consigliato)**  
  Usa `https://auth.comtra.dev` per il solo server OAuth.  
  Es.: `https://auth.comtra.dev/auth/figma/callback`  
  Così non tocchi il sito principale comtra.dev.

In entrambi i casi, **Redirect URL in Figma** sarà:
`https://comtra.dev/auth/figma/callback` oppure `https://auth.comtra.dev/auth/figma/callback` a seconda di dove hosti il server.

---

## 1. Figma – Configurazione OAuth

1. Vai su [Figma → Developers → Your apps](https://www.figma.com/developers/apps) e apri la tua OAuth app.
2. **OAuth credentials** → **Redirect URLs**:
   - Se usi **comtra.dev**: aggiungi `https://comtra.dev/auth/figma/callback`
   - Se usi **auth.comtra.dev**: aggiungi `https://auth.comtra.dev/auth/figma/callback`
3. **OAuth scopes**: abilita almeno **current_user:read**.
4. Salva.

Tieni a portata **Client ID** e **Client Secret**.

---

## 2. Hosting del server OAuth

Il server è la cartella `oauth-server/` (Express). Puoi hostarlo su qualsiasi servizio Node (Railway, Render, Fly.io, VPS, ecc.).

### Variabili d’ambiente in produzione

| Variabile | Valore |
|-----------|--------|
| `FIGMA_CLIENT_ID` | Il Client ID dell’app Figma |
| `FIGMA_CLIENT_SECRET` | Il Client Secret (tienilo segreto) |
| `BASE_URL` | `https://comtra.dev` oppure `https://auth.comtra.dev` (stesso dominio che usi come Redirect URL) |
| `PORT` | Di solito il host lo imposta (es. 3000); altrimenti `3456` |

### Esempio: deploy su Railway / Render / Fly.io

- Carica il progetto (o solo la cartella `oauth-server/`) sul servizio.
- Imposta le variabili d’ambiente sopra.
- Il servizio ti assegna un URL (es. `https://comtra-oauth.up.railway.app`).  
  **Oppure** colleghi il tuo dominio (vedi sotto).

### Collegare comtra.dev o auth.comtra.dev

- **Opzione A – Stesso dominio (comtra.dev)**  
  Sul tuo hosting (es. Nginx, Cloudflare, Vercel):  
  - Fai in modo che le richieste a `https://comtra.dev/auth/figma/*` vengano inoltrate (proxy) al server Node che gira da qualche parte (stesso server, altro container, o servizio tipo Railway).  
  - `BASE_URL` deve essere `https://comtra.dev`.

- **Opzione B – Sottodominio (auth.comtra.dev)**  
  1. Nel pannello DNS del dominio comtra.dev crea un record:
     - Tipo: **CNAME** (o **A** se il host ti dà un IP)
     - Nome: **auth** (risultato: auth.comtra.dev)
     - Valore: host fornito dal servizio (es. `xxx.railway.app`) o IP del server
  2. Sul servizio di hosting, aggiungi il dominio personalizzato **auth.comtra.dev** e attiva HTTPS (di solito Let’s Encrypt).
  3. `BASE_URL` = `https://auth.comtra.dev`.

---

## 3. Plugin Figma – Configurazione per produzione

1. **Manifest**  
   Nel `manifest.json` del plugin, in `networkAccess.allowedDomains` aggiungi il dominio del server OAuth:
   - Se usi comtra.dev: `"https://comtra.dev"`
   - Se usi auth.comtra.dev: `"https://auth.comtra.dev"`

2. **Build del plugin**  
   Quando fai il build, imposta l’URL del backend OAuth:
   - Stesso dominio:  
     `VITE_AUTH_BACKEND_URL=https://comtra.dev npm run build`
   - Sottodominio:  
     `VITE_AUTH_BACKEND_URL=https://auth.comtra.dev npm run build`

Così il plugin in produzione chiamerà il tuo server reale.

---

## 4. Riepilogo checklist

- [ ] Server OAuth deployato e raggiungibile in HTTPS (comtra.dev o auth.comtra.dev).
- [ ] Variabili d’ambiente impostate: `FIGMA_CLIENT_ID`, `FIGMA_CLIENT_SECRET`, `BASE_URL`.
- [ ] In Figma: Redirect URL aggiunto (es. `https://auth.comtra.dev/auth/figma/callback`) e scope `current_user:read`.
- [ ] Nel plugin: stesso dominio in `manifest` `allowedDomains` e `VITE_AUTH_BACKEND_URL` usato in build.
- [ ] Test: apri il plugin → "Login with Figma" → login nel browser → redirect alla pagina "Torna su Figma" → torni su Figma e vedi la dashboard con avatar/iniziali.

---

## 5. Non devi generare pagine

Le “pagine” sono già nel server:
- **/auth/figma/init** – usato dal plugin (JSON).
- **/auth/figma/start** – redirect a Figma (nessuna pagina tua).
- **/auth/figma/callback** – dove Figma reindirizza dopo il login; il server risponde con la pagina HTML **"Torna su Figma"** (già inclusa nel codice).
- **/auth/figma/poll** – usato dal plugin (JSON).

Non serve creare nulla a mano su comtra.dev oltre a hostare questo server e, se vuoi, il proxy/DNS descritti sopra.
