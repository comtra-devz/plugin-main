# Server OAuth Figma (locale / riferimento)

Server minimo per il flusso **Login with Figma**. In produzione si usa la cartella **auth-deploy** deployata su Vercel (vedi [../docs/OAUTH-FIGMA.md](../docs/OAUTH-FIGMA.md)).

## Variabili

| Variabile | Descrizione |
|-----------|-------------|
| `FIGMA_CLIENT_ID` | Client ID OAuth app Figma |
| `FIGMA_CLIENT_SECRET` | Client secret |
| `BASE_URL` | URL pubblico (es. `https://auth.comtra.dev`) |
| `REDIS_URL` | (opzionale) URL Redis per stato condiviso |

## Avvio in locale

```bash
cd oauth-server
npm install
FIGMA_CLIENT_ID=xxx FIGMA_CLIENT_SECRET=yyy BASE_URL=http://localhost:3456 npm run dev
```

Il plugin in dev usa `http://localhost:3456` (constants + manifest `devAllowedDomains`).
