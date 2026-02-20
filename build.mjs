// build.mjs
// Compiles controller.ts (Figma main thread) into dist/code.js
// The content of dist/ui.html is inlined as the __html__ global,
// which Figma uses when figma.showUI(__html__) is called.

import { build } from 'esbuild';
import { readFileSync } from 'fs';

const html = readFileSync('./dist/ui.html', 'utf-8');

await build({
  entryPoints: ['./controller.ts'],
  bundle: true,
  outfile: './dist/code.js',
  target: 'es6',
  platform: 'browser',
  define: {
    __html__: JSON.stringify(html),
  },
  tsconfig: './tsconfig.plugin.json',
  minify: false,
  logLevel: 'info',
});

console.log('✓ dist/code.js built successfully');
