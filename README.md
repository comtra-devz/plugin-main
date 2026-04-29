# Comtra — AI Design System Plugin

**Comtra** è un plugin Figma con interfaccia web che audita, genera e sincronizza il tuo design system usando l'AI. Ha un'estetica brutalist con palette nero/bianco/rosa (`#ff90e8`)/giallo (`#ffc900`).

---

## Build, deploy e progetti Vercel

- **Plugin UI (questa repo, root):** in sviluppo `npm run dev`; per Figma **`npm run build`** genera il bundle (es. `dist/ui.html` + asset) che carichi come versione del plugin. Gli utenti dalla Community **non** eseguono npm.
- **Backend auth/API:** cartella **`auth-deploy/`** — su Vercel imposta **Root Directory = `auth-deploy`**. Non deployare l’intera monorepo come un solo progetto se in root esistono altre cartelle `api/` (si sommano le Serverless Functions e sul piano **Hobby** il limite è **12** funzioni per deployment).
- **Admin dashboard:** progetto separato con root **`admin-dashboard/`**.
- **Component gallery (Storybook-like locale):** `component-gallery/` — Vite + React, opzionale per design system UI.

---

## Cosa è “vero” (backend / motore) vs demo in UI

Il plugin parla con **`AUTH_BACKEND_URL`** (es. `https://auth.comtra.dev`). Dove serve un servizio reale:

| Area | Integrazione | Note |
|------|----------------|------|
| **Design System audit** | **Kimi** (Moonshot) sul server | `POST /api/agents/ds-audit` — richiede `KIMI_API_KEY`, prompt `ds-audit-system.md`, token Figma utente per `file_key`. |
| **UX Logic audit** | **Kimi** | `POST /api/agents/ux-audit` — prompt `ux-audit-system.md`. |
| **Accessibility audit** | **Motore deterministico Node** (`a11y-audit-engine.mjs`) | **Non** passa da Kimi: fetch JSON Figma (o `file_json`) + regole (contrasto, touch, focus, alt, …). Richiede DB/token Figma come da endpoint. |
| **Prototype audit** | **Solo plugin (controller Figma)** | Analisi flussi nel file; risultato via `proto-audit-result`. Nessun LLM. |
| **Generate (wireframe / action plan)** | **Kimi** | `POST /api/agents/generate` — il file `services/geminiService.ts` nel client è uno **stub non usato** dal flusso principale; la generazione passa dal backend. |
| **Code → Target (code export)** | **Kimi** | `POST /api/agents/code-gen` — subtree dal plugin + formato. |
| **Deep Sync / drift Storybook** | **Backend** (`sync-scan-engine` + route in `oauth-server/app.mjs`) | Il client chiama `POST /api/agents/sync-scan`. GitHub/Bitbucket possono essere ancora parziali (vedi `docs/SYNC-INVESTIGATION.md`). |
| **Crediti, trofei, OAuth Figma, checkout** | **Backend + Postgres** | `credits-trophies`, `figma-oauth`, webhook Lemon, ecc. |

**Fallback demo in plugin:** in `views/Audit/data.ts` esistono liste **DS_ISSUES** / **A11Y_ISSUES** (e mock UX/Prototype per spec) usate dalla UI **solo finché** non arrivano issue dall’API o per stati iniziali — non sostituiscono il backend in produzione.

**Crediti in UI:** saldo mostrato subito con **cache localStorage** (stesso `userId`, TTL ~15 min) così anche aprendo il plugin in **file Figma diversi** (iframe diversi) si riusa l’ultimo saldo; il refresh usa **`GET /api/credits?lite=1`** (solo saldo/plan/XP/regalo, senza aggregazioni pesanti). Stats + transazioni recenti si caricano entrando in **Stats** (`GET /api/credits` completo).

---

## Flusso del Plugin

### 1. Schermata di Login — "Login with Figma"

La prima schermata che l'utente vede è il **LoginModal**, su sfondo rosa pieno (`#ff90e8`).

- **Badge** "Design System AI" in alto, ruotato leggermente
- **Titolo** "Comtra" in font nero uppercase extra-large
- **CTA principale**: pulsante nero con logo Figma multicolore e testo "Login with Figma"
- **Footer**: link a Terms of Service, menzione GDPR, scritta "Powered by Cordiska"

