# Comtra Admin Dashboard

Dashboard riservata agli admin per monitoraggio utenti, crediti, costi Kimi, affiliati e funnel.  
Le **API admin** sono servite **dallo stesso progetto Vercel** della dashboard (non da auth-deploy), così non consumano il limite di 12 serverless function di auth.comtra.dev.

## Setup

1. Copia `.env.example` in `.env.local` e imposta:
   - `VITE_ADMIN_API_URL`: lascia **vuoto** in produzione (le API sono same-origin, `/api/admin?route=...`). In dev locale puoi mettere l’URL del progetto dashboard deployato (es. `https://admin.comtra.dev`) per chiamare le API in remoto.
   - `VITE_ADMIN_SECRET`: stesso valore di **`ADMIN_SECRET`** configurato nel **progetto Vercel della dashboard** (vedi sotto).

2. Sul **progetto Vercel della dashboard** (non auth-deploy) imposta in Environment Variables:
   - **`POSTGRES_URL`**: stesso URL del DB usato da auth-deploy (Supabase/Postgres).
   - **`ADMIN_SECRET`**: stringa segreta (es. `openssl rand -hex 32`). Le API `/api/admin` accettano solo richieste con header `Authorization: Bearer <ADMIN_SECRET>` o `X-Admin-Key: <ADMIN_SECRET>`.

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

Deploy su Vercel con **Root Directory** = `admin-dashboard` (secondo progetto, stesso repo). Nel **progetto dashboard** configura:
- **Build:** `VITE_ADMIN_SECRET` (stesso valore che userai per le chiamate; può essere uguale a `ADMIN_SECRET`).
- **Runtime (API):** `POSTGRES_URL` (stesso DB di auth-deploy), `ADMIN_SECRET`.
Lascia `VITE_ADMIN_API_URL` vuoto così in produzione la SPA chiama le API in same-origin (`/api/admin?route=...`). Usa un dominio privato (es. `admin.comtra.dev`) e non linkare la dashboard dal sito pubblico.
