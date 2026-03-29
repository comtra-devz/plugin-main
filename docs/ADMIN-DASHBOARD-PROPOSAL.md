# Proposta: Admin Dashboard — monitoraggio costi e operatività

Documento di **design** per una dashboard riservata agli admin: cosa monitorare (allineato a [COST-ESTIMATE-DS-AUDIT.md](./COST-ESTIMATE-DS-AUDIT.md)), dove hostarla (stessa repo vs repo separata) e come **non esporre i dati** al pubblico.

---

## 1. Cosa monitorare (scope)

Tutti i dati sotto sono già presenti in **Postgres** (auth-deploy/schema.sql) o derivabili; nessun dato sensibile va mostrato in chiaro (es. email parziali, ID senza necessità).

### 1.1 Utenti e piani

| Metrica | Fonte | Note |
|--------|--------|------|
| Utenti totali | `users` | Conteggio |
| Utenti per piano (FREE / PRO) | `users.plan` | Conteggio per plan |
| PRO per variante (1w, 1m, 6m, 1y) | `users.plan` + `plan_expires_at` / crediti | Derivabile da credits_total (25, 100, 800, 2000; storico 1w anche 20) |
| Nuovi signup (oggi / 7d / 30d) | `users.created_at` | Filtro su data |
| Scadenze PRO imminenti (es. prossimi 7 gg) | `users.plan_expires_at` | Per reminder rinnovi |

### 1.2 Crediti e consumo

| Metrica | Fonte | Note |
|--------|--------|------|
| Crediti consumati per periodo | `credit_transactions` | Somma `credits_consumed` per intervallo |
| Scan/audit per giorno / settimana / mese | `credit_transactions` con `action_type IN ('audit','scan')` | Allineato al doc costi |
| Consumo per tipo azione (audit, generate, sync, …) | `credit_transactions.action_type` | Breakdown |
| Crediti residui medi per segmento (FREE vs PRO) | `users.credits_total`, `credits_used` | Solo aggregate, non per-user in lista dettagliata (opzionale) |

### 1.3 Costi Kimi (DS Audit)

Il doc costi usa **costo medio ~$0.012–0.015/scan**. Non avendo oggi log dei token Kimi in DB, si può:

- **Opzione A (subito):** stimare costo da `credit_transactions`:  
  `SUM(credits_consumed)` per azione audit/scan → numero scan → moltiplicare per costo medio (es. $0.013).  
  Utile per “costo stimato oggi / questo mese”.
- **Opzione B (futuro):** salvare in una tabella `kimi_usage` (o simile) `input_tokens`, `output_tokens` per ogni chiamata a Kimi (DS Audit e altre azioni); la dashboard mostrerebbe costo reale. Specifica dettagliata: **[TOKEN-USAGE-TELEMETRY.md](./TOKEN-USAGE-TELEMETRY.md)** (contatore anonimo, backend → DB/dashboard, invisibile in UI plugin).

Formule dal doc:

- **Cassa minima** = consumo medio giornaliero USD × giorni buffer (es. 30).
- **Consumo giornaliero** ≈ (scan/giorno) × $0.013.

Metriche da mostrare:

| Voce | Calcolo |
|------|---------|
| Scan oggi / 7d / 30d | Count da `credit_transactions` (audit/scan) |
| Costo Kimi stimato (periodo) | Scan × $0.013 (o costo medio configurable) |
| Cassa minima suggerita (30 gg) | (Scan_medio_giorno × 30) × $0.013 |
| Alert se sotto soglia | Configurabile (es. sotto $15 in beta) |

### 1.4 Ricavi e margini (da Lemon Squeezy + doc)

I ricavi effettivi arrivano da **Lemon Squeezy** (webhook `order_created` aggiorna solo `users`; gli importi non sono in nostro DB). Quindi:

- **In dashboard (senza integrazione LS):**  
  - Numero di PRO (e magari distribuzione per “tipo” piano dedotta da `credits_total`).  
  - **Stima ricavo** usando prezzi da [COST-ESTIMATE-DS-AUDIT.md §7.1]: 1w €7, 1m €25, 6m €99, 1y €250 — moltiplicati per numero acquisti stimati (es. nuovi PRO per periodo, se si tiene traccia di “ordini” in una tabella futura).
