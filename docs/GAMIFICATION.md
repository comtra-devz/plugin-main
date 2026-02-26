# Gamification Comtra (XP, livelli, trofei)

Sistema di gamification: **XP** e **livelli** (curva progressiva), **20 trofei** sbloccabili nella Trophy Case. Backend: `auth-deploy` (Postgres, tabelle `users`, `xp_transactions`, `trophies`, `user_trophies`).

---

## XP e livelli

- **Guadagno XP**: ogni azione completata (audit, wireframe, sync, fix, ecc.) assegna XP secondo la mappa nel backend (`XP_BY_ACTION`). Gli XP sono cumulativi a vita.
- **Curva livelli**: L1=0 XP, L2=100, L3=250, L4=500, L5=800, poi formula livello²×20 cumulativo. Il backend espone `current_level`, `total_xp`, `xp_for_next_level`, `xp_for_current_level_start`.
- **Sync**: GET `/api/credits` e risposta di POST `/api/credits/consume` includono i dati livello/XP; il frontend aggiorna lo stato e mostra la barra XP. Se `level_up: true` viene mostrato il modal "Level Up!".

---

## Trofei (Trophy Case)

- **20 trofei** con condizioni definite in DB (`trophies.unlock_condition`). Dopo ogni azione il backend esegue il check e inserisce in `user_trophies` i nuovi sblocchi; la risposta di `consume` può includere `new_trophies: [{ id, name }]`.
- **GET `/api/trophies`**: lista trofei con `unlocked` e `unlocked_at` per l’utente. La Trophy Case in STATS usa questi dati (con fallback locale se l’API non è disponibile).
- **POST `/api/trophies/linkedin-shared`**: da chiamare quando l’utente clicca "ADD TO LINKEDIN" (sblocca SOCIALITE e aggiorna il check trofei).

Condizioni dettagliate (audit count, XP, health score, fix consecutivi, referral, ecc.) sono in `auth-deploy/schema.sql` (seed `trophies`) e in `evaluateTrophyCondition` nel backend.

---

## Da completare / punti aperti

### 1. Reset fix consecutivi (trofeo Golden Standard)

Il trofeo **Golden Standard** si sblocca con **50 fix accettati consecutivi** senza mai scartare un’issue.

- **Comportamento attuale**: quando l’utente **accetta** un fix, il backend riceve `action_type: 'fix_accepted'` e incrementa `consecutive_fixes` e `fixes_accepted_total`. Quando l’utente **scarta** un’issue (Discard / “Non è un errore”), il backend non viene avvisato e `consecutive_fixes` non viene azzerato.
- **Da fare**: nel punto dell’UI in cui l’utente **scarta** un’issue (bottone Discard), chiamare il backend con **`reset_consecutive_fixes: true`** (es. tramite `consumeCredits` con payload che include solo questo flag e nessun consumo crediti, oppure con un endpoint dedicato tipo `POST /api/trophies/reset-consecutive-fixes` che fa solo `UPDATE users SET consecutive_fixes = 0`).
- **Riferimenti nel codice**:
  - **`views/Audit/AuditView.tsx`**: `handleDiscard` (apre il modal feedback), poi quando il feedback è inviato si aggiorna `discardedIds`. Il posto giusto per la chiamata è **dopo la conferma di discard** (es. nel callback che esegue `setDiscardedIds(newDiscarded)` dopo l’invio del feedback).
  - **`views/Audit/components/IssueList.tsx`**: bottone "Discard" che chiama `onDiscard(e, i.id)`; la logica di reset va in AuditView dove è disponibile `consumeCredits`.
  - **`App.tsx`**: `consumeCredits` già accetta `reset_consecutive_fixes?: boolean` nel payload; il backend in `auth-deploy/oauth-server/app.mjs` (POST `/api/credits/consume`) legge `body.reset_consecutive_fixes` e fa `UPDATE users SET consecutive_fixes = 0`. Quindi basta chiamare `consumeCredits({ action_type: 'audit', credits_consumed: 0, reset_consecutive_fixes: true })` (o un payload minimo senza scalare crediti) da AuditView quando l’utente conferma lo scarto.

---

### 2. Token fixes e Bug report (trofei Token Master e Bug Hunter)

- **Token Master** (200 token/variabili corretti via audit): il backend incrementa `token_fixes_total` solo se il frontend invia **`token_fixes_delta: N`** nel body di una chiamata (es. consume o endpoint dedicato). **Da fare**: definire cosa conta come “token corretto” (es. ogni fix che applica una correzione su un token) e, quando l’utente completa quell’azione, inviare `token_fixes_delta` con il numero di token corretti in quel passo.
- **Bug Hunter** (50 segnalazioni bug inviate): il backend incrementa `bug_reports_total` quando riceve **`action_type: 'bug_report'`** in `consume`. **Da fare**: nel punto dell’UI in cui l’utente **invia una segnalazione bug** (modale/form “Segnala bug”), chiamare il backend con `action_type: 'bug_report'` (e `credits_consumed: 0` se non si vogliono scalare crediti per la segnalazione).
- **Riferimenti nel codice**:
  - **Token fixes**: `App.tsx` – `consumeCredits` accetta già `token_fixes_delta?: number`; il backend in `auth-deploy/oauth-server/app.mjs` (POST `/api/credits/consume`) applica `body.token_fixes_delta` su `users.token_fixes_total`. Va collegato dove si applica un fix “a token” (es. in **`views/Audit/AuditView.tsx`** nella path che gestisce Fix/Apply su un’issue legata a token, oppure in un componente che conta i fix per token in un batch).
  - **Bug report**: cercare nel codebase un punto “Segnala bug” / “Report bug” / feedback di errore; lì aggiungere una chiamata a `consumeCredits({ action_type: 'bug_report', credits_consumed: 0 })`. Se non esiste ancora un’UI dedicata, andrà creata (modale o link) e in quel handler chiamare `consumeCredits` con `action_type: 'bug_report'`.
  - Backend: `auth-deploy/oauth-server/app.mjs` – in `XP_BY_ACTION` c’è `bug_report: 5`; in consume si incrementa `bug_reports_total` quando `actionType === 'bug_report'`.