> Il click su "Login with Figma" autentica l'utente e lo porta direttamente alla schermata principale (AUDIT).

---

### 2. App Principale — Layout Condiviso

Dopo il login, tutte le schermate condividono il layout base:

- **Header sticky** (sfondo rosa): brand "Comtra" + badge "Design System AI" a sinistra; **avatar button** (iniziale utente) a destra che apre il Profile Sheet
- **Main content area** centrata (max-w-md)
- **NavBar fissa in basso** con 4 tab: `AUDIT` | `GENERATE` | `CODE` | `STATS`
  - La tab attiva si solleva con ombra rosa e sfondo nero/testo bianco
  - Le view SUBSCRIPTION, DOCUMENTATION, PRIVACY, TERMS nascondono la NavBar e mostrano un pulsante "Back to Dashboard"

---

### 3. View AUDIT (default dopo login)

La schermata principale del plugin. Mostra un **banner crediti** in giallo rotato con il saldo corrente (es. `Free Credits Remaining: 10/10`).

#### 4 tab di analisi:

**Tab 1 — Design System**

- **Circular Score**: indicatore circolare con punteggio percentuale (es. 78%) del health score del design system
- **Scope scan**: dropdown per scegliere **All Pages**, **Current Selection** o una **pagina singola** del documento
- **Categorie** cliccabili (Tokens, Colors, Typography, Grids, Components...) con punteggio e conteggio problemi
- **Pulsante "Scan Design" / "Scan Again"**:
  - Avvia il **conteggio nodi** (traversata asincrona in batch, senza bloccare l’UI; per file con caricamento dinamico pagine si usa `figma.loadAllPagesAsync()` prima di accedere ai figli)
  - **Progress bar** gialla che riempie il bottone: percentuale reale verso il massimo conteggio (cap 200.000 nodi). Progresso inviato ogni 2.000 nodi per un avanzamento fluido; file più piccoli arrivano al 100% alla fine del conteggio
  - **Timer** sotto la CTA (temporaneo): tempo trascorso in `m:ss` fino al termine del conteggio
  - Al termine: **Scan Receipt Modal** con:
    - **Target** (All Pages / Current Selection / nome pagina)
    - **Nodes** (conteggio, con separatore migliaia)
    - **Size** (Small / Medium / Large / 200k+ in base agli scaglioni)
    - **Complexity** (LOW / STD / HIGH)
    - **TOTAL COST** in crediti (vedi sotto)
    - Pulsanti "Authorize Charge" / "Cancel Operation"
  - Testo sotto la CTA: "No credits will be deducted at this point yet."
- **Conteggio nodi (controller)**:
  - Cap massimo: **200.000 nodi** (`COUNT_CAP` in `constants.ts`). Oltre si ferma e si considera tier **200k+**
  - Batch da 6.000 nodi con yield tra un batch e l’altro; push figli a chunk da 4.000 per nodi con molti figli; nessun blocco del main thread
  - In caso di errore (es. pagina non caricata): `count-nodes-error` + `figma.notify` con messaggio e conteggio raggiunto
- **Lista Issue** (espandibile singolarmente):
  - Severità: `HIGH` (rosso) / `MED` (giallo) / `LOW` (grigio)
  - Layer ID cliccabile per navigare in Figma
  - Suggerimento fix con token path
  - Azioni per ogni issue:
    - **Fix** — Confirmation Modal, applica la correzione, +5 punti al score, confetti
    - **Undo** — reverte la fix (con warning: i crediti non vengono rimborsati)
    - **Discard** — apre Feedback Modal per spiegare perché non è un errore
    - Per issue con deviazioni multiple: navigazione prev/next tra i layer coinvolti
  - Utenti FREE: solo 2 issue visibili, il resto bloccato con CTA upgrade
  - **Fix All (N)**: applica tutti i fix pendenti con conferma e costo aggregato
- **Pulsante Share** (LinkedIn)
- **Success Modal** + confetti quando il punteggio supera soglie (80%, 90%, 100%)

**Tab 2 — Accessibility (A11Y)**