- **Con integrazione futura:**  
  - Export ordini LS o webhook che scrive in una tabella `orders` (id, user_id, variant_id, amount_cents, created_at) → ricavo reale e margine netto in dashboard.

Per ora la dashboard può mostrare: **utenti PRO**, **stima costi Kimi**, **cassa minima suggerita**; ricavo reale quando ci sarà una fonte dati (LS API o tabella ordini).

### 1.5 Affiliati

| Metrica | Fonte |
|--------|--------|
| Numero affiliati | `affiliates` |
| Referral totali / per periodo | `affiliates.total_referrals` (e eventuale tabella referral_events se aggiunta) |

### 1.6 Funnel (install → signup → FREE attivo → PRO)

- **Signup** = count `users` per `created_at`.
- **FREE “attivi”** = utenti con almeno una riga in `credit_transactions` e plan = FREE.
- **PRO** = count `users` con plan = PRO.

Tassi da calcolare: signup/periodo, % FREE attivi, % PRO. I “visit/install” non sono in nostro DB (dipendono da Figma/analytics esterne); si può lasciare placeholder “Install” e mostrare solo signup → FREE → PRO.

### 1.7 Operatività e salute

- **Webhook Lemon Squeezy:** non c’è log in DB; in futuro si può loggare ogni `order_created` in una tabella per “ultimi ordini processati”.
- **Errori API:** opzionale log errori (es. 5xx) in tabella o tramite Vercel Logs; la dashboard può mostrare “ultime N ore” se avete un sink.
- **Saldo/credito Kimi:** non disponibile via nostro backend; reminder in dashboard tipo “Inserisci saldo attuale” (input manuale) o integrazione futura con provider.

---

## 2. Stessa repo vs repo separata

### 2.1 Stessa repo (plugin-main-1 o auth-deploy)

**Pro:**

- Un solo codice, un solo deploy del backend: le API admin vivono in `auth-deploy` (es. `api/admin/*`).
- La dashboard può essere:
  - **A)** Una SPA in una cartella tipo `admin-dashboard/` (React/Vite) che chiama `https://auth.comtra.dev/api/admin/...`, deployata su Vercel come **secondo progetto** (root = `admin-dashboard`) con dominio tipo `admin.comtra.dev` o `dashboard.comtra.dev`, **solo per voi** (nessun link pubblico nel plugin).
  - **B)** Una sottopath sullo stesso dominio backend, es. `https://auth.comtra.dev/admin` (HTML servito da auth-deploy): meno setup, stesso dominio.
- Segreti e variabili già in Vercel per auth-deploy; eventuale `ADMIN_SECRET` o allowlist in un solo posto.

**Contro:**

- La repo del plugin contiene anche codice “admin”; chi ha accesso alla repo vede che esistono route admin (ma non i dati, che stanno nel DB).
- Se la dashboard è una SPA in sottocartella, il build del plugin e quello della dashboard vanno tenuti distinti (due root Vercel o due cartelle).

### 2.2 Repo separata (es. comtra-admin o comtra-internal)

**Pro:**

- Separazione netta: solo chi ha accesso alla repo admin vede il codice della dashboard.
- Deploy indipendente: aggiornamenti alla dashboard non toccano il plugin né auth-deploy.

**Contro:**

- Due repo da mantenere; le API admin devono comunque vivere da qualche parte. Se le API sono in **auth-deploy** (repo plugin), la “logica” admin resta nella repo principale; la repo separata ha solo il frontend che chiama auth.comtra.dev. Quindi il dato sensibile (chi è admin, quali query) è comunque nel backend della repo principale.
- Duplicazione di configurazione (env, dominio) per il frontend dashboard.

### 2.3 Raccomandazione

- **Backend (API admin):** **nella stessa repo**, sotto **auth-deploy** (es. `auth-deploy/api/admin/stats.mjs`, `auth-deploy/api/admin/health.mjs`). Così tutti i dati restano nel vostro backend e un solo deploy.
- **Frontend dashboard:**  
  - **Se volete massima semplicità e pochi deploy:** stessa repo, cartella `admin-dashboard/` (o `dashboard/`), deploy Vercel con root quella cartella e dominio privato (es. `admin.comtra.dev`). Nessun link dal plugin o dal sito pubblico.  
  - **Se preferite che il codice della UI admin non stia nella repo del plugin:** repo separata solo per il frontend della dashboard, che chiama le API su auth.comtra.dev. Le API restano in auth-deploy (stessa repo del plugin).

