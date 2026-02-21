# Comtra – Server OAuth Figma

Server minimo da hostare in HTTPS per il flusso **Login with Figma** del plugin.

## Configurazione Figma

1. Vai su [figma.com/developers/apps](https://www.figma.com/developers/apps) e crea una **OAuth app**.
2. Nella configurazione dell’app:
   - **Redirect URLs**: aggiungi l’URL del callback, es. `https://tuodominio.com/auth/figma/callback`
   - **OAuth scopes**: abilita almeno `current_user:read`
3. Copia **Client ID** e **Client Secret** (il secret si vede solo alla creazione).

## Variabili d’ambiente

| Variabile | Descrizione |
|-----------|-------------|
| `FIGMA_CLIENT_ID` | Client ID dell’OAuth app Figma |
| `FIGMA_CLIENT_SECRET` | Client secret dell’OAuth app Figma |
| `BASE_URL` | URL pubblico del server (es. `https://auth.comtra.ai`) |
| `PORT` | Porta (default `3456`) |

## Avvio in locale

```bash
cd oauth-server
npm install
FIGMA_CLIENT_ID=xxx FIGMA_CLIENT_SECRET=yyy BASE_URL=http://localhost:3456 npm run dev
```

Il plugin in dev usa già `http://localhost:3456` (in `constants.ts` e in `manifest` `devAllowedDomains`).

## Deploy in produzione

1. Hostare questo server su un servizio HTTPS (es. Railway, Render, Fly.io, Vercel con serverless adattato).
2. Impostare `BASE_URL` sull’URL pubblico (es. `https://auth.comtra.ai`).
3. Nel **manifest** del plugin aggiungere il dominio del server in `networkAccess.allowedDomains`, es. `"https://auth.comtra.ai"`.
4. Alla **build** del plugin impostare `VITE_AUTH_BACKEND_URL=https://auth.comtra.ai` (o il tuo dominio) così l’UI chiama il server reale.

## Endpoint

- `GET /auth/figma/init` – restituisce `{ authUrl, readKey }` per avviare il flusso (chiamato dal plugin).
- `GET /auth/figma/start?flow_id=...` – imposta cookie e reindirizza a Figma OAuth.
- `GET /auth/figma/callback` – callback Figma; scambia il code con il token, legge `/v1/me`, mostra “Torna su Figma”.
- `GET /auth/figma/poll?read_key=...` – polling del plugin per ottenere l’utente dopo il login.
