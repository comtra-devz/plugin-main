/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{tsx,ts,jsx,js}',
    '../components/**/*.{tsx,ts,jsx,js}',
    '../constants.ts',
  ],
  safelist: [{ pattern: /bg-\[#ff90e8\]/ }],
  theme: {
    extend: {},
  },
  plugins: [],
};