Stessa struttura della tab Design System (scope, receipt, Authorize). Dopo la conferma il backend esegue **`runA11yAudit`** sui dati Figma (nessun LLM). Lista issue (contrasto, touch target, focus, alt, …) con Fix / Undo / Discard.

**Tab 3 — UX Audit**

Scope **Current selection** o **pagina** (no “All Pages”). Dopo conferma: **`POST /api/agents/ux-audit`** (Kimi) e lista issue UX Logic.

**Tab 4 — Prototype**

Multi-select dei **flow starting point** sulla pagina corrente; audit eseguito **nel plugin** (`run-proto-audit`). Alcune issue possono puntare a **Generate** (es. wireframe mancante).

---

### 4. View GENERATE

Generazione AI di wireframe e componenti rispettando il design system corrente.

- **Banner crediti** (giallo)
- **Info Alert**: spiega le 4 modalità di generazione:
  - Nessuna selezione → crea wireframe da zero
  - Layer selezionato → modifica una copia (originale protetto)
  - Screenshot caricato → converte pixel in componenti del tuo DS
  - Link Figma incollato → referenzia un wireframe esistente
- **Selection Card**:
  - *Context Layer*: toggle "Select Layer" / "Clear Selection" (mostra il nome del layer selezionato)
  - *Upload Image*: pulsante dashed per caricare uno screenshot (con anteprima + rimozione)
  - *Design System picker*: dropdown ricercabile con 8 sistemi (Custom, Material Design 3, iOS HIG, Ant Design, Carbon, Bootstrap 5, Salesforce Lightning, Uber Base Web)
- **AI Terminal** (header nero con etichetta "v1.0"):
  - Input rich text con placeholder contestuale
  - Link Figma incollati → convertiti automaticamente in chip visivi (`🔗 Ref: nome`)
- **Pulsante "Create Wireframes" / "Modify Component"**:
  - Disabled se input vuoto o crediti esauriti
  - Badge `-3 Credits` visibile durante la generazione
  - Label "Weaving Magic..." durante il loading
  - Se nessun credito rimasto: "Unlock Unlimited AI" → apre Upgrade Modal
- **Inspiration Chips**: 3 prompt di esempio cliccabili per popolare l'input ("Create a desktop login page", "Create a different version of this component", "Create a mobile cart")
- **Post-generazione**: AI Implementation Report con design system usato, piano azioni (JSON), esito creazione frame su canvas; azioni "Back" e "Apply again on canvas".

---

### 5. View CODE

Esportazione codice e sincronizzazione con strumenti di sviluppo. 3 tab interne.

**Tab TOKENS**

- **Generate CSS** e **Generate JSON**: sempre **gratuiti** per tutti (anche senza PRO). Generano variabili CSS e JSON con i token del file Figma; pulsante copia + indicatore sync.
- **Sync to Storybook / GitHub / Bitbucket** (in Tokens: push token verso repo): disponibile con PRO; costi/cooldown come da piano.

**Tab TARGET**

- **Select Layer**: toggle per scegliere il layer da esportare
- **Language selector**: `REACT` | `VUE` | `CSS` | `LIQUID` | `STORYBOOK`
- **Generate Code**: genera il codice nel linguaggio scelto con timestamp
- **Code block** con copia negli appunti
- **Sync to Storybook** (PRO): invia il componente direttamente a Storybook; mostra timestamp dell'ultimo sync

**Tab SYNC (Deep Sync)**

- **Sblocco:** solo con **PRO** (qualsiasi piano). Il tier FREE non può accedere alla tab Sync.
- **Sub-tab**: Storybook | GitHub | Bitbucket
- **Connect Storybook**: pulsante di connessione (diventa badge "Connected")
- **Scan for Drift**: rileva divergenze tra Figma e codebase; **15 crediti** per scan; cooldown 2 min
- **Lista drift** con severity per componente:
  - es. "Primary Button — Padding inconsistency: Figma 12px vs Code 16px"
  - Ogni item espandibile; "Select Layer" per navigare; "Sync" per risolvere singolarmente
- **Sync All**: risolve tutti i drift in una volta, mostra confetti + timestamp
- **Level Up Modal**: appare al completamento di certe azioni (es. sync scan)

