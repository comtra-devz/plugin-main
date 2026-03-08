# Login non funziona – cosa controllare

## 1. L’API risponde?

Apri nel browser (sostituisci con l’URL della tua dashboard):

**https://TUA-DASHBOARD.vercel.app/api/admin-auth**

- Se vedi `{"ok":true,"service":"admin-auth"}` → la route è attiva.
- Se vedi 404 → il progetto Vercel non sta esponendo `/api/admin-auth`. Controlla che nella root del **progetto deployato** ci sia la cartella `api` con il file `admin-auth.mjs` (quindi che stai deployando la cartella `admin-dashboard` come root del progetto Vercel).
- Se la pagina non carica / errore di rete → dominio, firewall o URL sbagliato.

## 2. Stai usando la dashboard in locale (npm run dev)?

Con `npm run dev` il frontend è su `http://localhost:5173` e lì **non** c’è nessun backend. Le chiamate a `/api/admin-auth` vanno su localhost e falliscono.

**Soluzione:** imposta l’URL della dashboard deployata così che il frontend in locale chiami le API in produzione.

Crea o modifica `.env` nella cartella `admin-dashboard`:

```env
VITE_ADMIN_API_URL=https://TUA-DASHBOARD.vercel.app
```

Poi riavvia `npm run dev`. Il login userà `https://TUA-DASHBOARD.vercel.app/api/admin-auth`.

## 3. Variabili d’ambiente su Vercel

Nel progetto Vercel della dashboard (Settings → Environment Variables) devono esserci:

- **POSTGRES_URL** (o **DATABASE_URL**): connection string del database (es. Supabase).
- **ADMIN_JWT_SECRET**: stringa segreta per firmare i JWT (es. genera con `openssl rand -hex 32`).

Se **POSTGRES_URL** manca, il login risponde con errore 503 (server non configurato). Dopo aver aggiunto o modificato le variabili, rifai un deploy.

## 4. Errore “Credenziali non valide”

- Controlla di usare una delle due email configurate (es. ben.bugli@gmail.com) e la password usata nello script di seed.
- Se hai cambiato password nel DB, usa quella nuova. Lo script di seed può essere rilanciato con una nuova `ADMIN_SEED_PASSWORD` per aggiornare le password.

## 5. Cosa vedi a schermo?

- **“Impossibile raggiungere il server”** → di solito stai in locale senza `VITE_ADMIN_API_URL`, oppure l’URL della dashboard è sbagliato o non raggiungibile.
- **“Server non configurato (manca POSTGRES_URL?)”** → sul server (Vercel) non è impostata la variabile del database.
- **“Credenziali non valide”** → email o password sbagliate, oppure utente non presente in `admin_users`.

Se dopo questi controlli ancora non funziona, indica cosa vedi esattamente (messaggio di errore e dove: pagina di login, console del browser, log di Vercel).
