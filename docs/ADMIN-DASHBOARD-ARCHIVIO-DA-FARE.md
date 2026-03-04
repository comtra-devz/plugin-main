# Admin dashboard — riferimento archivio e da farsi

Riferimento: ** [archive-repo](https://github.com/comtra-devz/archive-repo)** (branch `claude/reorganize-plugin-archive-68sPK`).  
In locale la stessa struttura è in **`comtra---ai-design-system`** (CommunicationHub → Admin).

---

## 1. Cosa c’è nell’archivio

### 1.1 Login (credenziali test)

- **File:** `CommunicationHub/views/Admin/auth/AdminLogin.tsx`
- **Credenziali:** `u: admin` / `p: admin` (test).
- **Comportamento:** dopo 3 tentativi falliti → schermata “System Locked” (mock).
- **Stile:** card centrale su sfondo `#fdfdfd`, titolo “Admin OS”, badge giallo “Restricted Access”, input con `BRUTAL.input`, pulsante nero “Authenticate”, footer con “Demo Credentials: admin / admin”.

### 1.2 Stile (BRUTAL)

Da `Admin/types.ts`:

```ts
BRUTAL = {
  card: 'bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] p-4 transition-all',
  btn: 'border-2 border-black shadow-[4px_4px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] ... font-bold uppercase tracking-wider px-4 py-2',
  input: 'w-full border-2 border-black p-2 font-mono ... focus:bg-[#ffc900] outline-none',
  label: 'block text-[10px] font-bold uppercase mb-1 text-gray-500',
  tableHeader: '... bg-black text-white',
  tableCell: '... border-r-2 border-black ... text-black'
}
```

- **Colori:** nero `#000`, bianco, rosa `#ff90e8`, giallo `#ffc900`, sfondo `#fdfdfd`, grigio per secondari.
- **Tipografia:** uppercase, font-black per titoli, `text-[10px]` / `text-xs` per label, font-mono per input/code.
- **Card:** bordo 2px nero, ombra `4px 4px 0 #000` (brutal).
- **Pulsanti:** bordo nero, ombra, stato active con translate + ombra ridotta.

### 1.3 Nav attuale (bottom bar)

- **File:** `Admin/components/AdminBottomNav.tsx`
- **Tab:** Dashboard (OVERVIEW), Users, Requests, Security. (Roles si raggiunge dal menu avatar.)
- **Layout:** barra **fissa in basso** con icona + label per ogni tab; tab attiva con `-translate-y-2`, sfondo giallo, icona in box con bordo nero e ombra.
- **Icone:** SVG geometriche (griglia, utenti, lucchetto, busta).

### 1.4 Overview (Dashboard) e grafici

- **File:** `Admin/tabs/AdminOverview.tsx`
- **KPI cards:** griglia 2x2 (md: 4 colonne): Total Users, Active Subs, MRR, Churn Rate. Card con `BRUTAL.card`, una rosa, una nera (testo bianco).
- **Grafico:** dual-line chart **SVG** (Revenue + Conversions per mese):
  - Due linee: nera (Revenue), gialla (Conversions scalata).
  - Tooltip al passaggio del mouse con valore mese, Rev, Conv e variazione % vs mese precedente.
  - Legenda in alto (pallino nero / giallo), labels mesi in basso.
  - Animazione `stroke-dashoffset` all’ingresso.
- **Colonna destra:** “Weekly Updates” con blocchi (versione, titolo, descrizione) e badge (V2.1, FIX, DOCS).

### 1.5 Altre tab

- **AdminUsers:** tabella utenti con filtri (country), stile BRUTAL table.
- **AdminSecurity:** log sicurezza (tipo, IP, data, desc, severity).
- **AdminRequests:** richieste support (status TODO / IN_PROGRESS / DONE).
- **AdminRoles:** gestione ruoli team (Super Admin, Editor, Viewer).

### 1.6 Header e filtri

- Header fisso: titolo pagina (font Tiny5), menu avatar (Super Admin, Manage Roles, Logout).
- Filtri globali: **Country** (dropdown), **Date From / To** (BrutalDatePicker). Nascosti nella tab Roles.

---

## 2. Da farsi (dashboard attuale in `admin-dashboard/`)

### 2.1 Stile

- **Ricalcare** lo stile dell’archivio:
  - Palette: nero, bianco, `#ff90e8`, `#ffc900`, sfondo `#fdfdfd`.
  - Card: `border-2 border-black`, `shadow-[4px_4px_0px_0px_#000]`.
  - Bottoni e input: stessi pattern BRUTAL (bordo nero, focus giallo, uppercase dove appropriato).
  - Tipografia: font-black per numeri KPI, label in uppercase small.
- **Opzionale:** font **Tiny5** per titoli (come in archivio); in alternativa mantenere Space Grotesk con peso bold/black.

### 2.2 Login

- Aggiungere **schermata di login** prima di mostrare la dashboard:
  - Credenziali test: **admin / admin** (solo per dev/test; in prod si può tenere ADMIN_SECRET nelle chiamate API e/o aggiungere check lato server).
  - Layout e copy simili all’archivio: “Admin OS”, “Restricted Access”, campi Admin ID / Password, pulsante “Authenticate”, hint “Demo Credentials: admin / admin”.
  - Opzionale: lock dopo N tentativi (come in archivio) con messaggio “System Locked”.

### 2.3 Nav: da bottom a **sidebar**

- Sostituire la nav orizzontale in alto con una **sidebar fissa a sinistra**:
  - Stesso stile (bordo nero, ombra, voci uppercase).
  - Voci suggerite: **Home** (Overview/KPI), **Utenti**, **Crediti e costi**, **Affiliati** (allineate alle pagine attuali).
  - Eventuale voce **Alert / Operatività** quando si implementa il sistema alert.
  - Icone: riusare o adattare le stesse dell’archivio (griglia, utenti, ecc.) o equivalenti.
- Contenuto principale a destra della sidebar (area scrollabile).

### 2.4 Grafici

- **Riusare l’approccio** dell’archivio (grafici SVG custom con tooltip e animazione):
  - **Home:** KPI cards (già presenti) + almeno un grafico temporale, es. **scan/giorno** o **crediti consumati per giorno** (dati da `credits-timeline`), in stile dual-line o single-line come in AdminOverview.
  - **Crediti e costi:** timeline già presente (barre per giorno) → si può trasformare in linea/area in stile archivio e aggiungere eventuale seconda serie (es. costo stimato USD).
- Nessuna dipendenza pesante: solo SVG + React state per tooltip/hover (come in archivio).

### 2.5 Contenuti “interessanti” da portare

- **KPI cards** in stile archivio (una accent rosa, una nera, resto bianche con bordo nero).
- **Filtri:** se utile, filtri per periodo (From/To) e/o “region” (se un giorno avete dati per paese); per ora si può limitare al periodo (7/30/90 gg) già presente.
- **Tabelle:** stile BRUTAL (header nero testo bianco, celle con bordo nero) per Utenti e Affiliati.
- **Header:** titolo pagina in stile archivio (uppercase, font forte) + eventuale menu utente (logout / info) in alto a destra.

### 2.6 Cosa non riportare (o adattare)

- Tab **Security / Requests / Roles** dell’archivio sono specifiche per quel prodotto (log, richieste support, team). Nella nostra dashboard non abbiamo (per ora) quelle API; restano **Home, Utenti, Crediti e costi, Affiliati**. Se in futuro aggiungete log o ruoli, si può riprendere il pattern.
- **Country filter:** nell’archivio c’è “All World” + lista paesi; noi non abbiamo paese utente in DB. Si omette finché non c’è il dato.

---

## 3. Ordine di lavoro suggerito

1. **Stile globale:** introdurre token BRUTAL (card, btn, input, label, table) e palette in `admin-dashboard` (CSS o Tailwind); applicare a tutte le card e pulsanti esistenti.
2. **Login:** pagina di login admin/admin che, se ok, salva stato (es. `sessionStorage`) e mostra la dashboard; altrimenti mostra form + eventuale lock dopo 3 tentativi.
3. **Sidebar:** layout con sidebar fissa (nav) + area content; spostare le voci attuali (Home, Utenti, Crediti, Affiliati) nella sidebar.
4. **Home:** riformattare KPI in card stile archivio; aggiungere un grafico (timeline scan o crediti) in SVG con tooltip.
5. **Crediti e costi:** eventuale grafico a linea/area oltre (o al posto di) barre; stile coerente.
6. **Tabelle:** uniformare Utenti e Affiliati allo stile tabella BRUTAL (header nero, celle bordate).
7. **(Dopo)** Sistema alert: blocco “Stato operativo” e pagina Alert come da [ADMIN-ALERTS-PROPOSAL.md](./ADMIN-ALERTS-PROPOSAL.md).

---

## 4. Riferimenti file archivio (path locale)

| Cosa | Path (comtra---ai-design-system) |
|------|----------------------------------|
| Login | `CommunicationHub/views/Admin/auth/AdminLogin.tsx` |
| Layout + nav | `CommunicationHub/views/AdminView.tsx`, `Admin/components/AdminBottomNav.tsx` |
| Stile BRUTAL | `CommunicationHub/views/Admin/types.ts` (export BRUTAL) |
| Overview + chart | `CommunicationHub/views/Admin/tabs/AdminOverview.tsx` |
| Tab Users/Security/Requests/Roles | `Admin/tabs/AdminUsers.tsx`, `AdminSecurity.tsx`, `AdminRequests.tsx`, `AdminRoles.tsx` |
| Date picker / Shared | `Admin/components/Shared.tsx` |

Repo GitHub: [comtra-devz/archive-repo](https://github.com/comtra-devz/archive-repo) (branch `claude/reorganize-plugin-archive-68sPK`).

Quando vuoi, si può partire dal punto 1 (stile) e procedere in ordine.
