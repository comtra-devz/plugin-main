// build.mjs
// Compiles controller.ts (Figma main thread) into dist/code.js.
//
// __html__ is NOT inlined here — Figma provides it from manifest "ui".
// Inlining the full HTML can trigger sandbox SyntaxError regressions.

import { build } from 'esbuild';

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
});

console.log('✓ dist/code.js built successfully');
