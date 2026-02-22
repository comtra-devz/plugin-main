# Verifica OAuth Figma – checklist e test

Usa questa checklist per essere sicuro che tutto sia configurato. Se qualcosa non torna, fermati lì e sistemalo.

---

## 1. Database su Vercel (la schermata che hai visto)

**Cosa significa:** Il server OAuth su Vercel deve ricordare lo “stato” del login tra una richiesta e l’altra (init → callback → poll). Senza database condiviso, ogni richiesta va a un’istanza diversa e lo stato si perde.

- [ ] **Hai creato il database Redis “comtra-figma-oauth”?** → Devi **cliccare “Connect”** e collegarlo al **progetto** che fa il deploy di auth.comtra.dev (lo stesso che ha `api/figma-oauth`, `oauth-server`, `vercel.json`).
- [ ] Dopo “Connect”, in **Settings → Environment Variables** del progetto dovresti vedere variabili tipo `KV_REST_API_URL`, `KV_REST_API_TOKEN` (o simili con prefisso del database). Se non ci sono, il database non è collegato al progetto.

**Se il database non è collegato:** init e callback funzionano, ma il poll non trova mai l’utente e il plugin resta “in attesa”. Collega il DB e rifai un deploy.

---

## 2. Variabili d’ambiente su Vercel

Nel **progetto** che deploya auth.comtra.dev (Settings → Environment Variables):

| Variabile | Valore | Dove prenderlo |
|-----------|--------|----------------|
| `FIGMA_CLIENT_ID` | (es. `xxxxx`) | Figma → Your apps → [tua app] → Client ID |
| `FIGMA_CLIENT_SECRET` | (segreto) | Stessa app → Client secret |
| `BASE_URL` | `https://auth.comtra.dev` | Esatto, senza slash finale |
| KV_* | (impostate da Vercel) | Compaiono dopo aver collegato il database (punto 1) |

- [ ] Le quattro sopra sono presenti (KV_* possono essere 2–3 variabili).
- [ ] Dopo aver modificato le variabili: **Redeploy** del progetto (Deployments → … → Redeploy).

---

## 3. Dominio e redirect su Figma

- [ ] Su **Vercel** → progetto → **Settings → Domains**: è presente **auth.comtra.dev** (o il dominio che usi per OAuth).
- [ ] Nel **DNS** del tuo dominio (es. OVH) esiste un record (es. CNAME) che punta **auth** a Vercel (come indicato da Vercel).
- [ ] In **Figma** → Your apps → [tua app] → **Redirect URL** contiene esattamente:  
  `https://auth.comtra.dev/auth/figma/callback`  
  (stesso dominio di BASE_URL, path `/auth/figma/callback`).

---

## 4. Test rapidi dal browser (senza plugin)

Apri una scheda e prova:

1. **Init (deve restituire JSON)**  
   Vai a:  
   `https://auth.comtra.dev/api/figma-oauth/init`  
   - **Ok:** pagina con JSON tipo `{"authUrl":"...","readKey":"..."}`.  
   - **Non ok:** 404, 500, o “Cannot GET”: problema di deploy/rewrite o variabili.

2. **CORS (opzionale)**  
   Dalla **console** del browser (F12), su una pagina qualsiasi esegui:  
   `fetch('https://auth.comtra.dev/api/figma-oauth/init').then(r=>r.json()).then(console.log)`  
   - **Ok:** in console vedi l’oggetto con `authUrl` e `readKey`.  
   - **Non ok:** errore CORS → il backend non sta inviando le header CORS (controlla che il deploy usi la versione di `oauth-server/app.mjs` con la CORS per origin `null`).

Se il punto 1 o 2 fallisce, non andare avanti col plugin: prima sistemare backend, variabili e deploy.

---

## 5. Plugin

- [ ] **Build:** dalla root del plugin hai eseguito almeno una volta `npm run build` (il default ora è già `https://auth.comtra.dev` in `constants.ts`).
- [ ] **Ricaricamento:** in Figma hai **ricaricato il plugin** (Development → il tuo plugin → ricarica / riapertura) dopo l’ultimo build.
- [ ] **Rete:** in `manifest.json` è presente `https://auth.comtra.dev` in `networkAccess.allowedDomains` (già così nel repo).

---

## 6. Ordine consigliato

1. Collega il database al progetto (Connect) e verifica che compaiano le variabili KV.
2. Controlla FIGMA_CLIENT_ID, FIGMA_CLIENT_SECRET, BASE_URL; redeploy.
3. Verifica dominio e redirect Figma.
4. Test init (e CORS) dal browser.
5. Build e ricarica plugin, poi prova “Login with Figma”.

Se un passo fallisce, correggere quello prima di passare al successivo.
