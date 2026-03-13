# Storybook Test — Fonte per Comtra Sync

Storybook di test interno alla repo per verificare il flusso **Sync** (drift Figma ↔ Storybook). Contiene componenti standard: Button, Input, Card.

**Requisiti per Comtra:** URL che espone **GET /api/stories** (o /api/components, /index.json). Questo server lo fornisce in opzione B (build + serve). Nessun token richiesto (Storybook pubblico per test).

## URL di test

- **Locale:** dopo `npm run build && npm run serve`, esponi la porta con ngrok: `ngrok http 6006`. Usa l’URL pubblico (es. `https://abc123.ngrok.io`) nel plugin: Code → Sync → incolla URL → Connect Storybook (toggle “Private” OFF) → Scan Project.
- **Persistente:** deploy su Vercel/Netlify (vedi sotto); l’URL di deploy (es. `https://storybook-test-xxx.vercel.app`) è un URL riutilizzabile per i test.

## Setup

```bash
cd storybook-test
npm install
```

## Avvio

### Opzione A: Dev (solo Storybook, senza API)

```bash
npm run dev
```

Apre Storybook su http://localhost:6006. **Nota:** in modalità dev Storybook non espone `/api/stories`. Per il Sync serve l’opzione B.

### Opzione B: Build + Server (con API per Comtra)

```bash
npm run build    # genera storybook-static/
npm run serve    # avvia server su porta 6006
```

Il server:
- serve lo Storybook statico su http://localhost:6006
- espone **GET /api/stories** con i metadati dei componenti (formato compatibile con Comtra Sync)

## Collegamento con Comtra

Il backend Comtra deve poter raggiungere l’URL dello Storybook. Se il server è in locale (`localhost`), Vercel/serverless **non** può contattarlo.

### Per test locali

1. Avvia il server: `npm run serve`
2. Esponi la porta con **ngrok**: `ngrok http 6006`
3. Copia l’URL pubblico (es. `https://abc123.ngrok.io`)
4. Nel plugin Comtra: Code → Sync → incolla l’URL → Connect Storybook → Scan Project

### Per test persistenti (deploy)

Deploya `storybook-test` su Vercel/Netlify:

```bash
# Esempio Vercel
cd storybook-test
npm run build
npx vercel --prod
```

Oppure aggiungi uno script di deploy nel `package.json` del progetto principale. L’URL di deploy (es. `https://storybook-test-xxx.vercel.app`) può essere usato direttamente in Comtra.

## Componenti

| Componente | Stories |
|------------|---------|
| Button | Primary, Secondary, Danger, Disabled |
| Input | Default, WithValue, Error, Disabled |
| Card | Default, WithAction |

## Formato API

`GET /api/stories` restituisce:

```json
{
  "stories": [
    { "component": "Button", "title": "Components/Button", "id": "components-button--primary" },
    { "component": "Input", "title": "Components/Input", "id": "components-input--default" },
    { "component": "Card", "title": "Components/Card", "id": "components-card--default" }
  ]
}
```

Comtra Sync confronta i nomi `component` con i componenti nel file Figma per rilevare il drift.