---

### 6. View STATS (Analytics)

Sistema di gamification che traccia l'attività dell'utente.

- **Level Card** (sfondo nero):
  - Rank attuale (es. "Level 7")
  - XP corrente / XP al prossimo livello
  - Formula XP: `(Wireframes generati × 10) + (Audit A11Y+UX+Proto × 5) + (Sync × 20) + (Affiliati × 50)`
  - Progress bar gialla
  - Sconto sul piano annuale: +5% ogni 5 livelli, max 20%
  - Pulsante "Add to LinkedIn" per aggiungere la certificazione al profilo
- **Stats Widget**: metriche aggregate (wireframe generati/modificati, audit effettuati, sync completati, affiliati invitati)
- **Trophy Case**: griglia con 20 badge sbloccabili:

| Badge | Condizione di sblocco |
|---|---|
| Novice Sprout | Primo utilizzo (XP > 0) |
| Solid Rock | 500 XP |
| Iron Frame | 10+ Storybook sync |
| Bronze Auditor | 50+ audit (A11Y + UX) |
| Diamond Partner | 5+ affiliati invitati |
| Silver Surfer | 1000 XP |
| Golden Standard | 2500 XP |
| Platinum Prod | 5000 XP |
| Obsidian Mode | Health Score al 100% |
| Pixel Perfect | 100+ wireframe modificati |
| Token Master | 50+ Storybook sync |
| System Lord | 7500 XP |
| Bug Hunter | 200+ A11Y issue risolti |
| The Fixer | 500+ wireframe generati |
| Speed Demon | 50+ GitHub push |
| Harmonizer | Health Score >90% |
| Socialite | 10+ affiliati |
| Influencer | 25+ affiliati |
| Design Legend | 10.000 XP |
| God Mode | 20.000 XP |

- Badge bloccati appaiono in grigio/grayscale
- Click su un badge apre modale con descrizione + pulsante "Share on LinkedIn"

---

### 7. Profile Sheet (click avatar in header)

Pannello laterale top-right che si apre sopra il contenuto.

- **Header**: email utente + badge piano (es. "FREE PLAN") + saldo crediti (es. `Credits: 23/30`)
- **Become Partner**: pulsante giallo prominente con link esterno `comtra.dev/partner`
- **Voci di menu**:
  - Manage Subscription → view SUBSCRIPTION
  - Affiliate Program → view AFFILIATE
  - Documentation & Help → view DOCUMENTATION
  - Terms & Conditions → view TERMS
  - Privacy & Policy → view PRIVACY
  - Logout (testo rosso) → resetta sessione, torna al LoginModal
- **Footer**: versione plugin (es. `v1.0.7`)

---

### 8. Upgrade Modal

Si apre quando i crediti sono esauriti oppure dalla view Subscription.

**4 piani selezionabili** (default: 6 Months):

| Piano | Prezzo | Crediti / note |
|---|---|---|
| 1 Week | €7 | 25 crediti |
| 1 Month | €25 | 100 crediti/mese |
| 6 Months *(RECOMMENDED)* | €99 | 800 crediti |
| 1 Year | €250 | Illimitati |

- **Codice affiliato (opzionale)**: campo "ENTER CODE" per inserire il codice di un referrer; se presente, il checkout apre l’URL Lemon Squeezy con `?aff=CODICE` e l’attribuzione viene tracciata via webhook.
- **"Pay now"**: apre il checkout Lemon Squeezy (varianti configurate in `constants.ts`: variant ID per 1w / 1m / 6m / 1y).
- "Secure checkout via Lemon Squeezy. Cancel anytime."

---

### 9. View SUBSCRIPTION

Accessibile da Profile Sheet.

- **Current Plan Card**: tipo piano + stato (Active/Limited) + data scadenza (se PRO)
- **Usage Meter**: barra progressione prompt usati/totali (diventa rossa se <10% rimasto)
- **Upgrade Card** (solo FREE, sfondo giallo): lista benefici PRO + CTA "Buy License (from €7)"
- **Cancel Subscription** link

---

### 10. View AFFILIATE

