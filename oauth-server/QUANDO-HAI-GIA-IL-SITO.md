# Hai già il sito su comtra.dev – Cosa fare per OAuth

Vuoi usare **comtra.dev/auth/figma/callback** (o l’hai già messo in Figma). Il sito è già online su comtra.dev. Due casi:

---

## Caso A – Il sito comtra.dev è hostato su Vercel

Se oggi **comtra.dev** punta a un **progetto Vercel** (stesso account, stesso o altro progetto):

- Aggiungi il **codice OAuth** (cartella `api/`, `vercel.json`, logica in `oauth-server/`) **nello stesso progetto Vercel** che serve comtra.dev.
- Fai deploy: le route **/auth/figma/*** saranno servite sullo **stesso dominio** comtra.dev.
- **Nessun cambio DNS**, nessun sottodominio.
- **Redirect URL in Figma:** resta **`https://comtra.dev/auth/figma/callback`**.
- **BASE_URL** in Vercel: **`https://comtra.dev`**.

Come fare in pratica:
1. Nel **repository** del sito comtra.dev (quello che deployi su Vercel), aggiungi:
   - il file **vercel.json** (con la rewrite per `/auth/figma/*` → `/api/figma-oauth`),
   - la cartella **api/** con **figma-oauth.mjs**,
   - la cartella **oauth-server/** (almeno **app.mjs**).
2. Aggiungi le dipendenze necessarie (express, cors, cookie-parser, @vercel/kv) nel **package.json** di quel repo, se non ci sono già.
3. Imposta le variabili d’ambiente (FIGMA_CLIENT_ID, FIGMA_CLIENT_SECRET, BASE_URL, KV).
4. Redeploy del progetto.

Così **comtra.dev** continua a servire il sito e in più risponde a **comtra.dev/auth/figma/callback** (e init, start, poll).

---

## Caso B – Il sito comtra.dev è hostato da un altro provider (non Vercel)

Se **comtra.dev** punta a un altro hosting (es. altro cloud, server, altro servizio) e **non** a Vercel:

- Non puoi “iniettare” le route /auth/figma sullo stesso comtra.dev senza toccare quel server (proxy, ecc.).
- La soluzione più semplice è usare un **sottodominio** solo per l’OAuth:
  - **auth.comtra.dev** → progetto Vercel (dove c’è api/ + oauth-server).
  - **comtra.dev** → resta com’è (sito attuale).

Cosa fare:
1. Su **Vercel**: nel progetto del plugin/OAuth aggiungi il dominio **auth.comtra.dev** (Settings → Domains → Add).
2. Nel **DNS** di comtra.dev: crei **solo** un record per **auth** (Sottodominio = `auth`, Destinazione = valore che Vercel ti dà per auth.comtra.dev). Non tocchi i record che fanno funzionare comtra.dev.
3. In **Figma** → Redirect URL: **cambi** in **`https://auth.comtra.dev/auth/figma/callback`** (non più comtra.dev).
4. Su **Vercel** → variabile **BASE_URL** = **`https://auth.comtra.dev`**.
5. Build del plugin con **`VITE_AUTH_BACKEND_URL=https://auth.comtra.dev`**.

Il sito resta su comtra.dev; il login Figma usa auth.comtra.dev. Per l’utente è trasparente: clicca “Login with Figma”, apre Figma, poi “Torna su Figma”.

---

## Riepilogo

| Dove è ora il sito comtra.dev? | Cosa fare | Redirect URL in Figma |
|--------------------------------|-----------|------------------------|
| **Su Vercel** (stesso account)  | Aggiungi api/ + oauth-server + vercel.json **nello stesso progetto** e redeploy. Nessun cambio DNS. | **https://comtra.dev/auth/figma/callback** |
| **Altrove** (non Vercel)        | Usa **auth.comtra.dev** per OAuth su Vercel; aggiungi solo record DNS per `auth`. | **https://auth.comtra.dev/auth/figma/callback** |

Se mi dici se il sito è su Vercel o su un altro hosting, il passo successivo è solo uno dei due percorsi sopra.
