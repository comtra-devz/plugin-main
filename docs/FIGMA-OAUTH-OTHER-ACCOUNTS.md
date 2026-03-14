# Perché con altre email / altri account Figma il login non funziona

## Risposta breve

**Il nostro backend non filtra per email.** Qualsiasi utente Figma che arriva al callback viene creato/aggiornato.  
Il blocco avviene **su Figma**, prima che la richiesta raggiunga il nostro server: Figma mostra "OAuth app with client id … doesn't exist" e **non reindirizza** l’utente al nostro callback. Quindi le “altre mail” non funzionano perché **Figma blocca il flusso**, non perché noi le escludiamo.

---

## Flusso passo-passo (dove si rompe)

1. **Plugin** → chiama `GET /api/figma-oauth/init` → riceve `authUrl` + `readKey`.
2. **Plugin** → apre nel browser `authUrl` (es. `https://auth.comtra.dev/auth/figma/start?flow_id=...`).
3. **Nostro server** → risponde con redirect a **Figma**:  
   `https://www.figma.com/oauth?client_id=...&redirect_uri=...&scope=...&state=...&response_type=code`
4. **Figma** → qui l’utente vede la pagina OAuth (consenso app).  
   - Se Figma **accetta** la richiesta (app valida e consentita per quell’account) → l’utente autorizza → Figma reindirizza al **nostro callback** con `?code=...&state=...`.
   - Se Figma **rifiuta** (es. app non approvata per quell’account) → Figma mostra **"OAuth app with client id … doesn't exist"** e **non** reindirizza al callback.
5. **Nostro callback** → viene chiamato **solo** se Figma ha reindirizzato. Qui creiamo/aggiorniamo l’utente (id = Figma user id, email = quella restituita da Figma). **Non c’è nessun controllo sull’email**: qualsiasi utente che arriva viene accettato.

Quindi: se con un account funziona e con un altro no, l’account che “non funziona” **non arriva mai** al passo 5. Il messaggio "doesn't exist" viene mostrato da **Figma** al passo 4.

---

## Perché Figma blocca alcuni account?

Dalla documentazione e dal comportamento tipico di Figma:

- Le **OAuth app pubbliche** devono essere **revisionate e approvate** da Figma prima di poter autenticare **tutti** gli utenti.
- Fino all’approvazione, Figma può permettere l’uso dell’app **solo** a:
  - chi ha creato l’app, o
  - account/organizzazione proprietaria dell’app,
- e rispondere con errori tipo "OAuth app … doesn't exist" per gli altri account.

Quindi: **“app pubblica”** non significa “già approvata”. Se l’app è ancora **in review**, è normale che solo alcuni account (es. il tuo / il team) riescano a fare login e gli altri vedano "doesn't exist".

---

## Come verificare che il problema è Figma e non noi

1. **Log nel callback**  
   Nel callback abbiamo aggiunto un log tipo:  
   `[OAuth] Login completato — questo log appare solo se la richiesta arriva al nostro callback` con `user_id` e `email`.  
   - Fai login con l’**account che funziona** → in Vercel (log della funzione auth) deve comparire questo messaggio.  
   - Prova con l’**altro account** (quello che vede "doesn't exist") → **non** deve comparire nessun log di callback: la richiesta non arriva mai al nostro server.

2. **Check “Figma OAuth – risposta Figma” in Stato servizi**  
   Se il nostro health check che interroga Figma riceve la pagina con "doesn't exist", in dashboard vedrai quel check in **Degradato** con un messaggio che indica che Figma non riconosce l’app. È un’ulteriore prova che il rifiuto è lato Figma.

---

## Cosa fare

- **Nessuna modifica lato nostro** può far funzionare gli altri account finché Figma non accetta la richiesta OAuth per loro.
- **Opzioni:**
  1. **Attendere l’approvazione** dell’OAuth app da parte di Figma (per app pubbliche in review).
  2. **Scrivere al supporto Figma** (developer / app review) e chiedere esplicitamente:  
     - se durante la review l’app è usabile solo dal creatore/team;  
     - se c’è un modo per abilitare altri account (es. whitelist di test) prima dell’approvazione.
  3. Verificare in [Figma Developer](https://www.figma.com/developers/apps) che l’app OAuth sia **pubblicata/approvata** (non solo “in review”) se vuoi che tutti gli utenti possano fare login.

---

## Riepilogo

| Domanda | Risposta |
|--------|----------|
| Il nostro backend blocca alcune email? | **No.** Non c’è whitelist, dominio o filtro su email. |
| Dove avviene il blocco? | Su **Figma**, sulla pagina `figma.com/oauth?client_id=...`, prima del redirect al callback. |
| Perché solo un account funziona? | Perché Figma, finché l’app non è approvata, può permettere l’OAuth solo a chi ha creato l’app / al team. |
| Cosa possiamo fare noi? | Nulla nel codice: dobbiamo aspettare l’approvazione o chiedere a Figma come abilitare altri account in review. |
