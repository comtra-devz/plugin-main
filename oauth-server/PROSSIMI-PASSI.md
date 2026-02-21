# Prossimi passi – OAuth su Vercel + Redis

Dopo aver creato Vercel KV (piano 30 MB) e collegato il database al progetto:

---

## 1. Variabili d’ambiente su Vercel

Nel progetto Vercel: **Settings** → **Environment Variables**. Verifica che ci siano:

| Variabile | Valore | Note |
|-----------|--------|------|
| `FIGMA_CLIENT_ID` | Il Client ID della tua OAuth app Figma | Dalla console Figma Developers |
| `FIGMA_CLIENT_SECRET` | Il Client Secret della stessa app | Segreto, non condividerlo |
| `BASE_URL` | `https://comtra.dev` | Oppure il dominio che colleghi (es. `https://xxx.vercel.app`) |
| (KV) | Aggiunte da Vercel quando hai collegato il DB | `KV_REST_API_URL`, `KV_REST_API_TOKEN`, ecc. |

Se mancano le prime tre, aggiungile; per KV dovrebbero esserci già dopo il collegamento del database.

---

## 2. Collegare il dominio comtra.dev

- **Settings** → **Domains** → **Add**.
- Inserisci **`comtra.dev`** (o **`auth.comtra.dev`** se preferisci un sottodominio).
- Nel **DNS** del provider del dominio crea il record che Vercel indica (A o CNAME).
- Attendi che su Vercel il dominio risulti **Valid**.

Se usi un sottodominio, imposta **`BASE_URL`** = `https://auth.comtra.dev`.

---

## 3. Redirect URL in Figma

- [Figma → Developers → Your apps](https://www.figma.com/developers/apps) → tua OAuth app.
- **OAuth credentials** → **Redirect URLs** → **Add**.
- Inserisci **esattamente**:  
  **`https://comtra.dev/auth/figma/callback`**  
  (oppure `https://auth.comtra.dev/auth/figma/callback` se usi il sottodominio).
- Salva.

---

## 4. Build del plugin con l’URL di produzione

Dalla **root del progetto** del plugin (dove c’è `package.json`):

```bash
VITE_AUTH_BACKEND_URL=https://comtra.dev npm run build
```

(Oppure `VITE_AUTH_BACKEND_URL=https://auth.comtra.dev` se usi il sottodominio.)

Così il plugin in produzione chiamerà il tuo server OAuth su comtra.dev.

---

## 5. Verifica

1. In Figma: **Plugins** → **Development** → importa/avvia il plugin (dalla cartella con il `manifest.json` e la `dist/` aggiornata).
2. Clicca **Login with Figma**.
3. Si apre il browser → login/consenso Figma → redirect alla pagina **“Torna su Figma”** su comtra.dev.
4. Torna su Figma: la schermata deve mostrare la dashboard con avatar/iniziali.

---

## Checklist rapida

- [ ] Vercel KV creato e collegato al progetto
- [ ] Env: `FIGMA_CLIENT_ID`, `FIGMA_CLIENT_SECRET`, `BASE_URL` (e variabili KV presenti)
- [ ] Dominio `comtra.dev` (o sottodominio) collegato in Vercel e DNS configurato
- [ ] Figma: Redirect URL = `https://comtra.dev/auth/figma/callback`
- [ ] Build plugin: `VITE_AUTH_BACKEND_URL=https://comtra.dev npm run build`
- [ ] Test: Login with Figma → browser → “Torna su Figma” → dashboard in Figma
