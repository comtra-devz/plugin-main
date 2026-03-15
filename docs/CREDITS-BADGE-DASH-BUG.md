# Perché a volte il badge crediti mostrava "—" (e cosa abbiamo fatto)

## Comportamento attuale (dopo il fix)

- **Dopo il login** non si vede più l’app con il badge "—". Viene mostrato uno **skeleton / loader** ("Loading your credits…") finché i crediti non sono arrivati dal server.
- **Retry automatici:** se la prima richiesta fallisce, l’app riprova fino a **5 volte** in totale, con pause di 2s, 3s, 4s, 5s tra un tentativo e l’altro.
- **Solo dopo** che tutti i tentativi sono falliti si mostra l’app con badge "—" e messaggio di errore nel profilo (con "Riprova crediti").

Quindi l’utente non vede più "—" a meno che rete/server non siano davvero indisponibili per tutta la sequenza di retry.

---

## In parole semplici (perché succedeva)

Il badge mostrava **"—"** quando l’app **non aveva mai ricevuto** dal server il numero di crediti (`credits` restava `null`).

Cause tipiche:
- Richiesta lenta o fallita (rete, 503, 401).
- Un solo ritry dopo 3 secondi: se anche quello falliva, si restava con "—".

Ora: più retry con backoff e skeleton fino all’arrivo dei crediti (o al "gave up" dopo 5 tentativi).

---

## Dove nel codice (App.tsx)

- **Fetch crediti:** `fetchCredits()` restituisce `Promise<boolean>` (true se ha impostato i crediti).
- **Retry:** un unico `useEffect` (dipende da `user?.authToken`, `user?.id`) esegue fino a 5 tentativi con delay `[2000, 3000, 4000, 5000]` ms tra un tentativo e l’altro.
- **Stato "gave up":** `creditsLoadGaveUp` viene messo a `true` dopo 5 fallimenti; si resetta al logout.
- **CreditsLoader:** componente skeleton mostrato quando `user && credits === null && !creditsLoadGaveUp`.
- **Render:** dopo il login, se i crediti non ci sono ancora e non si è in gave up → si mostra `<CreditsLoader />` invece del layout principale.

---

## Se l’utente vede ancora "—"

Significa che tutti e 5 i tentativi sono falliti (rete o backend non disponibile). In quel caso:
1. Aprire il **profilo** e usare **"Riprova"** crediti.
2. Ricaricare la pagina del plugin.
3. Verificare che il backend risponda su `GET /api/credits` e che il token sia valido.
