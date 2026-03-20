# Migliorie prodotto — Notion, cron, Apify (LinkedIn)

## Cosa fa il sistema

1. **UI admin** — *Content Management → Migliorie prodotto (Notion)*: estrae i link da una pagina o database Notion e genera un report Markdown (`POST /api/notion-product-sources`).
2. **Cron giornaliero** — `GET /api/cron-product-sources` (Vercel, **06:00 UTC**): legge Notion dagli env, estrae i link, arricchisce i post **LinkedIn** con **Apify**, salva il report in Postgres e opzionalmente invia un riepilogo su **Discord**.
3. **Gate 3 giorni**: dopo una run **OK**, le run successive entro 72 ore vengono **saltate** (salvate come `skipped` nel DB). Così il cron può essere giornaliero senza sovraccaricare Notion/Apify.

---

## Checklist: cosa devi fare tu

### 1) Notion

1. **Stesso workspace:** l’integration e le pagine dei link devono stare nello **stesso spazio di lavoro Notion** (stesso account/team).
2. Crea un’[integration interna](https://www.notion.so/my-integrations), copia il **secret** → Vercel: `NOTION_INTEGRATION_TOKEN`.
3. **Collega** l’integration alla pagina o al database delle fonti (menu **Condividi** → connessioni / invito all’integration) con permesso di **lettura**.
4. Copia l’**ID** (UUID) dalla URL della risorsa → **un solo** env tra `NOTION_PRODUCT_SOURCES_PAGE_ID` e `NOTION_PRODUCT_SOURCES_DATABASE_ID` (dettaglio sotto nella guida Notion).
5. Il **cron** legge solo questi env; la UI admin può incollare ID diversi per prove manuali.

### 2) Database Postgres (gate + storico report)

1. Esegui la migration sullo **stesso DB** già usato dalla dashboard (`POSTGRES_URL` / `DATABASE_URL`):
   - File: [`migrations/003_product_sources_cron.sql`](../migrations/003_product_sources_cron.sql)
2. Senza questa tabella il cron **funziona comunque** ma **non** applica il gate 3 giorni (ogni giorno esegue una run completa).

### 3) Apify (LinkedIn)

1. Crea un account [Apify](https://apify.com) e genera un **API token**.
2. Su Vercel: `APIFY_TOKEN=<token>`.
3. Scegli un **Actor** dallo Store che accetti URL di post LinkedIn (es. cerca “LinkedIn post”). Copia l’ID actor nel formato `username~nome-actor` (come in Apify Console).
4. Su Vercel: `APIFY_LINKEDIN_ACTOR_ID=username~nome-actor`.
5. Se l’actor richiede un input diverso dal default, imposta:
   - `APIFY_LINKEDIN_INPUT_MODE=postUrls` *(default)* — body `{ postUrls: [{ url }, ...] }`
   - oppure `urls` — `{ urls: ["...", ...] }`
   - oppure `startUrls` — `{ startUrls: [{ url }, ...] }`  
   Allinea il valore alla documentazione **Input** dell’actor che hai scelto.
6. Opzionale: `PRODUCT_SOURCES_MAX_LINKEDIN_PER_RUN` (default **20**) — massimo numero di URL LinkedIn processati per run.
7. Opzionale: `APIFY_LINKEDIN_WAIT_SECONDS` — secondi di **waitForFinish** verso Apify (default nel codice **300**). Deve essere **inferiore** al tempo massimo della funzione Vercel (vedi sotto) meno il tempo impiegato da Notion/DB.
8. Opzionale: `PRODUCT_SOURCES_SKIP_LINKEDIN=1` — non chiama Apify; i link LinkedIn restano in elenco con messaggio “saltato” (utile per testare Notion/Postgres su piani con timeout bassi).

> Il codice prova a mappare il **dataset** in testo + link; se l’actor restituisce campi con nomi diversi, potresti dover cambiare actor o adattare in seguito i campi in `lib/apify-linkedin.mjs`.

#### Vercel: errore 500 / `FUNCTION_INVOCATION_FAILED` (pagina generica)

Succede spesso quando la funzione viene **terminata dal runtime** prima che risponda (non è un `catch` JavaScript).

- **Causa tipica:** Apify viene chiamato con attesa fino a **300s**; su **Vercel Hobby** le funzioni serverless hanno un limite di circa **10s**. Scade il tempo → crash senza JSON.
- **Cosa fare:**
  1. **Controlla i log** (Vercel → Deployment → Functions → `cron-product-sources`) per conferma (timeout / killed).
  2. **Piano Pro (o superiore):** in [`vercel.json`](../vercel.json) è impostato `maxDuration: 300` per `api/cron-product-sources.mjs` così la run può attendere Apify.
  3. **Piano Hobby / test rapido:** imposta `PRODUCT_SOURCES_SKIP_LINKEDIN=1` **oppure** non configurare `APIFY_TOKEN` (il cron salta l’arrichimento ma dovresti ricevere **JSON** `200` con i link Notion).
  4. **Webhook Discord:** sono accettati sia `https://discord.com/api/webhooks/...` sia `https://discordapp.com/api/webhooks/...`.

### 4) Cron Vercel + secret

1. Su Vercel deve esistere **`CRON_SECRET`** (stesso concetto di `/api/cron-notify-discord`).
2. Il file [`vercel.json`](../vercel.json) include già:
   - `"path": "/api/cron-product-sources"`, `"schedule": "0 6 * * *"` (ogni giorno 06:00 UTC).
3. Test manuale (dal browser o curl, **non** committare il secret):
   ```bash
   curl -sS "https://<tuo-dominio-vercel>/api/cron-product-sources?key=CRON_SECRET"
   ```
4. Forzare una run ignorando il gate 3 giorni (solo debug):
   ```bash
   curl -sS "https://<tuo-dominio-vercel>/api/cron-product-sources?key=CRON_SECRET&force=1"
   ```

### 5) Discord (opzionale)

- `PRODUCT_SOURCES_CRON_WEBHOOK_URL` oppure `DISCORD_PRODUCT_SOURCES_WEBHOOK_URL`  
  URL webhook `https://discord.com/api/webhooks/...` (accettato anche `discordapp.com`)  
  Riceve un embed con statistiche e **anteprima troncata** del Markdown. Il report **completo** è in DB: `product_sources_cron_runs.report_markdown`.

### 6) UI manuale

- Continua a usare **Migliorie prodotto (Notion)** per prove senza aspettare il cron.
- La doppia conferma “Applica su Git” resta **stub** (nessuna modifica automatica al repo).

---

## Guida dettagliata: dove trovare ogni token / ID

Sotto trovi **dove cliccare** e **cosa copiare**. Le variabili vanno aggiunte nel progetto Vercel della **admin-dashboard** (Settings → Environment Variables), salvo dove indicato diversamente.

### Notion — creare l’integration e ottenere `NOTION_INTEGRATION_TOKEN`

Usa lo **stesso account Notion** (e lo **stesso workspace**) dove hai creato le pagine con i link.

1. Apri **[https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)**.
2. Clicca **+ New integration** (o **Crea nuova integrazione**).
3. Compila:
   - **Name:** es. `Comtra fonti prodotto`
   - **Associated workspace:** il workspace corretto (menu a tendina)
   - **Type:** **Internal** (non “Public”)
4. Clicca **Submit** / **Salva**.

Nella pagina dell’integration appena creata:

5. Trova **Internal Integration Secret** (a volte sotto la voce di menu **Secrets** nella barra laterale sinistra dell’integration).
6. Clicca **Show**, poi **Copy** (icona copia).
7. Incolla in Vercel come **`NOTION_INTEGRATION_TOKEN`** (in alternativa il codice accetta anche **`NOTION_TOKEN`**).

**Capabilities (se presenti nella schermata):** attiva la lettura del contenuto, es. **Read content** / **Can read content**. Non servono permessi “utente” o email per questo flusso.

**Se perdi il secret:** Notion non te lo mostra di nuovo in chiaro → usa **Reset** / rigenera secret e aggiorna Vercel.

**Regola d’oro:** anche con pagina “Pubblica sul web”, l’API che usiamo richiede **sempre** questo secret **e** la pagina/database **condivisa** con l’integration (vedi sotto).

---

### Notion — collegare l’integration alla pagina o al database (obbligatorio)

Senza questo passo il token è valido ma le API rispondono **404 / object not found**.

**Cosa condividere**

| Situazione | Cosa aprire in Notion | Cosa condividere |
|------------|------------------------|------------------|
| Link in una pagina normale (titoli, paragrafi, elenchi) | Quella pagina | La **pagina** |
| Link in un **database** (tabella/lista/board) come contenitore principale | Il database a schermo intero | Il **database** (è una pagina con UUID proprio) |

**Procedura (web o app desktop)**

1. Apri la **pagina** o il **database** (clic sul nome nella sidebar così l’URL in alto corrisponde a quella risorsa).
2. In alto a destra: **Share** (Condividi).
3. Aggiungi l’integration in uno di questi modi (dipende dalla lingua/versione Notion):
   - **Add connections** / **Aggiungi connessioni** → nell’elenco scegli il **nome** dell’integration che hai creato;  
   - oppure nel campo invito: digita il nome dell’integration; se non compare, apri il selettore e passa a **Integrations** / **Integrazioni** (non solo persone via email).
4. Conferma. L’integration deve comparire nell’elenco delle connessioni con accesso (tipicamente equivalente a **Can read** / **Può leggere**).

**Errore comune:** l’integration è nel workspace giusto ma la pagina è in un **altro** workspace → sposta la pagina o crea un’integration nel workspace giusto.

---

### Notion — `NOTION_PRODUCT_SOURCES_PAGE_ID` (pagina singola)

Ti serve l’**ID** (32 caratteri esadecimali, spesso dopo l’ultimo `-` del titolo nella URL). Puoi incollarlo **con o senza trattini** (`xxxxxxxx-xxxx-...` o tutto attaccato): il backend lo normalizza.

**Metodo consigliato**

1. Apri la pagina a tutto schermo.
2. **Share** → **Copy link** (Copia link).
3. Incolla il link in Blocco note. Esempi realistici:
   - `https://www.notion.so/Mie-fonti-1a2b3c4d5e6f7890abcd1234567890ab`
   - `https://www.notion.so/Mie-fonti-1a2b3c4d5e6f7890abcd1234567890ab?v=...`
   - `https://www.notion.so/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (solo UUID nel path)
4. L’ID è il gruppo di **32 caratteri** `0-9` e `a-f` (maiuscole o minuscole):
   - nell’URL con titolo, è di solito **dopo l’ultimo trattino** del segmento finale, **prima** di `?`;
   - es.: da `.../Mie-fonti-1a2b3c4d5e6f7890abcd1234567890ab` → `1a2b3c4d5e6f7890abcd1234567890ab`.
5. Copia **solo** quell’ID in Vercel → **`NOTION_PRODUCT_SOURCES_PAGE_ID`**.
6. Lascia **vuoto** `NOTION_PRODUCT_SOURCES_DATABASE_ID` se usi solo questa pagina.

---

### Notion — `NOTION_PRODUCT_SOURCES_DATABASE_ID` (database)

Il database Notion è una **pagina** con un proprio UUID (non confondere con l’ID di una **riga** del database).

1. Nella sidebar, clicca sul **titolo del database** (non su una singola riga) così si apre il DB a tutta larghezza.
2. **Share** → **Copy link** oppure leggi l’URL nella barra del browser.
3. Estrai i **32 caratteri esadecimali** come per la pagina (stessa logica: ultimo segmento significativo prima di `?`).
4. Valore in Vercel → **`NOTION_PRODUCT_SOURCES_DATABASE_ID`**.
5. Lascia **vuoto** `NOTION_PRODUCT_SOURCES_PAGE_ID` se il cron deve usare **solo** il database.

**Cosa legge il codice in modalità database:** tutte le **pagine-riga** del database + le **proprietà** (URL, testo con link, titolo, ecc.), quindi i link possono stare nelle colonne o nel corpo di ogni riga.

---

### Notion — un solo env tra PAGE_ID e DATABASE_ID

Se valorizzi **entrambi** `NOTION_PRODUCT_SOURCES_PAGE_ID` e `NOTION_PRODUCT_SOURCES_DATABASE_ID`, in assenza di ID nel body della richiesta il codice preferisce la **pagina** e ignora il database. Per il cron, imposta **solo uno** dei due env per evitare confusione.

### Vercel — dove mettere le variabili

1. [vercel.com](https://vercel.com) → progetto **comtra-admin-dashboard** (o nome equivalente).
2. **Settings** → **Environment Variables**.
3. Aggiungi nome variabile, valore, ambiente **Production** (e **Preview** se vuoi testare deploy di branch).
4. **Save** → **Redeploy** l’ultimo deploy (o un commit nuovo) così le funzioni serverless leggono i nuovi valori.

`POSTGRES_URL` / `DATABASE_URL` e `ADMIN_SECRET` di solito ci sono già: il cron e Notion/Apify vanno aggiunti nello stesso progetto.

### Postgres — migration `003` e `POSTGRES_URL`

- **Dove sta il connection string:** stesso valore che usi già per la dashboard (Vercel → env `POSTGRES_URL` o `DATABASE_URL`). Non è un “token” separato: è l’URL completo `postgres://user:pass@host:5432/db`.
- **Come eseguire la migration:**
  - **Neon / Supabase / altri:** apri la **SQL console** del provider, incolla il contenuto di [`migrations/003_product_sources_cron.sql`](../migrations/003_product_sources_cron.sql), esegui.
  - **CLI locale:** `psql "$POSTGRES_URL" -f migrations/003_product_sources_cron.sql` (con URL esportato in shell, mai committato).

### Apify — `APIFY_TOKEN`

1. Vai su **[console.apify.com](https://console.apify.com)** → login.
2. **Settings** (ingranaggio utente) oppure **Integrations** → **API tokens**.
3. **Create new token** → copia il token (inizia spesso per caratteri alfanumerici lunghi).
4. Incollalo in Vercel come `APIFY_TOKEN`.

### Apify — `APIFY_LINKEDIN_ACTOR_ID` e input (`APIFY_LINKEDIN_INPUT_MODE`)

1. Vai su **[Apify Store](https://apify.com/store)** e cerca es. `LinkedIn post` (scegli un actor che accetti **URL di singoli post**).
2. Apri la scheda dell’actor → tab **API** o **Input**: lì vedi il formato JSON atteso.
3. **ID actor:**
   - Dalla URL della scheda: spesso `https://apify.com/username/actor-name` → nel codice si usa `username~actor-name` (tilde).
   - Oppure in Console: **Actors** → il nome mostrato di solito è già nel formato `user~actor`.
4. Confronta l’**Input** con le nostre modalità:
   - `postUrls` → `{ "postUrls": [ { "url": "https://..." }, ... ] }`
   - `urls` → `{ "urls": [ "https://...", ... ] }`
   - `startUrls` → `{ "startUrls": [ { "url": "https://..." }, ... ] }`  
   Imposta `APIFY_LINKEDIN_INPUT_MODE` di conseguenza.

**Test rapido:** nella Apify Console, **Try for free** / **Start** con un URL LinkedIn reale; se il run produce un **Dataset** con righe, l’actor è adatto. Poi controlla i **nomi dei campi** nelle righe: se il testo del post non compare nel report, potrebbe servire un actor diverso o un adattamento in `lib/apify-linkedin.mjs`.

### Vercel Cron — `CRON_SECRET`

- Non lo “scarichi” da un sito: è una **stringa segreta che definisci tu** (lungo, casuale), uguale a quella che usi già per `/api/cron-notify-discord` se lo hai già configurato.
- Esempio generazione: password manager “genera password” 32+ caratteri, oppure `openssl rand -hex 32`.
- Valore unico in Vercel: `CRON_SECRET`.
- Vercel, quando invoca i cron, può inviare `Authorization: Bearer <CRON_SECRET>` (dipende dalla config del piano/documentazione aggiornata). Il nostro endpoint accetta anche **`?key=<CRON_SECRET>`** per test manuali e compatibilità.

### Discord — webhook (`PRODUCT_SOURCES_CRON_WEBHOOK_URL` / `DISCORD_PRODUCT_SOURCES_WEBHOOK_URL`)

1. Discord → il **server** dove vuoi i messaggi.
2. **Impostazioni server** → **Integrazioni** → **Webhooks** → **Nuovo webhook**.
3. Scegli canale, nome webhook, **Copia URL webhook**.
4. L’URL deve iniziare con `https://discord.com/api/webhooks/` (o `discordapp.com` reindirizzato).
5. Incollalo in Vercel come `PRODUCT_SOURCES_CRON_WEBHOOK_URL` (o l’alias documentato).

Se non imposti il webhook, il cron funziona comunque: report solo in database (e log Vercel in caso di errori).

### Admin dashboard — login API (per la UI “Migliorie prodotto”)

Per chiamare `POST /api/notion-product-sources` dal browser serve la sessione admin (JWT dopo login + 2FA) oppure, in dev, `VITE_ADMIN_SECRET` allineato a `ADMIN_SECRET` (come da resto della dashboard). Non è un token Notion: è **solo** auth Comtra admin.

---

## API admin (estrazione solo Notion)

`POST /api/notion-product-sources` — auth admin (JWT o secret).

Body: `{ "pageId": "..." }` o `{ "databaseId": "..." }` oppure rely su env come prima.

`Antigravity` è sempre filtrato a livello di blocco (nessun link estratto da quel blocco).

---

## Consultare gli ultimi report (SQL)

```sql
SELECT id, ran_at, status, skipped, link_count, linkedin_urls_attempted,
       notion_mode, notion_source_id, left(report_markdown, 200) AS preview
FROM product_sources_cron_runs
ORDER BY id DESC
LIMIT 10;
```

---

## Non ancora implementato

- Apertura automatica di **branch/PR** sul repo plugin dopo conferma in UI.
- Fetch generico di ogni URL non-LinkedIn (solo lista link nel report).
