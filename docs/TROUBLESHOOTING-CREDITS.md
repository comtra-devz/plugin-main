# Crediti non arrivano / Credits sync failed

Se nel plugin i crediti restano "—" o compare "Credits sync failed", le API in dashboard possono risultare comunque "in salute" perché lo **Stato servizi** verifica solo che `GET /api/credits` risponda **401 senza token** (endpoint raggiungibile), non che le richieste **con token** funzionino.

---

## Cosa controllare

1. **Console del plugin (Figma)**  
   Apri gli strumenti per sviluppatori sul plugin (tasto destro sul iframe del plugin → Ispeziona, oppure Figma → Plugins → Development → Open Console). Cerca messaggi tipo:
   - `[Comtra] GET /api/credits: 503 Service Unavailable` → backend in 503 (es. DB non configurato).
   - `[Comtra] GET /api/credits failed: 401` → token assente o non valido (scaduto / logout da un’altra parte).
   - `[Comtra] GET /api/credits: network or parse error` → richiesta non arriva (rete, CORS, URL sbagliato).

2. **Profilo utente**  
   Se compare "Credits sync failed" con HTTP 401/503/network, usa il pulsante **Riprova** nel profilo per ritentare il fetch crediti senza riaprire il plugin.

3. **Token / sessione**  
   - Fai **Logout** e poi **Login con Figma** di nuovo: il token viene rinnovato e i crediti vengono richiesti di nuovo al primo caricamento.
   - Se il token è scaduto (es. sessione > 30 giorni con `SESSION_DAYS = 30` nel controller), la sessione viene considerata invalida e serve un nuovo login.

4. **URL del backend**  
   Il plugin usa `AUTH_BACKEND_URL` (build: `VITE_AUTH_BACKEND_URL`; default `https://auth.comtra.dev`). Verifica che in produzione il build abbia l’URL corretto e che da browser/Figma si possa raggiungere `https://<auth>/api/credits` (senza token deve dare 401, non timeout).

5. **Backend auth (Vercel)**  
   - Variabili: `POSTGRES_URL` (o `DATABASE_URL`) e `JWT_SECRET` devono essere impostate; senza DB, in alcuni flussi il backend può rispondere 503 o valori di fallback.
   - Rewrite: `GET /api/credits` deve andare a `api/credits-trophies?service=credits` (già in `vercel.json`).
   - Log su Vercel: in caso di 500, nei log della function dovresti vedere `GET /api/credits` + stack trace (es. errore Postgres o `getProductionStats`).

6. **CORS**  
   L’auth accetta qualsiasi `Origin`; se in futuro restringi gli origin, assicurati che l’origin del plugin Figma (es. `https://www.figma.com`) sia consentito, altrimenti il browser blocca la risposta e vedrai errore di rete nel plugin.

---

## Riepilogo flusso

- Plugin (con utente loggato) → `GET ${AUTH_BACKEND_URL}/api/credits` con header `Authorization: Bearer <token>`.
- Backend: estrae `userId` dal JWT; se manca → **401**; altrimenti legge da DB `credits_total`, `credits_used` e risponde con `credits_remaining`, `credits_total`, `credits_used`, ecc.
- Plugin: in caso di 200 aggiorna lo stato crediti; in caso di 401/503/!ok imposta `creditsFetchError` e mostra "Credits sync failed" + pulsante Riprova.

Se dopo logout/login e "Riprova" i crediti non compaiono ancora, controlla i log della function auth su Vercel e la console del plugin per il messaggio esatto ([Comtra] GET /api/credits ...).
