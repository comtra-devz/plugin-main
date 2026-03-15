/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './**/*.{tsx,ts,jsx,js}',
    '!./node_modules/**',
    '!./dist/**',
    '!./build.mjs',
  ],
  safelist: [
    { pattern: /bg-\[#ff90e8\]/ }, // primary CTA rosa: non deve essere rimosso dalla purge
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
