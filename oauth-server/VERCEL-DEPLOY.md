# Deploy su Vercel + Impostazioni Figma (privata/pubblica)

## 1. Impostazioni Figma: privata vs pubblica

Nella sezione **Publish** (o equivalente) della tua OAuth app Figma:

- **Privata (consigliata per test)**  
  Solo gli utenti del **tuo team/organizzazione Figma** possono autorizzare l’app. Nessuna revisione Figma, attivazione immediata. Ideale per “test in prod” con il vostro team.

- **Pubblica**  
  Qualsiasi utente Figma può autorizzare l’app. Richiede **revisione da Figma** prima di andare live. Da usare quando volete aprire il plugin a tutti.

Per ora scegli **Privata** e, quando sei pronto per tutti, potrai richiedere la pubblicazione.

---

## 2. Cosa caricare su Vercel

Deploya **l’intero repository** del plugin (la root dove ci sono `vercel.json`, `api/`, `oauth-server/`, il codice React del plugin, ecc.). Non solo la cartella `oauth-server`.

1. **Vercel:** New Project → Import Git repository (il repo che contiene questo progetto).
2. **Root Directory:** lascia la root (dove si trova `vercel.json`).
3. **Build:** puoi lasciare il comando di build del plugin (es. `npm run build`) oppure vuoto; le API in `api/` vengono servite da Vercel senza build aggiuntivo.
4. **Variabili d’ambiente** (Settings → Environment Variables):
   - `FIGMA_CLIENT_ID` = Client ID dell’app Figma
   - `FIGMA_CLIENT_SECRET` = Client Secret
   - `BASE_URL` = `https://comtra.dev` (o il dominio assegnato da Vercel, es. `xxx.vercel.app`)
   - Dopo aver creato Vercel KV (vedi sotto), Vercel aggiunge da solo `KV_REST_API_URL`, `KV_REST_API_TOKEN`, ecc.

5. **Dominio:** in Vercel aggiungi il dominio **comtra.dev** (o sottodominio tipo **auth.comtra.dev**) e configura il DNS come indicato da Vercel.

---

## 3. Vercel KV (obbligatorio su Vercel)

Su Vercel ogni richiesta può essere gestita da un’istanza diversa, quindi lo “stato” del login (flow_id → risultato) non può restare in memoria. Serve **Vercel KV** (Redis).

1. Nel progetto Vercel: **Storage** → **Create Database** → **KV**.
2. Collega il database al progetto (Vercel aggiunge in automatico le variabili d’ambiente per KV).
3. Il codice in `oauth-server/app.mjs` le usa già: se sono presenti, usa KV; altrimenti memoria (solo locale).

---

## 4. Redirect URL in Figma

Dopo il deploy, l’endpoint di callback è:

- **`https://comtra.dev/auth/figma/callback`**

(usa il dominio che hai collegato al progetto Vercel.)

In Figma → tua OAuth app → **OAuth credentials** → **Redirect URLs** → aggiungi **esattamente** quell’URL.

---

## 5. Riepilogo

- **Figma:** app **Privata** per i test; **Redirect URL** = `https://comtra.dev/auth/figma/callback`; scope **current_user:read** (già impostato).
- **Vercel:** deploy del **repo completo**; env `FIGMA_CLIENT_ID`, `FIGMA_CLIENT_SECRET`, `BASE_URL`; **Vercel KV** creato e collegato; dominio **comtra.dev** (o il tuo) configurato.
- **Plugin:** build con `VITE_AUTH_BACKEND_URL=https://comtra.dev`; in `manifest` è già presente `https://comtra.dev` in `allowedDomains`.
