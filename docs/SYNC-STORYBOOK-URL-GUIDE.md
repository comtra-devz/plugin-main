# Guida: come esporre l’API Storybook per Comtra Sync

Comtra Sync ha bisogno di **leggere** l’elenco di componenti/storie dal tuo Storybook. Per farlo, il tuo URL Storybook deve esporre uno degli endpoint descritti sotto. **Non chiediamo nulla di strano:** è lo stesso URL che usi per aprire Storybook nel browser; l’unica cosa che può mancare è un endpoint “macchina” che restituisce i metadati in JSON.

Questa guida spiega **cosa serve** e **come ottenerlo** in modo che qualsiasi team possa ricavare un link utilizzabile senza sforzo.

**Come sono fatti di solito gli ambienti Storybook:** si esegue `storybook build` e si deploya la cartella `storybook-static/` (Vercel, Netlify, Chromatic). Il build genera già **index.json** nella root; un deploy normale espone quindi **GET /index.json** e Comtra può usarlo. L’URL con cui apri lo Storybook in browser risponde anche a `/index.json`.

**Esempio di URL pubblico per test (funziona subito):** [Carbon Design System – React](https://react.carbondesignsystem.com) — `https://react.carbondesignsystem.com`. Espone `/index.json`; puoi usarlo in Comtra senza deployare nulla.

---

## 1. Cosa deve fare l’URL

Comtra prova, in ordine, questi endpoint sull’URL base che inserisci (non esiste uno standard unico, quindi proviamo più varianti):

| Endpoint | Descrizione |
|----------|-------------|
| **GET /api/stories** | storybook-api (npm), server custom. |
| **GET /api/components** | storybook-api. |
| **GET /index.json** | Build statici Storybook, Chromatic, GitHub Pages, ecc. |
| **GET /stories.json** | Alcuni generatori / setup custom. |
| **GET /storybook/index.json** | Export in subpath. |
| **GET /api/storybook/stories** | Varianti API. |

L’URL base è quello che usi in browser (es. `https://design-system.vercel.app`); query e hash (es. `?path=/docs/...`) vengono ignorati. Accettiamo più strutture JSON: `stories[]`, `components[]`, `entries{}`, oggetto con `v2.entries`, array alla root.

---

## 2. Formato JSON atteso

### Per `/api/stories`

```json
{
  "stories": [
    { "component": "Button", "title": "Components/Button", "id": "components-button--primary" },
    { "component": "Input", "title": "Components/Input", "id": "components-input--default" }
  ]
}
```

- `stories`: array di oggetti.
- Ogni oggetto deve avere almeno uno tra: `component`, `title`, `name`, `id` (stringhe) in modo che si possa ricavare il nome del componente.

### Per `/api/components`

```json
{
  "components": [
    { "name": "Button", "id": "button" },
    { "name": "Input", "id": "input" }
  ]
}
```

- `components`: array di oggetti con almeno `name`, `id` o `title` (stringhe).

### Per `/index.json`

Formati comuni che accettiamo: oggetto con `entries`, oppure array di storie. Se la struttura è diversa ma contiene nomi di componenti/storie in modo riconoscibile, può funzionare; in dubbio, preferire `/api/stories` o `/api/components`.

---

## 3. Come esporre gli endpoint (opzioni)

### Opzione A — Package che aggiunge una REST API a Storybook

- Cerca su npm pacchetti che espongono Storybook come REST API (es. “storybook api”, “storybook rest api”).  
- Dopo l’installazione e la configurazione, lo **stesso URL** con cui apri Storybook in browser espone anche `/api/stories` (o `/api/components`).  
- Deploy come al solito (Vercel, Netlify, Chromatic, ecc.): l’URL che usi per lo Storybook sarà quello da incollare in Comtra.

### Opzione B — Server o serverless custom (come il nostro template)

Se il tuo Storybook è solo build statico (HTML/JS) senza API:

1. **In locale:** un server Node che serve la cartella statica e risponde a `GET /api/stories` con un JSON (generato a mano, da script o da un tool che legge le story).  
2. **Su Vercel/Netlify:** una **serverless function** sullo stesso progetto che risponde a `GET /api/stories` con lo stesso JSON (es. `api/stories.js` su Vercel). Lo stesso URL del deploy (es. `https://xxx.vercel.app`) funziona in Comtra.  
3. Puoi generare il JSON a build time (script che legge le story e scrive `stories.json`) e servirlo dalla function o come file statico esposto sotto `/api/stories` (rewrite se necessario).

### Opzione C — Build statico con index

- Se il tuo Storybook (o un addon) genera già un file tipo `index.json` con l’elenco delle storie e lo espone alla root (es. `/index.json`), Comtra può usare quello.  
- Verifica che l’URL base + `/index.json` restituisca JSON con una struttura compatibile (es. `entries` o array di storie).

---

## 4. Test locale (senza deploy)

1. Avvia Storybook (o il server che espone anche `/api/stories`).  
2. Esponi la porta con **ngrok** (es. `ngrok http 6006`).  
3. Usa l’URL pubblico ngrok in Comtra (es. `https://abc123.ngrok.io`).  
4. Se il server risponde a `https://abc123.ngrok.io/api/stories` con il JSON corretto, Connect in Comtra andrà a buon fine.

---

## 5. Riepilogo

- **Link da usare:** lo stesso URL dello Storybook (deploy o ngrok).  
- **Cosa deve esserci:** almeno uno tra `GET /api/stories`, `GET /api/components`, `GET /index.json` che restituisca JSON nel formato sopra.  
- **Se Connect fallisce:** Comtra ti avviserà; apri la guida “Come esporre l’API Storybook” (modale nel plugin) o questa doc per impostare uno degli endpoint.  
- **Riferimenti:** `docs/SYNC-COMMON-CASE.md`, `docs/SYNC-INVESTIGATION.md`.
