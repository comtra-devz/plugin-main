/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './**/*.{tsx,ts,jsx,js}',
    '!./node_modules/**',
    '!./dist/**',
    '!./build.mjs',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
