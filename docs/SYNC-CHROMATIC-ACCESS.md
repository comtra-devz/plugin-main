# Chromatic: accesso al Storybook pubblicato (per Sync)

Verifica a tappeto delle docs Chromatic per capire come un backend terzo (es. Comtra) può leggere le stories da un Storybook hostato su Chromatic (per drift detection / sync).

## Riepilogo

| Scenario | Possibile? | Come |
|----------|------------|------|
| **Storybook Chromatic pubblico** | Sì | Usare il permalink (branch o commit). Il nostro backend può fare GET al permalink e, se Chromatic espone `/index.json` o simile, usarlo per la lista stories. Nessun token necessario. |
| **Storybook Chromatic privato** | No (con le docs attuali) | Accesso solo per collaboratori autenticati (OAuth/email/SSO). Non è documentato nessun "view-only token" o Bearer per l’URL del Storybook pubblicato. Il **project token** è solo per CLI/CI (build & upload). |

Quindi: per integrare un link Chromatic nel plugin Sync, l’unica opzione documentata è che il team imposti la **visibilità del Storybook su pubblico**; poi può incollare il permalink nel nostro campo URL e noi possiamo fare il check e lo scan come per qualsiasi Storybook pubblico.

---

## 1. Visibilità del Storybook pubblicato

- **Default:** Storybook pubblicati su Chromatic sono **privati**. Solo collaboratori che hanno fatto login possono aprirli.
- **Pubblico:** Si può impostare "Storybook visibility" su **public**. In quel caso: "Anyone with a link can access"; non serve login. Il resto (library Chromatic, test, impostazioni, Git, metadata) resta privato.
- Per i **progetti linked** con repo pubblica, lo Storybook pubblicato può essere impostato come pubblico.

