# Dashboard admin ↔ plugin Figma: architettura e mapping

Documento ufficiale: **non esiste un canale diretto** tra la **Admin Dashboard** (Vercel, browser) e il **plugin Figma**. I due mondi si incontrano solo **indirettamente** tramite lo **stesso database Postgres** (e il backend **auth**, che il plugin chiama via HTTPS).

---

## 1. Tre livelli

```mermaid
flowchart LR
  subgraph figma[Figma]
    UI[Plugin UI iframe]
    CTRL[Controller main thread]
  end
  subgraph auth[Auth backend auth.comtra.dev]
    API[REST API]
  end
  subgraph db[(Postgres)]
    T[(tabelle)]
  end
  subgraph dash[Admin Dashboard]
    SPA[React SPA]
    ADM["/api/admin e altre API Vercel"]
  end
  UI <-->|postMessage pluginMessage| CTRL
  UI -->|HTTPS + Bearer token| API
  API --> T
  SPA -->|HTTPS + admin JWT/secret| ADM
  ADM --> T
```

| Livello | Dove gira | Protocollo verso l’esterno |
|--------|-----------|------------------------------|
| Plugin UI | iframe dentro Figma | `window.parent.postMessage({ pluginMessage: … }, '*')` → **solo** verso il controller dello stesso plugin |
| Controller | main thread Figma | `figma.ui.postMessage(…)` → verso l’iframe; OAuth `figma.openExternal` |
| Auth API | Vercel / server | HTTPS da plugin UI (`AUTH_BACKEND_URL`) |
| Admin Dashboard | browser (dominio dashboard) | HTTPS same-origin verso `/api/admin`, `/api/recharge`, ecc. |
| DB | Supabase/Postgres | Solo dai server auth-deploy e dalle serverless della dashboard |

**Conclusione:** la dashboard **non** può inviare comandi al plugin; il plugin **non** chiama l’URL della dashboard per le funzioni utente. La dashboard legge **telemetria e aggregati** già scritti da auth/plugin.

---

## 2. Messaggi UI → controller (`pluginMessage.type`)

L’iframe (`App.tsx`, `views/…`) invia messaggi che `controller.ts` gestisce in `figma.ui.onmessage`.

| `type` (UI → controller) | Note | Risposta tipica (`figma.ui.postMessage`) |
|---------------------------|------|----------------------------------------|
| `get-saved-user` | Ripristino sessione | `restore-user` |
| `open-oauth-url` | Apre browser OAuth | — |
| `oauth-complete` | Dopo poll OAuth | `login-success` |
| `logout` | Pulisce storage | — |
| `get-file-context` | Serializza file / pageIds / chunk | `file-context-result`, `file-context-chunked-start`, `file-context-chunk` |
| `get-pages` | Lista pagine | `pages-result` |
| `get-flow-starting-points` | Flow starting points pagina corrente | `flow-starting-points-result` |
| `run-proto-audit` | Audit prototipo | `proto-audit-result` |
| `count-nodes` | Conteggio nodi (scope/page) | `count-nodes-progress`, `count-nodes-result`, `count-nodes-error`, … |
| `get-contrast-fix-preview` | Preview fix contrasto | `contrast-fix-preview` |
| `apply-fix` | Applica fix su layer | (effetti su documento) |
| `undo-fix` | Annulla fix | (effetti su documento) |
| `select-layer` | Seleziona nodo in canvas | — |
| `switch-to-page` | Cambia pagina | — |
| `get-design-tokens` | Export token | `design-tokens-result` / `design-tokens-error` |
| `resize-window` | Ridimensiona UI | — |

Messaggi **dal controller verso la UI** (oltre a quelli sopra): `selection-changed`, `restore-user`, `login-success`, ecc. — vedi `controller.ts` (`figma.ui.postMessage`).

---

## 3. Plugin UI → Auth API (dati che finiscono in DB)

Il plugin usa `AUTH_BACKEND_URL` (es. `https://auth.comtra.dev`) per login, crediti, agenti, file Figma, trofei, feedback, supporto, ecc. Le chiamate **scrivono** (o aggiornano) tabelle come:

- `users`, `figma_tokens` (OAuth)
- `credit_transactions` — consumi e azioni (audit, scan, generate, …)
- `kimi_usage_log` — telemetria token (senza `user_id` nel payload aggregato dashboard)
- `generate_ab_requests`, `generate_ab_feedback`
- `support_tickets`, `throttle_events`
- `affiliates`, `xp_transactions`, `user_trophies`, `linkedin_share_events`, `touchpoint_events`, …

