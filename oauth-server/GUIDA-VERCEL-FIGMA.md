# Guida: Vercel KV, dominio comtra.dev, Redirect URL Figma

---

## 1. Creare Vercel KV e collegarlo al progetto

Vercel KV è un database Redis usato dall’OAuth per tenere lo stato del login tra una richiesta e l’altra.

### Passi

1. Apri il **progetto** su [vercel.com](https://vercel.com) (quello dove hai fatto il deploy del plugin).
2. In alto: **Storage** (o nel menu di sinistra).
3. **Create Database** → scegli **KV** (Redis).
4. Nome (es. `comtra-figma-oauth`) → **Create**.
5. Nella schermata del database:
   - Clicca **Connect Project** (o **Connect to Project**).
   - Seleziona il **progetto** del plugin (stesso dove hai deployato).
   - Conferma.
6. Vercel aggiunge da solo le variabili d’ambiente al progetto, ad esempio:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - (e altre legate a KV)

Non devi copiare nulla a mano: una volta collegato il database al progetto, le variabili sono già disponibili per le serverless function.

**Verifica:** Progetto → **Settings** → **Environment Variables**. Dovresti vedere le variabili KV (spesso con prefisso tipo `KV_` o il nome del database).

---

## 2. Collegare il dominio comtra.dev (o sottodominio)

Così il server OAuth risponde su `https://comtra.dev` (o `https://auth.comtra.dev`).

### Opzione A – Usare la root comtra.dev

Se **comtra.dev** non è ancora usato da un altro progetto/sito:

1. Nel progetto Vercel: **Settings** → **Domains**.
2. In **Add** scrivi: `comtra.dev`.
3. Clicca **Add**.
4. Vercel mostra cosa configurare nel DNS (di solito):
   - Tipo **A**: nome `@`, valore l’IP indicato da Vercel (es. `76.76.21.21`), oppure
   - Tipo **CNAME**: nome `@` (se il provider lo permette) o `www`, valore `cname.vercel-dns.com`.
5. Vai dal **provider del dominio** (Registro, Cloudflare, ecc.) → gestione **DNS** per **comtra.dev**.
6. Aggiungi il record che Vercel ti ha indicato (A o CNAME).
7. Attendi qualche minuto (fino a 48 h in casi rari). Su Vercel lo stato del dominio diventerà “Valid” / “Ready”.

Dopo la propagazione, il sito (e le API) saranno raggiungibili su `https://comtra.dev`.

### Opzione B – Usare un sottodominio (es. auth.comtra.dev)

Se **comtra.dev** è già usato per il sito principale:

1. Nel progetto Vercel: **Settings** → **Domains** → **Add**.
2. Inserisci: `auth.comtra.dev`.
3. Vercel ti chiederà un record **CNAME**:
   - Nome: `auth` (oppure `auth.comtra.dev` a seconda del provider).
   - Valore: `cname.vercel-dns.com` (o l’host che Vercel ti mostra).
4. Dal provider del dominio (DNS di **comtra.dev**), aggiungi questo record CNAME.
5. Attendi la propagazione. Su Vercel il dominio risulterà collegato.

In questo caso userai **`https://auth.comtra.dev`** come base (es. per `BASE_URL` e per il Redirect URL in Figma).

### Note

- **BASE_URL:** nelle variabili d’ambiente del progetto Vercel imposta `BASE_URL` uguale al dominio che hai collegato:
  - Solo comtra.dev → `BASE_URL=https://comtra.dev`
  - Sottodominio → `BASE_URL=https://auth.comtra.dev`
- **HTTPS:** Vercel gestisce il certificato in automatico.

---

## 3. Figma → Redirect URL

Il Redirect URL deve essere **esattamente** l’URL a cui Figma reindirizza l’utente dopo il login. Deve coincidere con il dominio collegato su Vercel.

### Passi

1. Vai su [Figma → Developers](https://www.figma.com/developers) → **Your apps**.
2. Apri la tua **OAuth app** (quella con Client ID / Client Secret che usi per Comtra).
3. Menu a sinistra: **OAuth credentials**.
4. Nella sezione **Redirect URLs**:
   - Nel campo “Enter a redirect URL” scrivi **esattamente** uno di questi (a seconda del dominio che hai collegato su Vercel):
     - Se usi **comtra.dev** (root):  
       `https://comtra.dev/auth/figma/callback`
     - Se usi **auth.comtra.dev**:  
       `https://auth.comtra.dev/auth/figma/callback`
   - Clicca **Add**.
5. Salva le modifiche (e assicurati che lo scope **current_user:read** sia ancora selezionato in **OAuth scopes**).

### Controllo

- L’URL deve essere **HTTPS**.
- Niente slash finale: `https://comtra.dev/auth/figma/callback` (non `.../callback/`).
- Deve essere lo stesso dominio che hai impostato in **Vercel → Domains** e in **BASE_URL**.

---

## Riepilogo veloce

| Cosa | Dove | Azione |
|------|------|--------|
| Vercel KV | Vercel → Storage → Create Database → KV → Connect to Project | Collega il DB al progetto; le env KV vengono aggiunte da Vercel. |
| Dominio | Vercel → Settings → Domains → Add | Aggiungi `comtra.dev` o `auth.comtra.dev` e crea il record A/CNAME nel DNS. |
| Redirect URL | Figma → Your app → OAuth credentials → Redirect URLs | Aggiungi `https://comtra.dev/auth/figma/callback` (o `https://auth.comtra.dev/auth/figma/callback`). |

Dopo questi tre punti, ricordati di avere nel progetto Vercel le variabili **FIGMA_CLIENT_ID**, **FIGMA_CLIENT_SECRET** e **BASE_URL** (uguale al dominio che hai collegato).
