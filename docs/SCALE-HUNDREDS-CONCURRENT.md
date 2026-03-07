# Scalabilità: molte centinaia di utenti in contemporanea

Documento di riferimento per ipotizzare l’uso del plugin da **molte centinaia di utenti concorrenti** (es. 300–500+ richieste attive nello stesso momento).

---

## 0. Prima release – utenti registrati e circoscritti (tutto su free tier)

Per una **prima release** con utenti registrati e **circoscritti** (decine / poche centinaia, non migliaia in contemporanea) si può restare su **piani free** di Supabase, Vercel e Redis. Dopo un periodo di assestamento è probabile passare a **Vercel Pro** se servono più function, timeout più lunghi o osservabilità migliore.

### Cosa tenere su free

| Servizio | Piano | Sufficiente per prima release? | Note |
|----------|--------|--------------------------------|------|
| **Supabase** | Free (Nano) | Sì | 500 MB DB, 50K MAU, ~200 connessioni pooler. Con **POSTGRES_URL = URL pooler** (porta 6543) stai tranquillo per decine di utenti attivi in parallelo. |
| **Vercel** | Hobby | Sì, se ≤12 function | Limite **12 serverless function**. Oggi ne avete 13 → consolidare (es. 3 agent → 1) per restare sotto. Burst 1000 concorrenti/10s; per utenti circoscritti non è un problema. |
| **Redis** | Free (es. Vercel KV / Upstash) | Sì | Usato **solo per lo stato OAuth** (flow login: chiavi temporanee durante redirect Figma). Volume bassissimo; nessun upgrade necessario per la prima release. |

### Quando considerare Vercel Pro (dopo l’assestamento)

- Servono **più di 12** serverless function senza consolidare tutto in poche route.
- Servono **timeout** oltre 300 s (Pro fino a 800 s per function).
- Servono **log / analytics** più granulari, password protection per preview, o altre feature Pro.
- Il traffico cresce e vuoi **osservabilità** migliore prima di introdurre rate limiting o code.

Supabase free e Redis free possono restare anche in fase di assestamento; il primo upgrade sensato è spesso **Vercel Pro**.

---

## 1. Cosa non cambia (o cambia poco)

- **Consolidamento serverless (es. 3 agent → 1)**: impatto sulle performance è trascurabile. A scale alte conta il **carico** (DB, API esterne), non il numero di file in `api/`.
- **Dashboard admin**: progetto Vercel separato; non pesa su auth-deploy.
- **Redis (OAuth)**: adatto a picchi di lettura/scrittura; non è il collo di bottiglia.

---

## 2. Colli di bottiglia e cosa fare

### 2.1 Database (Postgres / Supabase)

**Situazione attuale:** `auth-deploy/oauth-server/db.mjs` usa `postgres(URL, { max: 1 })`. Ogni invocazione serverless può aprire 1 connessione. Con N richieste concorrenti → fino a N connessioni.

**Limiti Supabase (riferimento):**
- **Free (Nano):** ~200 connessioni **pooler** (Supavisor), ~60 dirette.
- Se usi l’URL **direct** (porta 5432), le connessioni sono limitate (es. 60) → con 100+ concorrenti rischi “too many connections”.
- Con **pooler** (porta 6543, connection string “pooler”) le 200 connessioni sono condivise; quindi **è essenziale usare l’URL del pooler** in produzione.

**Cosa fare:**
- In Vercel (auth-deploy): **POSTGRES_URL** (o **DATABASE_URL**) deve puntare al **connection pooler** Supabase (es. `...@db.xxx.supabase.co:6543/postgres?pgbouncer=true` o il formato consigliato da Supabase per serverless).
- Per “molte centinaia” di concorrenti (es. >200 attivi sul DB): valutare piano Supabase a pagamento (più connessioni pooler) o ridurre il tempo di vita delle connessioni / ottimizzare le query.
- Mantenere `max: 1` per istanza è corretto con il pooler: il pooler gestisce il multiplexing.

---

### 2.2 Vercel: burst concurrency

**Limiti rilevanti:**
- Scala orizzontale fino a **30k concurrent executions** (Hobby/Pro).
- **Burst:** **1.000 esecuzioni concorrenti per 10 secondi per region**. Superato il burst → risposta **503 FUNCTION_THROTTLED**.

Quindi: se in una finestra di 10 secondi parti da 0 e arrivi a “molte centinaia” (es. 500–800), di solito sei ancora sotto 1000. Se invece in 10 secondi superi 1000 richieste attive contemporaneamente (es. picco da evento o da molti utenti che lanciano audit insieme), Vercel può restituire 503.

**Cosa fare:**
- **Rate limiting lato API** (per user o per IP): riduce i picchi e protegge da abuso. Es.: Redis o DB per contare richieste per `user_id` (o IP) per finestra (es. 1 minuto); oltre N richieste → 429 con `Retry-After`.
- **Backoff nel plugin**: su 503/429, retry con backoff esponenziale e messaggio “Troppo traffico, riprova tra poco”.
- **Piano Pro**: non rimuove il limite di burst, ma offre più strumenti (log, analytics) per capire i picchi.

---

### 2.3 API esterne: Figma e Kimi (LLM)

- **Figma:** limiti dipendono dal tier dell’app (es. richieste/minuto per app). Con centinaia di utenti che fanno file/content in parallelo si può avvicinare il limite. **Mitigazioni:** cache dove possibile (es. file già scaricati per `file_key` + version); in futuro eventuale coda o throttling per tipo di operazione.
- **Kimi (Moonshot):** rate limit e costo per token. Con molti audit/generate in parallelo si possono avere 429 o timeout. **Mitigazioni:** retry con backoff; eventuale coda lato backend (es. “max N audit concorrenti per tenant”) se i limiti del provider sono stringenti.

Non serve cambiare subito architettura; conviene **monitorare** 429/timeout da Figma e Kimi e poi introdurre code o limiti per utente se necessario.

---

## 3. Riepilogo azioni consigliate

| Area              | Azione prioritaria                                      | Quando |
|-------------------|---------------------------------------------------------|--------|
| DB                | Usare **sempre** URL **pooler** Supabase in produzione | Subito |
| DB                | Verificare numero connessioni in uso (Supabase dashboard)| Prima del picco |
| Vercel            | Rate limiting per user/IP (opzionale ma utile)         | Prima di scale alte |
| Plugin            | Gestione 503/429 con retry e messaggio utente           | Utile subito |
| Figma / Kimi      | Monitorare 429 e timeout; eventuale coda/throttle      | Quando i numeri crescono |

---

## 4. Consolidamento function e scale

Ridurre il numero di serverless function (es. da 13 a 12) **non peggiora** la capacità di gestire molte centinaia di utenti: il limite è **burst Vercel**, **connessioni DB** e **API esterne**. Il consolidamento serve a rispettare il limite delle 12 function (Hobby) e semplifica la codebase.
