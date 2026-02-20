// build.mjs
// Compiles controller.ts (Figma main thread) into dist/code.js
//
// __html__ is NOT inlined here — Figma injects it automatically at runtime
// from the "ui" field in manifest.json ("ui": "dist/ui.html").
// Inlining the HTML would embed React JS (with import() calls) as a string
// inside code.js, causing Figma's sandbox to reject it with SyntaxError.

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
