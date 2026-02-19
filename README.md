<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Comtra — AI Design System Plugin

**Comtra** è un plugin Figma con interfaccia web che audita, genera e sincronizza il tuo design system usando l'AI. Ha un'estetica brutalist con palette nero/bianco/rosa (`#ff90e8`)/giallo (`#ffc900`).

View your app in AI Studio: https://ai.studio/apps/drive/1Ceuam5sFVDVY8ya-RGcCr0WDGTjAUGD2

---

## Flusso del Plugin

### 1. Schermata di Login — "Login with Figma"

La prima schermata che l'utente vede è il **LoginModal**, su sfondo rosa pieno (`#ff90e8`).

- **Badge** "Design System AI" in alto, ruotato leggermente
- **Titolo** "Comtra" in font nero uppercase extra-large
- **CTA principale**: pulsante nero con logo Figma multicolore e testo "Login with Figma"
- **Pulsante secondario** in alto a destra: "Go to Website ↗" (porta alla Landing Page)
- **Footer**: link a Terms of Service, menzione GDPR, scritta "Powered by Cordiska"

> Il click su "Login with Figma" autentica l'utente e lo porta direttamente alla schermata principale (AUDIT). Il click su "Go to Website" mostra la Landing Page marketing prima di entrare nel plugin.

---

### 2. Landing Page (opzionale)

Accessibile tramite "Go to Website" dal login o dalla navbar interna. Non richiede autenticazione.

- **Navbar fissa** nera con logo Comtra e pulsante "Use the Figma Plugin" (rosa) per tornare al login
- **Hero** con effetto typewriter: "Stop / Wrestling / Figma" + sottotitolo descrittivo
- **Mockup interattivo** stile browser Mac con skeleton loader
- **Marquee animato**: "Smart Routing • Drift Detection • Semantic HTML • Accessibility Check • Design System Audit • Storybook Sync"
- **3 Feature Cards** (sfondo nero):
  - *Refine, Don't Redraw* — genera wireframe dai tuoi token esistenti
  - *Code that works* — esporta React/Vue/Liquid, sync Storybook
  - *Target: Perfection* — audit per accessibilità, naming, consistenza
- **Sezione "How it works"** con 3 card in stack sticky:
  1. **01 Audit** — Scan your System
  2. **02 Fix** — Auto-Correction
  3. **03 Generate** — Deploy to Code
- **Sezione video** con placeholder tutorial su sfondo giallo
- **Footer** con CTA "Try for Free Now", link Partner/Privacy/Cookies, "Made by Cordiska"

---

### 3. App Principale — Layout Condiviso

Dopo il login, tutte le schermate condividono il layout base:

- **Header sticky** (sfondo rosa): brand "Comtra" + badge "Design System AI" a sinistra; **avatar button** (iniziale utente) a destra che apre il Profile Sheet
- **Main content area** centrata (max-w-md)
- **NavBar fissa in basso** con 4 tab: `AUDIT` | `GENERATE` | `CODE` | `STATS`
  - La tab attiva si solleva con ombra rosa e sfondo nero/testo bianco
  - Le view SUBSCRIPTION, DOCUMENTATION, PRIVACY, TERMS nascondono la NavBar e mostrano un pulsante "Back to Dashboard"

---

### 4. View AUDIT (default dopo login)

La schermata principale del plugin. Mostra un **banner crediti** in giallo rotato con il saldo corrente (es. `Free Credits Remaining: 10/10`).

#### 4 tab di analisi:

**Tab 1 — Design System**

- **Circular Score**: indicatore circolare con punteggio percentuale (es. 78%) del health score del design system
- **Filtro pagine**: dropdown per escludere specifiche pagine Figma dall'analisi
- **Categorie** cliccabili (Tokens, Colors, Typography, Grids, Components...) con punteggio e conteggio problemi
- **Pulsante "Start Scan"**: mostra prima un **Scan Receipt Modal** con:
  - Numero di nodi analizzati (casuale tra 150–550)
  - Costo in crediti (variabile in base ai nodi)
  - Pulsanti "Confirm" / "Cancel"
- **Progress bar animata** durante la scansione con messaggi di loading ciclici
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

Stessa struttura della tab Design System ma con issue di accessibilità (contrasto, alt text, focus states...). Usa **Deep Analysis** con selezione layer:
- Dropdown "Select Layer" per scegliere il layer su cui eseguire l'analisi profonda
- **Pulsante "Deep Scan"**: Scan Receipt Modal, poi analisi in ~1.5s
- Lista issue specifica per l'accessibilità con stesse azioni (Fix/Undo/Discard)

**Tab 3 — UX Audit**

Stessa struttura Deep Analysis per problemi UX (flussi mancanti, micro-interazioni, stati vuoti...).

**Tab 4 — Prototype**

Stessa struttura Deep Analysis per problemi nel prototipo (link rotti, stati mancanti, flussi incompleti...). Alcune issue possono redirigere direttamente a **Generate** (es. "Create a confirmation wireframe for the checkout flow").

---

### 5. View GENERATE

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
- **Post-generazione (con layer selezionato)**: AI Implementation Report con:
  - Check: design system usato, token riutilizzati
  - Checkbox: "Convert new 'Card_Wrapper' div to Component?" (registra il frame come componente in libreria)
  - Azioni: "Back" o "Apply Changes" / "View Component in Figma"