Programma affiliazione integrato con **Lemon Squeezy**.

- **Accesso**: Profilo (avatar) → **Affiliate Program**.
- **Registrazione automatica**: l’utente clicca **"Ottieni il tuo codice affiliato"**; il backend crea una riga in DB con un codice univoco (8 caratteri).
- **Codice e link**: la view mostra il codice personale e il **link da condividere** (checkout con `?aff=CODICE`); pulsante **Copia** per il link.
- **Tracking**: quando un acquirente usa quel link e completa l’acquisto, il webhook Lemon Squeezy (Order created) notifica il backend, che incrementa `total_referrals` per quell’affiliato.
- **Metrica in profilo**: nel profilo utente (Production Metrics / STATS) il contatore **AFFILIATES** mostra il numero di referral attribuiti (letti dal DB al login).

Setup backend e webhook: **[auth-deploy/SETUP.md](auth-deploy/SETUP.md)** (sezione Lemon Squeezy). Documentazione completa affiliazione: **[docs/AFFILIATE.md](docs/AFFILIATE.md)**. Variant ID checkout in **constants.ts** (o env `VITE_LEMON_VARIANT_*`).

---

## Crediti e Limiti

| Piano | Crediti | Note |
|---|---|---|
| FREE | 25 una tantum | Non si resettano; paywall a 0 |
| PRO 1 Week | 25 | — |
| PRO 1 Month | 100/mese | — |
| PRO 6 Months | 800 | Consigliato |
| PRO 1 Year | Illimitati | Sync senza cooldown |

Costo per operazione:
- **Code → Tokens (Generate CSS, Generate JSON):** sempre **gratuiti** per tutti (FREE e PRO), nessun credito e nessun PRO richiesto.
- **Audit Scan**: a **scaglioni** in base al numero di nodi (conteggio fino a max 200.000; oltre = tier 200k+):
  - **Small** (≤500 nodi): 2 crediti
  - **Medium** (≤5.000): 5 crediti
  - **Large** (≤50.000): 8 crediti
  - **200k+** (>50.000 o conteggio fermato a 200k): 11 crediti
- **Generate**: 3 crediti
- **Deep Sync** (tab Sync in Code): **solo PRO** (il tier FREE non può usare Sync). Con PRO: Scan Project **15 crediti**; Sync Fix (singolo) 5 crediti; Sync All N×5 crediti. Con piano annuale: illimitati (nessun cooldown)

---

## Tech Stack

- **React 19** + **TypeScript 5.8**
- **Vite 6** (build tool)
- **Tailwind CSS** (config progetto)
- **AI produzione (audit DS/UX, generate, code-gen):** **Kimi / Moonshot** lato server (`auth-deploy/oauth-server`), non nel webview del plugin
- **@google/genai** — presente in `package.json` per altri percorsi; il file `services/geminiService.ts` è uno **stub** non collegato al flusso Generate principale
- **Font**: Space Grotesk + Tiny5 (titoli hero)
- **Platform**: Figma Plugin API (manifest con `documentAccess: "dynamic-page"`; uso di `loadAllPagesAsync` dove richiesto)

---

## Login con Figma (OAuth)

Il flusso "Login with Figma" usa un server OAuth deployato separatamente (es. auth.comtra.dev). Guida unica: **[docs/OAUTH-FIGMA.md](docs/OAUTH-FIGMA.md)** (setup Vercel, dominio, variabili, verifica con `npm run check-auth`).

---

## DS e Generate — cosa è “fonte di verità” (team)

Per allineare prompt, validator e DS importato senza ambiguità: **[docs/ds-authority.md](docs/ds-authority.md)**. Spec leggere e checklist quando cambia il DS: **[docs/ds-for-generate/README.md](docs/ds-for-generate/README.md)**.

---

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. Per la sola UI plugin: `npm run dev` (variabili come `VITE_*` / backend URL da `constants` o env)
3. Per generazione/audit reali servono anche backend **`auth-deploy`** configurato (vedi `auth-deploy/SETUP.md`) con **Postgres**, **JWT**, **Kimi**, token **Figma OAuth**, ecc.

Build produzione plugin: `npm run build` (output in `dist/`).

