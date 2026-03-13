# Sync — SSO e Storybook protetto (funzione Enterprise)

Documento per il **piano Enterprise**: supporto allo **Storybook (e in futuro altre sorgenti) protetto da SSO** (Single Sign-On aziendale). Definisce come potremmo risolvere il problema tecnico e **cosa chiediamo al cliente** (requisiti, accesso, setup).

---

## 1. Perché SSO è un caso Enterprise

- **Pro/Team:** Lo Storybook è spesso deployato con URL **pubblico** o con **token/Basic auth**. Il backend Comtra può chiamare l’URL con un token; non serve niente di speciale lato cliente.
- **Enterprise:** Lo Storybook (o il portale che lo serve) è dietro **login aziendale** (Okta, Azure AD, Google Workspace, SAML, ecc.). L’accesso avviene nel browser (cookie/sessione). Il backend Comtra **non** può fare login al posto dell’utente né riusare i cookie di sessione.

Quindi **SSO = scenario tipico Enterprise** (grandi aziende, design system interni, Storybook su dominio aziendale protetto). Trattarlo come **funzione Enterprise** ha senso: richiede setup dedicato e possibilmente un componente lato cliente.

---

## 2. Obiettivo

Permettere al cliente Enterprise di usare **Deep Sync** (Scan drift, Sync Fix/Sync All) anche quando lo Storybook è raggiungibile **solo dopo login SSO**, senza chiedere a Comtra di “simulare” il login (fragile e spesso non consentito dalle policy).

---

## 3. Come potremmo risolverlo

### 3.1 Opzione A — Proxy/Bridge in azienda (raccomandata)

**Idea:** Il cliente installa un **piccolo componente** (proxy/bridge) nella propria rete che:
- è raggiungibile dall’utente (o da Comtra) con un URL stabile;
- **da dietro il firewall** può accedere allo Storybook già protetto da SSO (stesso dominio/rete, o con sessione/cookie che l’utente ha ottenuto una volta);
- espone un endpoint “pulito” (es. `GET /api/stories`) che il backend Comtra può chiamare.

**Flusso:**
1. Il cliente deploya il bridge (es. su un server interno, o su un host raggiungibile da internet con auth token).
2. Un amministratore (o l’utente) fa **una volta** login SSO nel browser verso lo Storybook; il bridge può essere configurato per usare un **token di servizio** emesso dall’IdP (vedi sotto) invece di rubare cookie.
3. In Comtra l’utente inserisce l’**URL del bridge** (es. `https://comtra-bridge.azienda.com`) e opzionalmente un **token di accesso al bridge**.
4. Il backend Comtra chiama `https://comtra-bridge.azienda.com/api/stories` (con token se richiesto). Il bridge, dalla sua rete, interroga lo Storybook e restituisce i dati a Comtra.

**Cosa chiediamo al cliente:**
- Hosting del componente bridge (VM, container, o servizio interno).
- Configurazione rete: il bridge deve poter raggiungere l’URL interno dello Storybook (o l’URL pubblico dopo SSO).
- (Opzionale) Token di servizio o API key per proteggere l’accesso al bridge stesso, da comunicare a Comtra (o all’utente da inserire nel plugin).

**Pro:** Nessun bypass SSO; il cliente resta padrone di accessi e policy.  
**Contro:** Richiede deploy e manutenzione di un componente in azienda.

---

### 3.2 Opzione B — Export periodico con URL + token

**Idea:** Il cliente **non** espone lo Storybook in tempo reale. Una job (CI o script interno) genera periodicamente un **export** (es. JSON con l’elenco storie/componenti) e lo pubblica su un endpoint **raggiungibile da internet** e protetto da **token** (Bearer o API key). Comtra chiama quell’URL con il token.

**Flusso:**
1. In azienda: job (cron/CI) che legge lo Storybook (dalla rete dove è accessibile dopo SSO), genera `stories.json`, lo carica su S3/Blob/URL interno con token.
2. Il cliente fornisce a Comtra (o all’utente) l’**URL dell’export** e il **token**.
3. In Comtra l’utente inserisce URL + token. Il backend scarica l’export e lo usa per il confronto drift.