In sintesi: **tenere almeno le API admin nella stessa repo (auth-deploy)**; la dashboard può essere nella stessa repo in una sottocartella (consigliato per meno overhead) o in una repo separata se volete isolare il codice UI admin.

---

## 3. Non esporre i dati: sicurezza

- **Nessuna route admin pubblica:** tutte le route sotto `/api/admin/*` devono richiedere autenticazione/autorizzazione.
- **Chi può accedere:** solo admin. Due approcci semplici:
  1. **Token/secret condiviso:** header `Authorization: Bearer <ADMIN_SECRET>` o `X-Admin-Key: <ADMIN_SECRET>`. La variabile `ADMIN_SECRET` (o `ADMIN_API_KEY`) in Vercel, lunga e casuale; solo il frontend della dashboard (e eventualmente script vostri) la conosce.  
  2. **Allowlist Figma user ID:** solo le richieste con JWT di un utente il cui `id` è in una lista (es. `ADMIN_USER_IDS=id1,id2`). Così solo chi fa login con Figma come “voi” può aprire la dashboard (la dashboard fa login Figma e invia il JWT alle API admin).
- **Dati in chiaro:** in lista utenti evitare di mostrare email per intero (es. primi 2 caratteri + @ + dominio); i numeri aggregati (count, somme) non sono PII.
- **HTTPS e dominio:** dashboard servita solo su HTTPS; dominio non indicizzato (no link da sito pubblico, no sitemap).
- **Rate limit (opzionale):** limitare le chiamate a `/api/admin/*` per IP o per token per evitare abusi se il token trapela.

Implementazione minima consigliata: **ADMIN_SECRET** in Vercel; la dashboard (stessa repo in `admin-dashboard/` o repo separata) legge il secret da una env solo in build-time o runtime (es. Vite env) e lo invia in header a ogni richiesta. Non committare il secret; in produzione usate le env di Vercel.

---

## 4. Riepilogo

| Aspetto | Scelta consigliata |
|---------|--------------------|
| **Cosa monitorare** | Utenti, piani, crediti, scan, costo Kimi stimato, cassa minima, affiliati, funnel signup→PRO (vedi §1). |
| **API admin** | Stessa repo, nel **progetto Vercel della dashboard** (`admin-dashboard/api/admin.mjs`), non in auth-deploy (per non consumare il limite 12 function). |
| **Frontend dashboard** | Stessa repo in cartella **admin-dashboard/** (deploy separato su dominio privato) oppure repo separata solo UI. |
| **Sicurezza** | Route `/api/admin/*` protette con **ADMIN_SECRET** (o allowlist Figma ID); nessun link pubblico; dati aggregati/anonymized dove possibile. |

---

## 5. Implementazione (fatto)

- **API admin (progetto dashboard):** una sola serverless function in **admin-dashboard** (`api/admin.mjs`), non su auth-deploy, così auth-deploy resta sotto le 12 function. Endpoint: `GET /api/admin?route=stats|credits-timeline|users|affiliates` (same-origin quando la SPA è deployata sullo stesso progetto).
  Protette con `ADMIN_SECRET` (header `Authorization: Bearer` o `X-Admin-Key`). Nel progetto dashboard: variabili **POSTGRES_URL** (stesso DB di auth-deploy) e **ADMIN_SECRET**.
- **SPA (admin-dashboard/):** Home con KPI e link a pagine interne; pagine **Utenti**, **Crediti e costi** (timeline), **Affiliati**. Vedi `admin-dashboard/README.md` per setup e deploy.
- **Variabili:** nel **progetto Vercel della dashboard** impostare `POSTGRES_URL`, `ADMIN_SECRET`, `VITE_ADMIN_SECRET` (stesso valore). Non serve `VITE_ADMIN_API_URL` in produzione (chiamate same-origin).

Prossimi passi (futuro):

- Tabella `kimi_usage` o log token in ds-audit per costo reale; integrazione Lemon Squeezy per ricavi reali in dashboard.
