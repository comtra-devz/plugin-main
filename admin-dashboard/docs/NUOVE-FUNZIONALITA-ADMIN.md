# Nuove funzionalità Admin Dashboard

## 1. Visione a grafico (Grafici)

- **Route:** `/charts`
- **Contenuto:** KPI cards cliccabili (Utenti, Scan, Costo Kimi, Affiliati) che portano alle rispettive pagine; grafico **dual-line** (Scan + Crediti per giorno) con periodo 7/30/90 giorni, legenda, tooltip e link "Dettaglio crediti →" che apre Crediti e costi con la data evidenziata.
- **Collegamenti dinamici:** Dalla pagina Crediti, se si arriva da Grafici con una data selezionata, viene mostrato un banner e la riga della timeline corrispondente è evidenziata.

## 2. Weekly Updates

- **Route:** `/weekly-updates`
- **Sistema di categorie:** FEAT, FIX, DOCS, CHORE, REFACTOR, SECURITY, STYLE (allineate a conventional commits).
- **Struttura dati:** `WeeklyUpdate`: `id`, `date`, `category`, `title`, `description`, `commitHash?`. Il titolo e la descrizione sono in **linguaggio semplice** (derivabili da commit: subject → title, body → description).
- **Futuro:** Integrazione con GitHub (o altro) per leggere i commit e mapparli/tradurli in linguaggio semplice (es. `feat(audit): add a11y rules` → "Aggiunte regole di accessibilità all'audit").

## 3. Utenti: filtri, search, export

- **Filtri:** Piano (Tutti / FREE / PRO), Iscrizione da (data), Iscrizione a (data). Applicati **sulla pagina corrente** (i dati sono quelli già caricati).
- **Ricerca:** Campo "Cerca (email / nome)" che filtra sulla pagina corrente (email offuscata e nome).
- **Export:** Pulsante "Esporta CSV (visibili)" che scarica un file CSV con gli utenti attualmente visibili (dopo filtri/ricerca). Encoding UTF-8 con BOM per Excel.

## 4. Support Requests

- **Route:** `/support`
- **Placeholder:** Nessun collegamento backend. Tabella con colonne: Stato (TODO / IN_PROGRESS / DONE), Oggetto, Descrizione, Utente, Creato, Aggiornato. Filtro per stato.
- **Futuro:** Collegamento a sistema di ticketing o tabella `support_requests` con API dedicata.

## 5. Security & Logs

- **Route:** `/security`
- **Ideazione a priori:**
  - **Categorie evento:** Login, FailedLogin, RoleChange, ApiKeyUsed, ExportData, ConfigChange, SecurityPatch, AccessRevoked.
  - **Severità:** Info, Warning, Critical.
  - **Categorie di fix (remediation):** SecurityPatch, ConfigChange, AccessRevoke, PasswordReset.
- **Filtri:** Categoria, Severità, Data da, Data a.
- **Placeholder:** Dati statici; in futuro collegamento a log reali (DB, file, servizio).

---

Tutte le pagine usano lo stile BRUTAL (card, tabelle, pulsanti) già introdotto in dashboard.
