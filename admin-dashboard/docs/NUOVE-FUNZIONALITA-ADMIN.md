# Nuove funzionalità Admin Dashboard

## 1. Visione a grafico (in Home)

- **Posizione:** sezione "Crediti e scan" nella **Home** (nessuna pagina separata Grafici).
- **Contenuto:** KPI (Scan oggi, 7d, 30d, Crediti consumati) + un unico grafico **dual-line** (Scan + Crediti per giorno) con selettore periodo 7/30/90d, tooltip e link "Timeline e dettagli →" a Crediti e costi. Sotto: consumo per tipo azione e link a Crediti.
- **Collegamenti dinamici:** Dal tooltip del grafico, "Dettaglio crediti →" apre Crediti e costi con la data evidenziata (state `highlightDate`). La route `/charts` reindirizza alla Home.

## 2. Weekly Updates (richiamo in Home)

- **In Home:** sezione "Weekly Updates" con anteprima degli ultimi 3 aggiornamenti (categoria + titolo + data) e **CTA "Tutti gli aggiornamenti →"** che porta alla pagina di approfondimento.
- **Link secondari:** sotto la CTA, link a Support e Security & Logs (pagine di secondo livello, non in sidebar).

## 3. Sidebar: solo primo livello

- **Voci in sidebar:** Home, Utenti, Crediti e costi, Token Kimi, Affiliati.
- **Non in sidebar:** Grafici (contenuto in Home), Weekly Updates (accesso da Home), Support, Security & Logs (accesso da link in Home).

## 4. Weekly Updates (pagina) — aggiornamento automatico

- **Route:** `/weekly-updates`
- **API:** `GET /api/admin?route=weekly-updates` (opzionale `per_page=30`). Non richiede database.
- **Fonte automatica:** se nel progetto Vercel della dashboard sono impostate le variabili d'ambiente:
  - **`GITHUB_REPO`** (obbligatoria): repository in formato `owner/repo` (es. `comtra-devz/plugin-main-1`).
  - **`GITHUB_TOKEN`** (opzionale): token GitHub per rate limit più alto (60 req/h senza token, 5000 con token).
  l'API chiama `GET https://api.github.com/repos/{owner}/{repo}/commits` e mappa i commit in Weekly Updates.
- **Parsing conventional commits:** dal messaggio di commit vengono estratti tipo (feat, fix, docs, chore, refactor, style, security, test, perf, ci, build) → categoria (FEAT, FIX, DOCS, CHORE, …), subject → title, body → description.
- **Fallback:** se `GITHUB_REPO` non è impostata o la richiesta fallisce, l'API restituisce `updates: []`; il frontend usa in quel caso i dati placeholder.
- **Frontend:** Home e pagina Weekly Updates chiamano `fetchWeeklyUpdates()`; in Home vengono mostrati gli ultimi 3, nella pagina tutti con filtro per categoria.

## 5. Utenti: filtri, search, export

- **Filtri:** Piano (Tutti / FREE / PRO), Iscrizione da (data), Iscrizione a (data). Applicati **sulla pagina corrente** (i dati sono quelli già caricati).
- **Ricerca:** Campo "Cerca (email / nome)" che filtra sulla pagina corrente (email offuscata e nome).
- **Export:** Pulsante "Esporta CSV (visibili)" che scarica un file CSV con gli utenti attualmente visibili (dopo filtri/ricerca). Encoding UTF-8 con BOM per Excel.

## 6. Support Requests

- **Route:** `/support`
- **Placeholder:** Nessun collegamento backend. Tabella con colonne: Stato (TODO / IN_PROGRESS / DONE), Oggetto, Descrizione, Utente, Creato, Aggiornato. Filtro per stato.
- **Futuro:** Collegamento a sistema di ticketing o tabella `support_requests` con API dedicata.

## 7. Security & Logs

- **Route:** `/security`
- **Ideazione a priori:**
  - **Categorie evento:** Login, FailedLogin, RoleChange, ApiKeyUsed, ExportData, ConfigChange, SecurityPatch, AccessRevoked.
  - **Severità:** Info, Warning, Critical.
  - **Categorie di fix (remediation):** SecurityPatch, ConfigChange, AccessRevoke, PasswordReset.
- **Filtri:** Categoria, Severità, Data da, Data a.
- **Placeholder:** Dati statici; in futuro collegamento a log reali (DB, file, servizio).

---

Tutte le pagine usano lo stile BRUTAL (card, tabelle, pulsanti) già introdotto in dashboard.

---

## 8. Stato dipendenze (Health / down detector)

- **Badge in Home:** in alto a destra (accanto al titolo "Dashboard") un badge mostra lo **stato globale** delle dipendenze: "Tutto ok" (verde), "Degradato" (giallo), "Problemi" (rosso), "Sconosciuto" (grigio). Click/tap sul badge → pagina **Stato dipendenze** (`/health`).
- **API:** `GET /api/admin?route=health` (con auth admin). Risposta in cache 60 secondi.
- **Check eseguiti:** (1) **Dashboard** — sempre up se l’API risponde; (2) **Database (Postgres)** — `SELECT 1`; (3) **Auth API** — HEAD alla URL configurata (default `https://auth.comtra.dev`); (4) **Vercel** — HEAD a `https://www.vercel.com`. Lo stato globale è: `up` se tutti up, `down` se tutti down, `degraded` se almeno uno down, `unknown` se tutti unknown.
- **Pagina /health:** elenco di tutti i servizi con stato, latenza (ms) e eventuale messaggio; pulsante "Aggiorna" per forzare un nuovo check (rispetto alla cache).
- **Env opzionale:** `AUTH_PUBLIC_URL` — URL base dell’API auth da controllare (default `https://auth.comtra.dev`).
