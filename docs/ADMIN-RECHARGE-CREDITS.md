# Ricarica crediti da Admin (dashboard)

Ricarica crediti **additiva** lato admin: non passa da Lemon, utile per correzioni errori e per prolungare test su alcuni account.

## Flusso

1. **Dashboard → Utenti**: colonna **Ricarica** con CTA.
2. **Click Ricarica** (disabilitata se l’utente è stato già ricaricato nelle ultime 12 ore):
   - Si apre una modale (step 1): inserire **quantità crediti** e confermare.
3. **Step 2**: il backend genera un **PIN a 6 cifre** (scadenza 5 minuti), lo salva in DB (hash) e lo invia a **admin@comtra.dev** via email (Resend).
4. L’admin inserisce il **PIN** nella modale e conferma.
5. Backend: incrementa `users.credits_total`, imposta `last_admin_recharge_at`, scrive movimento in `credit_transactions` (`action_type = 'admin_recharge'`, `credits_consumed` negativo), crea riga in `user_credit_gifts` per il plugin.
6. La tabella utenti si aggiorna (crediti aggiornati); la CTA Ricarica per quell’utente resta disabilitata per **12 ore**.

## Plugin (utente che riceve i crediti)

- Alla **prima apertura** del plugin dopo una ricarica, viene mostrata una modale in stile “Level Up” (BRUTAL): **“Hai ricevuto un regalo!”** e il numero di crediti aggiunti.
- La modale viene mostrata **una sola volta** per quella ricarica (il backend segna `user_credit_gifts.shown_at` dopo la chiusura).

## Cooldown 12 ore

- Per ogni utente, dopo una ricarica confermata non è possibile effettuare un’altra ricarica per **12 ore** (campo `users.last_admin_recharge_at`).
- La CTA **Ricarica** nella riga dell’utente è disabilitata fino al termine del cooldown.

## Storico movimenti e fattore di calcolo

- Ogni ricarica è registrata in **`credit_transactions`** con:
  - `action_type = 'admin_recharge'`
  - `credits_consumed` **negativo** (es. -50 = 50 crediti aggiunti).
- Nelle pagine dashboard che mostrano “crediti consumati” (es. stats, timeline), le ricariche admin sono **escluse** dalla somma “crediti consumati” (solo consumo reale).
- In **by_action_type** e negli elenchi per tipo, `admin_recharge` compare come voce separata (crediti negativi = aggiunti).
- I crediti aggiunti con la ricarica admin sono **potenzialmente gratis** (non pagati da Lemon): vanno considerati come fattore di calcolo dove si analizzano costi vs crediti erogati (es. report, stime buffer).

## DB (migration 007)

- **`users.last_admin_recharge_at`**: timestamp ultima ricarica (per cooldown 12h).
- **`admin_recharge_pins`**: PIN monouso (user_id, amount, pin_hash, expires_at) per conferma; cancellato dopo uso.
- **`user_credit_gifts`**: (user_id, credits_added, created_at, shown_at) per mostrare la modale “regalo” una sola volta nel plugin.

Eseguire la migration sul DB condiviso (auth/dashboard):

```bash
# Es. Supabase SQL Editor o psql su POSTGRES_URL
psql $POSTGRES_URL -f auth-deploy/migrations/007_admin_recharge.sql
```

## API (dashboard)

- **POST /api/recharge** (solo admin):
  - Body `{ step: 'request', user_id, amount }`: genera PIN, invia email, risponde `{ ok, expires_at }`.
  - Body `{ step: 'confirm', user_id, amount, pin }`: verifica PIN, applica ricarica, risponde `{ ok, credits_total, credits_remaining }`.

## Auth (plugin)

- **GET /api/credits**: se esistono regali non ancora mostrati (`user_credit_gifts` con `shown_at` NULL), la risposta include `gift: { credits_added, created_at }`.
- **POST /api/credit-gift-seen**: imposta `shown_at = NOW()` per i regali non ancora mostrati dell’utente (chiamato alla chiusura della modale nel plugin).