---

### 6. View CODE

Esportazione codice e sincronizzazione con strumenti di sviluppo. 3 tab interne.

**Tab TOKENS**

- **Generate CSS**: genera variabili CSS con token del DS (`:root { --primary, --surface, --border }`) + pulsante copia + indicatore sync
- **Generate JSON**: genera JSON strutturato con token (colori, spacing, border) + pulsante copia + indicatore sync
- **Sync to Storybook / GitHub / Bitbucket** (PRO): invia i token al repository scelto; cooldown 2 min; stato visivo "Synced" / "Out of Sync"

**Tab TARGET**

- **Select Layer**: toggle per scegliere il layer da esportare
- **Language selector**: `REACT` | `VUE` | `CSS` | `LIQUID` | `STORYBOOK`
- **Generate Code**: genera il codice nel linguaggio scelto con timestamp
- **Code block** con copia negli appunti
- **Sync to Storybook** (PRO): invia il componente direttamente a Storybook; mostra timestamp dell'ultimo sync

**Tab SYNC**

- **Sub-tab**: Storybook | GitHub | Bitbucket
- **Connect Storybook**: pulsante di connessione (diventa badge "Connected")
- **Scan for Drift**: rileva divergenze tra Figma e codebase; cooldown 2 min
- **Lista drift** con severity per componente:
  - es. "Primary Button — Padding inconsistency: Figma 12px vs Code 16px"
  - Ogni item espandibile; "Select Layer" per navigare; "Sync" per risolvere singolarmente
- **Sync All**: risolve tutti i drift in una volta, mostra confetti + timestamp
- **Level Up Modal**: appare al completamento di certe azioni (es. sync scan)

---

### 7. View STATS (Analytics)

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

### 8. Profile Sheet (click avatar in header)

Pannello laterale top-right che si apre sopra il contenuto.

- **Header**: email utente + badge piano (es. "FREE PLAN") + saldo crediti (es. `Credits: 23/30`)
- **Become Partner**: pulsante giallo prominente con link esterno `comtra.ai/partner`
- **Voci di menu**:
  - Manage Subscription → view SUBSCRIPTION
  - Affiliate Program → view AFFILIATE
  - Documentation & Help → view DOCUMENTATION
  - Terms & Conditions → view TERMS
  - Privacy & Policy → view PRIVACY
  - Logout (testo rosso) → resetta sessione, torna al LoginModal
- **Footer**: versione plugin (es. `v1.0.7`)

---

### 9. Upgrade Modal

Si apre quando i crediti sono esauriti oppure dalla view Subscription.

**4 piani selezionabili** (default: 6 Months):

| Piano | Prezzo | Limite prompts |
|---|---|---|
| 1 Week | €7 | 20 prompts |
| 1 Month | €25 | 100 prompts/mese |
| 6 Months *(RECOMMENDED)* | €99 | 800 prompts |
| 1 Year | €250 | Illimitati |

- **Promo code**: campo input con suggerimento Discord community
- **"Pay now"**: avvia il checkout via Lemon Squeezy
- "Secure checkout via Lemon Squeezy. Cancel anytime."

---

### 10. View SUBSCRIPTION

Accessibile da Profile Sheet.

- **Current Plan Card**: tipo piano + stato (Active/Limited) + data scadenza (se PRO)
- **Usage Meter**: barra progressione prompt usati/totali (diventa rossa se <10% rimasto)
- **Upgrade Card** (solo FREE, sfondo giallo): lista benefici PRO + CTA "Buy License (from €7)"
- **Cancel Subscription** link

---

### 11. View AFFILIATE

Programma affiliazione con tracking delle commissioni (transazioni PENDING / CLEARED e codice referral personale).

---

## Crediti e Limiti

| Piano | Crediti | Note |
|---|---|---|
| FREE | 10 per tool (Audit / Gen / Code) | Max 30 totali per sessione |
| PRO 1 Week | 20 prompts | — |
| PRO 1 Month | 100 prompts/mese | — |
| PRO 6 Months | 800 prompts | Consigliato |
| PRO 1 Year | Illimitati | Sync senza cooldown |

Costo per operazione:
- **Audit Scan**: 5 crediti base + variabile sui nodi (1 credito ogni 50 nodi oltre 250)
- **Generate**: 3 crediti
- **Code / Sync**: 1 credito (gratis con piano annuale)

---

## Tech Stack

- **React 19** + **TypeScript 5.8**
- **Vite 6** (build tool)
- **Tailwind CSS** (via CDN)
- **@google/genai** — Gemini API per la generazione AI
- **Font**: Space Grotesk + Tiny5 (titoli hero)
- **Platform**: Figma Plugin API + Google AI Studio

---

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

---

## Ambienti disponibili (Launcher)

All'avvio, il `Launcher.tsx` permette di scegliere l'ambiente:

| Env | Descrizione |
|---|---|
| **PROD** | App di produzione |
| **TEST** | Clone con badge "TEST ENV", DebugInspector e dati mock |
| **MASTER** | Vista Master Plan (20 fasi di sviluppo con prompt AI copiabili) |
| **COMM** | Communication Hub (Brand, USP, Competitors, Sustainability, Editorial) |
| **ADMIN** | Admin Dashboard (gestione utenti, ruoli, richieste, sicurezza) |
