# Comtra Admin Dashboard

Dashboard riservata agli admin per monitoraggio utenti, crediti, costi Kimi, affiliati e funnel.  
Vedi [docs/ADMIN-DASHBOARD-PROPOSAL.md](../docs/ADMIN-DASHBOARD-PROPOSAL.md) per il piano.

## Setup

1. Copia `.env.example` in `.env.local` e imposta:
   - `VITE_ADMIN_API_URL`: URL del backend (es. `https://auth.comtra.dev`)
   - `VITE_ADMIN_SECRET`: stesso valore di `ADMIN_SECRET` configurato in Vercel per il progetto auth-deploy

2. Sul backend (auth-deploy): aggiungi in Vercel → Environment Variables la variabile **`ADMIN_SECRET`** (es. `openssl rand -hex 32`). Le route `/api/admin/*` accettano solo richieste con header `Authorization: Bearer <ADMIN_SECRET>` o `X-Admin-Key: <ADMIN_SECRET>`.

## Sviluppo

```bash
npm install
npm run dev
```

Apri `http://localhost:3001`. Se non hai impostato `VITE_ADMIN_SECRET`, le chiamate API falliranno con 401.

## Build e deploy

```bash
npm run build
```

Deploy su Vercel con **Root Directory** = `admin-dashboard`. Configura le env `VITE_ADMIN_API_URL` e `VITE_ADMIN_SECRET` nel progetto Vercel. Usa un dominio privato (es. `admin.comtra.dev`) e non linkare la dashboard dal sito pubblico.