Elenco endpoint: **`auth-deploy/oauth-server/app.mjs`** (e moduli collegati).

---

## 4. Dashboard: pagina → API → origine dati (collegamento indiretto al plugin)

Tutte le route `GET /api/admin?route=…` richiedono autenticazione admin (`Authorization: Bearer` o `X-Admin-Key`, vedi `admin-dashboard/README.md`).

| Sezione sidebar | Path | Chiamata principale | Dati (tabelle / origine) | Popolati da |
|-----------------|------|---------------------|---------------------------|-------------|
| Home | `/` | `stats`, `credits-timeline`, `weekly-updates`, `function-executions`, `throttle-events`, `discounts-stats` | `users`, `credit_transactions`, GitHub, … | Plugin + auth + cron |
| Notifiche | `/notifications` | `notifications` | Calcolate lato API (soglie, ticket, …) | DB + logica |
| Utenti | `/users` | `users`, `users-countries`; POST `/api/recharge` | `users` | Registrazione OAuth |
| Crediti e costi | `/credits` | `stats`, `credits-timeline`, `token-usage` | `credit_transactions`, `kimi_usage_log` | Plugin (consumi) + agenti |
| Storico utilizzo | `/executions` | `function-executions`, `executions-users`, `users-countries` | `credit_transactions` (+ join `users`) | Plugin |
| Affiliati | `/affiliates` | `affiliates` | `affiliates` | Plugin/referral |
| Codici sconto | `/discounts` | `discounts-stats`, `discounts-level`, `discounts-throttle` | `user_level_discounts`, `user_throttle_discounts` | Gamification + Lemon |
| A/B tests | `/ab-tests/generate` | `generate-ab-stats` | `generate_ab_*` | Tab Generate |
| Brand awareness | `/brand-awareness` | `brand-awareness` | `linkedin_share_events`, … | Plugin (share) |
| Funnel touchpoint | `/brand-awareness/funnel` | `touchpoint-funnel` | `touchpoint_events`, … | Landing/plugin |
| Aggiornamenti | `/weekly-updates` | `weekly-updates` | GitHub API | Repo |
| Stato servizi | `/health` | `health` | Ping esterni + `SELECT 1` | — |
| Supporto | `/support` | `support-feedback` | `generate_ab_feedback`, `support_tickets`, … | Plugin |
| Sicurezza e log | `/security` | `plugin-logs` | `throttle_events` (derivato) | Plugin/503 |
| Documentation (CMS) | `/content/documentation` | `GET/POST /api/doc-content` | Storage/config dashboard | Admin |
| Migliorie prodotto | `/content/product-improvement` | `POST /api/notion-product-sources`, `GET/POST /api/product-sources-runs` | Notion + tabelle cron | Admin/cron |

---

## 5. Errori in console sul sito dashboard

### `Failed to load resource: 500` su `/api/admin?route=credits-timeline`

- È un errore **solo backend dashboard** (query DB o env mancante).
- Dopo gli aggiornamenti resilienti, la route tende a rispondere **200** con timeline vuota e `kimi_note` esplicativa in caso di fallimento totale (vedi [ADMIN-DASHBOARD-500-E-RIEPILOGO-SEZIONI.md](./ADMIN-DASHBOARD-500-E-RIEPILOGO-SEZIONI.md)).
- Verificare log Vercel del progetto **dashboard** e allineamento migration su `credit_transactions` / `users`.

### `Uncaught (in promise) Error: A listener indicated an asynchronous response…` su path tipo `/content/product-improvement`

- Tipico di **estensioni Chrome** (grammar checker, password manager, analytics, ecc.) che iniettano content script nella pagina.
- **Non** è il plugin Figma e **non** è la comunicazione dashboard↔plugin.
- Prova finestra in incognito senza estensioni o ignora se l’app funziona.

---

## 6. Riferimenti file

| Area | File |
|------|------|
| Route admin | `admin-dashboard/api/admin.mjs` |
| Client DB dashboard | `admin-dashboard/lib/db.mjs` |
| Fetch lato SPA | `admin-dashboard/src/api.ts` |
| Messaggi plugin | `controller.ts`, `App.tsx`, `views/Audit/AuditView.tsx`, `views/Code.tsx` |
| Schema DB | `auth-deploy/schema.sql`, `auth-deploy/migrations/*.sql` |

---

*Ultimo aggiornamento: mapping sezioni e resilienza `credits-timeline` documentati insieme al codice.*
