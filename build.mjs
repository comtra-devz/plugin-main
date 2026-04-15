// build.mjs
// Compiles controller.ts (Figma main thread) into dist/code.js and inlines
// the UI HTML so that figma.showUI(__html__, ...) works when loading the
// plugin from manifest (Figma does not inject __html__ in that case).

import { build } from 'esbuild';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uiPath = path.join(__dirname, 'dist', 'ui.html');

if (!existsSync(uiPath)) {
  console.error('Missing dist/ui.html. Run "npm run build" (Vite builds first, then this script).');
  process.exit(1);
}

const uiHtml = readFileSync(uiPath, 'utf-8');

await build({
  entryPoints: ['./controller.ts'],
  bundle: true,
  format: 'iife',
  outfile: './dist/code.js',
  target: 'es6',
  platform: 'browser',
  tsconfig: './tsconfig.plugin.json',
  minify: false,
  logLevel: 'info',
  define: {
    __html__: JSON.stringify(uiHtml),
  },
});

console.log('✓ dist/code.js built successfully (__html__ inlined from dist/ui.html)');
