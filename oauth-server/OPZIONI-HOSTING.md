# Opzioni hosting OAuth: Vercel KV vs Railway/Render

## Quanto “pesa” il nostro uso di Redis/KV

L’OAuth salva solo:

- **Chiave:** un `flow_id` (stringa ~32 caratteri)
- **Valore:** `null` (in attesa) oppure un oggetto utente (nome, email, img_url, ecc. – poche centinaia di byte)
- **TTL:** 10 minuti (poi la chiave scade)

Quindi: **decine di byte per login**, niente dati grandi. Anche con centinaia di login al giorno resti sotto il megabyte.

---

## Opzione 1 – Restare su Vercel: piano **gratuito** (30 MB)

Per questo uso, **il piano Redis/30 MB gratuito (“One free database per account”) è già più che generoso**.

- Non serve un piano a pagamento.
- 30 MB bastano per tantissimi flow OAuth contemporanei.
- Se in futuro ti servisse più spazio per altro, potresti valutare un upgrade; per il solo OAuth non è necessario.

**Consiglio:** scegli il piano **Redis/30 MB (Free)** e collegalo al progetto. Non devi pagare nulla e hai spazio più che sufficiente.

---

## Opzione 2 – Niente Redis: Railway o Render

Se preferisci **non usare alcun database** (né gratis né a pagamento), puoi hostare il server OAuth su un servizio che fa girare **un unico processo Node** sempre attivo:

- **Railway** (railway.app) – free tier o pochi $/mese
- **Render** (render.com) – free tier per Web Service

In quel caso:

1. Deploy della cartella **oauth-server/** (solo `server.mjs` + `app.mjs` + `package.json` dell’oauth-server, senza `api/` e senza Vercel).
2. **Nessuna** variabile KV: il codice usa già lo **store in memoria** (una `Map`) quando `KV_REST_API_URL` non è impostata.
3. Dominio: colleghi `comtra.dev` (o `auth.comtra.dev`) al servizio scelto invece che a Vercel per questa app.

**Pro:** zero database, zero costi Redis.  
**Contro:** devi gestire un deploy separato dal front/plugin su Vercel (due progetti: uno Vercel per il sito/plugin, uno Railway/Render per OAuth).

---

## Riepilogo

| Scelta | Cosa fare | Costo Redis |
|--------|-----------|-------------|
| **Vercel + “generoso”** | Usa il piano **gratuito 30 MB**; per il nostro OAuth è già abbondante. | €0 |
| **Niente Redis** | Host su Railway o Render; non impostare variabili KV; lo store in memoria è sufficiente. | €0 |

Per “qualcosa di generoso fin dall’inizio” senza spendere: **piano Redis 30 MB gratuito su Vercel** oppure **Railway/Render senza Redis**.
