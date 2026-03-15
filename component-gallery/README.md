# Comtra — Component Gallery

Storybook interno: tutti i componenti UI del plugin organizzati per tipologia e categoria.

- **Buttons** — CTA primary (rosa), secondary, black, danger, size sm/default
- **Cards** — BRUTAL.card
- **Form & Inputs** — BRUTAL.input
- **Navigation** — Tab e pattern nav
- **Colours & Tokens** — Palette (primary, yellow, black, white)

## Sviluppo

```bash
cd component-gallery
npm install
npm run dev
```

Apri [http://localhost:5173](http://localhost:5173).

## Build per Vercel

```bash
npm run build
```

Output in `dist/`. Su Vercel imposta:

- **Root Directory**: `component-gallery`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

Le import da `@comtra` risolvono alla root del repo (parent), quindi il deploy deve includere il monorepo (root = repo, root del progetto Vercel = `component-gallery`).
