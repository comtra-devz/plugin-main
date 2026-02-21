/** Base URL del server OAuth (va hostato in HTTPS). In build: VITE_AUTH_BACKEND_URL; in dev default localhost */
export const AUTH_BACKEND_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_AUTH_BACKEND_URL) ||
  'http://localhost:3456';

/** Plugin ID (manifest); usato per postMessage sicuro verso Figma */
export const FIGMA_PLUGIN_ID = 'COMTRA_PLUGIN_DEV_ID';

export const COLORS = {
  primary: '#ff90e8',
  yellow: '#ffc900',
  black: '#000000',
  white: '#ffffff',
  bg: '#fdfdfd'
};

export const BRUTAL = {
  card: `bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] p-4`,
  btn: `border-2 border-black shadow-[4px_4px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_#000] transition-all font-bold uppercase tracking-wider px-4 py-2`,
  input: `w-full border-2 border-black p-3 font-mono focus:bg-[#ffc900] outline-none transition-colors`
};

export const TIER_LIMITS: Record<string, number> = {
  'FREE': 10,
  '1w': 20,
  '1m': 100,
  '6m': 600,
  '1y': 3000,
  'PRO': 3000 
};

export const PRIVACY_CONTENT = [
  {
    title: "1. Data Collection",
    text: "We only collect data necessary for the functionality of the Comtra plugin, including your Figma user ID and email for authentication purposes. We do not store your design files."
  },
  {
    title: "2. AI Processing",
    text: "Data sent to our AI models (Gemini) is ephemeral. We send prompts derived from your layer names and properties, but we do not use your data to train our models."
  },
  {
    title: "3. Security",
    text: "All connections are encrypted via SSL. Payments are processed securely by Stripe; we do not hold your credit card information."
  },
  {
    title: "4. Contact",
    text: "For any privacy concerns, please contact privacy@comtra.ai."
  }
];