**Cosa chiediamo al cliente:**
- Setup della job di export (frequenza, formato JSON compatibile con quanto si aspetta Comtra).
- Un URL pubblico (o raggiungibile da Comtra) con protezione a token, dove viene pubblicato l’export.
- Comunicazione del token (o inserimento nel plugin da parte dell’utente).

**Pro:** Nessun componente “bridge” sempre attivo; solo file statici.  
**Contro:** I dati non sono in tempo reale (lag in base alla frequenza dell’export).

---

### 3.3 Opzione C — Token di servizio dall’IdP (se supportato)

**Idea:** Alcuni IdP/SSO permettono di emettere **token di servizio** (service account) o **API token** con scope limitato, da usare in chiamate machine-to-machine. Se lo Storybook (o un gateway davanti) accetta quel token, Comtra potrebbe chiamare direttamente con quel token.

**Flusso:**
1. Il cliente crea un token di servizio (es. da Okta, Azure AD) con scope solo lettura verso lo Storybook o un gateway.
2. Lo Storybook (o un reverse proxy) è configurato per accettare `Authorization: Bearer <token>` per quell’identità.
3. In Comtra l’utente inserisce l’URL dello Storybook (o del gateway) e il token. Il backend Comtra chiama con quel token.

**Cosa chiediamo al cliente:**
- Verifica che l’IdP supporti token di servizio / machine-to-machine.
- Configurazione dello Storybook (o gateway) per accettare quel token invece di (o in aggiunta a) SSO browser.
- Fornitura del token (o suo inserimento nel plugin) con avvertenze su scadenza e rotazione.

**Pro:** Nessun bridge; un solo token da gestire.  
**Contro:** Non tutti gli ambienti Enterprise espongono Storybook con token M2M; dipende dall’IdP e dall’architettura.

---

## 4. Cosa chiediamo al cliente (checklist Enterprise)

Indipendentemente dall’opzione scelta, documentare in offerta/onboarding:

| Richiesta | Descrizione | Opzione |
|-----------|-------------|---------|
| **Accesso in lettura allo Storybook** | Comtra deve poter ottenere l’elenco storie/componenti (es. `GET /api/stories` o equivalente). Se è protetto da SSO browser-only, il cliente deve abilitare una delle vie sopra (bridge, export, token M2M). | A, B, C |
| **URL raggiungibile da Comtra** | L’endpoint usato da Comtra (bridge, export, o Storybook con token) deve essere raggiungibile da internet (backend Comtra su Vercel) a meno di non prevedere Comtra on-premise. | A, B, C |
| **Token o API key (se richiesto)** | Se l’endpoint è protetto, il cliente fornisce un token (o l’utente lo inserisce nel plugin). Policy di rotazione e scope minimi. | A, B, C |
| **Hosting del bridge (solo opzione A)** | VM/container per il componente bridge; requisiti di rete (accesso allo Storybook dalla rete del bridge). | A |
| **Job di export (solo opzione B)** | Definizione frequenza, formato JSON, e dove viene pubblicato l’export (URL + auth). | B |
| **Token di servizio / M2M (solo opzione C)** | Creazione e configurazione token IdP + accettazione da parte di Storybook/gateway. | C |

---

## 5. Posizionamento prodotto

- **Pro/Team:** Supporto Storybook con **URL pubblico** o **token Bearer** (già implementato). Niente SSO.
- **Enterprise:** Supporto **Storybook protetto da SSO** tramite una delle soluzioni sopra (bridge, export, token M2M), con requisiti e checklist documentati. Venduto come **funzione Enterprise** con eventuale assistenza al setup (onboarding, doc, best practice).

---

## 6. Riferimenti

- **Flusso Sync attuale:** `docs/SYNC-INVESTIGATION.md` (flusso utente, casi coperti, token opzionale).
- **Storybook di test:** `storybook-test/README.md`.
