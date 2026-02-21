# Guida completa: sito comtra.dev su hosting separato + OAuth su Vercel (auth.comtra.dev)

Il sito **comtra.dev** resta dove è (hosting attuale). L’OAuth del plugin Figma viene servito da Vercel sul **sottodominio auth.comtra.dev**. In DNS aggiungi **solo** un record per **auth**; non modifichi i record esistenti (MX, A del sito, ecc.).

---

## Parte 1 – Su Vercel: aggiungere il dominio auth.comtra.dev

1. Vai su [vercel.com](https://vercel.com) → apri il **progetto** dove hai deployato il plugin (quello con `api/` e OAuth).
2. **Settings** → **Domains**.
3. Clicca **Add** e scrivi: **`auth.comtra.dev`** (solo il sottodominio, non comtra.dev).
4. Clicca **Add** (o **Continue**).
5. Vercel mostra la schermata **“Configure your DNS”** con una tabella. Di solito per un sottodominio vedi qualcosa tipo:

   | Tipo   | Nome  | Valore / Destinazione     |
   |--------|--------|----------------------------|
   | **CNAME** | `auth` | `cname.vercel-dns.com`     |

   Oppure, in alcuni casi:

   | Tipo | Nome  | Valore / Destinazione |
   |------|--------|------------------------|
   | **A**  | `auth` | `76.76.21.21`          |

6. **Annota** (o tieni aperta la pagina):
   - **Tipo** di record (CNAME o A)
   - **Nome** (di solito `auth`)
   - **Valore / Destinazione** (es. `cname.vercel-dns.com` oppure l’IP se è A)

Questi tre valori li userai nel pannello DNS del tuo provider (OVH).

---

## Parte 2 – Nel pannello DNS (Zona DNS di comtra.dev)

Hai la **Zona DNS di comtra.dev** con i record già presenti (MX per la posta, A per il sito, ecc.). **Non toccare** nessuno di quelli. Aggiungi **solo un nuovo record** per **auth.comtra.dev**.

### Step 1 di 3 – Tipo di record

- Clicca **“Aggiungi un record”**.
- Nella finestra **“Seleziona un tipo di record DNS”** (Step 1 di 3):
  - Se su Vercel hai **CNAME** → scegli **CNAME**.
  - Se su Vercel hai **A** → scegli **A**.
- Clicca **Continua**.

### Step 2 di 3 – Sottodominio e Destinazione

Ti chiederà qualcosa tipo:

- **Sottodominio** (o “Nome”, “Dominio”):  
  Scrivi **`auth`** (solo “auth”, senza “.comtra.dev”). Così il record vale per **auth.comtra.dev**.
- **Destinazione** (obbligatorio):
  - Se hai scelto **CNAME**: incolla **esattamente** il valore che Vercel ti ha dato (es. **`cname.vercel-dns.com`**), senza `https://` e senza slash.
  - Se hai scelto **A**: incolla l’**indirizzo IP** che Vercel ti ha dato (es. `76.76.21.21`).
- **TTL**: puoi lasciare il valore predefinito (es. “Standard” o 3600).

Clicca **Continua**.

### Step 3 di 3 – Conferma

Controlla che tipo, sottodominio e destinazione siano corretti e conferma (Salva / Aggiungi record).

Dopo il salvataggio, **non modificare** i record MX né l’A che punta a `204.69.207.1` (o altro) per il sito: servono per comtra.dev e per la posta. Il nuovo record riguarda **solo auth.comtra.dev**.

---

## Parte 3 – Verificare su Vercel e variabili d’ambiente

1. Torna su **Vercel** → **Settings** → **Domains**. Lo stato di **auth.comtra.dev** può richiedere alcuni minuti (fino a qualche ora) per passare a **Valid** / **Ready** dopo che il DNS si è propagato.
2. Nel progetto Vercel, in **Settings** → **Environment Variables**, verifica:
   - **BASE_URL** = **`https://auth.comtra.dev`**
   - **FIGMA_CLIENT_ID** e **FIGMA_CLIENT_SECRET** impostati
   - Variabili **KV** presenti (se hai collegato Vercel KV)

---

## Parte 4 – Figma: Redirect URL

1. Vai su [Figma → Developers → Your apps](https://www.figma.com/developers/apps) → apri la tua OAuth app.
2. **OAuth credentials** → **Redirect URLs**.
3. Se c’era **comtra.dev**, rimuovilo o non usarlo. Aggiungi **solo**:
   - **`https://auth.comtra.dev/auth/figma/callback`**
4. Salva.

---

## Parte 5 – Build del plugin

Dalla **root del progetto** del plugin (dove c’è `package.json`):

```bash
VITE_AUTH_BACKEND_URL=https://auth.comtra.dev npm run build
```

Così il plugin in produzione chiamerà il server OAuth su **auth.comtra.dev**.

---

## Riepilogo

| Dove | Cosa fare |
|------|-----------|
| **Vercel** | Aggiungi dominio **auth.comtra.dev**; copia **tipo** (CNAME o A), **nome** (auth), **valore/destinazione**. Imposta **BASE_URL** = `https://auth.comtra.dev`. |
| **DNS (OVH)** | **Aggiungi un record** → Step 1: scegli **CNAME** o **A** (come da Vercel) → Step 2: Sottodominio = **auth**, Destinazione = valore Vercel → Step 3: Salva. Non modificare MX né l’A del sito. |
| **Figma** | Redirect URL = **`https://auth.comtra.dev/auth/figma/callback`**. |
| **Plugin** | Build con **`VITE_AUTH_BACKEND_URL=https://auth.comtra.dev`**. |

Il sito **comtra.dev** resta sul tuo hosting attuale; solo **auth.comtra.dev** punta a Vercel per il login Figma.
