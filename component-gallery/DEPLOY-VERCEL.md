# Deploy Component Gallery su Vercel

Se la build fallisce con **"Installing dependencies..."** o errori del plugin principale, molto probabilmente Vercel sta usando la **root del repo** invece della cartella della gallery.

## Passi obbligatori

1. Vercel Dashboard → progetto collegato a `comtra-devz/plugin-main`.
2. **Settings** → **General** → **Root Directory**.
3. Clicca **Edit** e imposta:
   ```
   component-gallery
   ```
4. **Build & Development Settings** (stesso pannello):
   - **Build Command**: `npm run build` (o lascia vuoto, usa quello di default dalla cartella).
   - **Output Directory**: `dist`.
5. **Save** e **Redeploy**.

Così Vercel:
- esegue `npm install` dentro `component-gallery/` (solo le dipendenze della gallery),
- esegue `npm run build` dalla stessa cartella,
- pubblica il contenuto di `component-gallery/dist/`.

## Se non imposti Root Directory

Vercel userà la root del repo:
- `npm install` userà il `package.json` del **plugin** (con @figma/plugin-typings, redis, ecc.),
- la **Build Command** potrebbe essere quella del plugin (es. `vite build && node build.mjs`),
- la build può fallire o produrre l’app sbagliata.

## Verifica

Dopo il deploy, la pagina deve mostrare la **Component Gallery** (sidebar con Buttons, Cards, Form, ecc.). Se vedi l’app del plugin o una 404, controlla di nuovo Root Directory e Output Directory.
