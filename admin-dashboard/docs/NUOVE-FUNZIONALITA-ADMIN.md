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

## 4. Weekly Updates (pagina)

- **Route:** `/weekly-updates`
- **Sistema di categorie:** FEAT, FIX, DOCS, CHORE, REFACTOR, SECURITY, STYLE (allineate a conventional commits).
- **Struttura dati:** `WeeklyUpdate`: `id`, `date`, `category`, `title`, `description`, `commitHash?`. Il titolo e la descrizione sono in **linguaggio semplice** (derivabili da commit: subject → title, body → description).
- **Futuro:** Integrazione con GitHub (o altro) per leggere i commit e mapparli/tradurli in linguaggio semplice (es. `feat(audit): add a11y rules` → "Aggiunte regole di accessibilità all'audit").

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