Fonte: [Collaborators • Visibility](https://www.chromatic.com/docs/collaborators), [Publish](https://www.chromatic.com/docs/publish).

---

## 2. Permalink

- **Branch (ultimo build):** `https://<branch>--<app-id>.chromatic.com`  
  Es.: `https://main--5dca7f6a6ce19b00201febb7.chromatic.com`
- **Commit:** `https://<git-hash>--<app-id>.chromatic.com`
- Se il progetto è **privato**, i collaboratori devono fare login per vedere il permalink; non è documentato un token in query string o header per accesso “view-only” all’URL.

Fonte: [Permalinks](https://www.chromatic.com/docs/permalinks).

---

## 3. Project token

- Usato per **CLI e CI**: build, upload, publish. Non per “leggere” lo Storybook già pubblicato.
- Variabile: `CHROMATIC_PROJECT_TOKEN` (o flag `-t`).
- Le docs non descrivono un uso del project token per autenticare richieste HTTP al permalink (es. Bearer) o per un’API “lista stories”.

Fonte: [CLI](https://www.chromatic.com/docs/cli), [Quickstart](https://www.chromatic.com/docs/quickstart).

---

## 4. URL pubblicato in CI (diagnostics e webhook)

- **chromatic-diagnostics.json** (flag `--diagnostics-file`): contiene `storybookUrl` e `webUrl`. Utile in CI per sapere l’URL del build appena pubblicato.
- **Custom webhooks**: a ogni aggiornamento di build, Chromatic invia un POST con `build.storybookUrl`, `build.webUrl`, `componentCount`, `specCount`, ecc. Nessun campo “lista nomi stories”; solo l’URL e conteggi.

Quindi: il **team** può ottenere l’URL (diagnostics o webhook), ma se il progetto è privato quell’URL richiede comunque login. Non c’è un token da appendere per il nostro backend.

Fonte: [FAQ get-published-storybook-url-via-ci](https://www.chromatic.com/docs/faq/get-published-storybook-url-via-ci), [Custom webhooks](https://www.chromatic.com/docs/custom-webhooks), [CLI](https://www.chromatic.com/docs/cli) (`--diagnostics-file`).

---

## 5. GraphQL / API pubbliche

- Il CLI comunica con Chromatic via GraphQL (es. exit code `GRAPHQL_ERROR`). Non è documentata un’API GraphQL pubblica per terzi (es. “lista stories con project token”).
- `chromatic.com/graphql` è usato dall’app Chromatic; non c’è documentazione per consumer esterni.

---

## 6. Test-runner e “stories.json” su Chromatic

- Se Chromatic è **privato**: non si può bypassare l’auth; serve build locale per i test.
- Se Chromatic è **pubblico**: si può usare `TARGET_URL=<permalink> yarn test-storybook --stories-json`, quindi l’URL pubblico espone qualcosa di compatibile con `--stories-json` (es. `index.json` o equivalente).

Fonte: [storybookjs/test-runner #83](https://github.com/storybookjs/test-runner/issues/83).

---

## Implicazioni per il plugin Sync

1. **Preset / “qualsiasi link”**:  
   Possiamo accettare un permalink Chromatic (branch o commit) **solo se il progetto ha visibilità pubblica**. Il nostro `sync-check-storybook` e `sync-scan` possono fare GET al permalink e provare `/api/stories`, `/api/components`, `/index.json` come per gli altri Storybook.

2. **Storybook Chromatic privato**:  
   Non c’è modo documentato per il nostro backend di accedere senza che l’utente renda pubblico lo Storybook (o che Chromatic introduca in futuro un token/API per accesso in sola lettura).

3. **Fluent (e altri su Chromatic privato)**:  
   Se l’unico deploy è Chromatic e il progetto resta privato, non possiamo usarlo come preset pubblico; per questo Fluent è stato rimosso dalla lista preset.

4. **Copy in UI**:  
   In SyncTab si può suggerire: per Chromatic, usare il permalink (es. `main--<app-id>.chromatic.com`) e impostare la visibilità del Storybook su “public” se vogliono che il nostro sync funzioni.

---

## Chromatic privato = feature Enterprise (analogo a SSO)

Come per lo **Storybook protetto da SSO**, anche lo **Storybook Chromatic privato** è un caso in cui il backend Comtra non può accedere con un semplice URL + token: Chromatic non espone (oggi) un token o API per la lettura del Storybook pubblicato. Ha quindi senso trattarlo come **funzione Enterprise**, con percorsi analoghi a quelli descritti in `SYNC-ENTERPRISE-SSO.md`.

### Posizionamento

- **Pro/Team:** Chromatic con **visibilità pubblica** → permalink nel plugin, nessun setup extra.
- **Enterprise:** Chromatic **privato** → richiede una delle soluzioni sotto (bridge, export, o futura API/token Chromatic), venduto come funzione Enterprise con assistenza al setup.

### Opzioni analoghe a SSO

| Opzione | Idea | Cosa chiediamo al cliente |
|--------|------|----------------------------|
| **A. Bridge** | Componente in azienda che ha accesso a Chromatic (es. account di servizio che fa login) e espone un endpoint (es. `GET /api/stories`) che Comtra può chiamare. Il bridge, dalla sua rete, può usare sessione/cookie Chromatic o (se in futuro Chromatic lo fornisse) un token di lettura. | Hosting del bridge; un utente/account Chromatic con accesso al progetto; il bridge deve poter ottenere i dati stories (oggi potrebbe richiedere automazione browser se Chromatic non espone API). |
| **B. Export in CI** | Dopo ogni build Chromatic, una job in CI genera l’export delle stories (es. dal repo o dalla build locale) e lo pubblica su un URL raggiungibile da Comtra e protetto da token (Bearer/API key). Comtra chiama quell’URL con il token. Non serve “leggere” Chromatic: l’export viene prodotto a build time. | Job in CI che produce `stories.json` (o formato compatibile) e lo pubblica (S3, server interno con token, ecc.); fornire a Comtra URL + token. Stessa logica dell’opzione B in SYNC-ENTERPRISE-SSO. |
| **C. Token/API Chromatic (futuro)** | Se Chromatic introducesse un “read-only token” per il permalink o un’API “lista stories” con project token, Comtra potrebbe supportarlo direttamente (come per Storybook con Bearer). | Oggi non disponibile; per Enterprise possiamo coinvolgere Chromatic (feedback, feature request) e documentare che, se reso disponibile, lo supporteremo. |

Come per SSO, la **checklist Enterprise** (accesso in lettura, URL raggiungibile, token se richiesto) si applica anche al caso “Chromatic privato”; le opzioni A e B sono sotto controllo del cliente; l’opzione C dipende da Chromatic.

Riferimento: **Sync — SSO e Storybook protetto:** `docs/SYNC-ENTERPRISE-SSO.md`.

---

## Riferimenti doc Chromatic

- [Publish](https://www.chromatic.com/docs/publish)
- [Permalinks](https://www.chromatic.com/docs/permalinks)
- [Collaborators • Visibility](https://www.chromatic.com/docs/collaborators)
- [CLI](https://www.chromatic.com/docs/cli)
- [Custom webhooks](https://www.chromatic.com/docs/custom-webhooks)
- [FAQ: get published Storybook URL via CI](https://www.chromatic.com/docs/faq/get-published-storybook-url-via-ci)
- [FAQ: chromatic-diagnostics.json](https://www.chromatic.com/docs/faq/chromatic-diagnostics)
