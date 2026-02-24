/** Versione UI del plugin; aggiornare qui quando si va live (es. 1.0.1, 1.1.0). */
export const APP_VERSION = '1.0.0';

/** Base URL del server OAuth. In build: VITE_AUTH_BACKEND_URL; default production: auth.comtra.dev */
export const AUTH_BACKEND_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_AUTH_BACKEND_URL) ||
  'https://auth.comtra.dev';

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

/** Scan cost by document size (node count). Used for audit; detailed count (library vs instances) happens later. */
export const SCAN_SIZE_TIERS: { maxNodes: number; label: string; cost: number }[] = [
  { maxNodes: 500, label: 'Small', cost: 2 },
  { maxNodes: 5_000, label: 'Medium', cost: 5 },
  { maxNodes: 50_000, label: 'Large', cost: 8 },
  { maxNodes: Infinity, label: 'Huge', cost: 11 }
];

/** Max nodes we count before stopping; progress % = count/COUNT_CAP. Keeps scan time bounded (~10s target). Above this = Huge tier. */
export const COUNT_CAP = 400_000;

export function getScanCostAndSize(nodeCount: number): { cost: number; sizeLabel: string } {
  for (const tier of SCAN_SIZE_TIERS) {
    if (nodeCount <= tier.maxNodes) return { cost: tier.cost, sizeLabel: tier.label };
  }
  const last = SCAN_SIZE_TIERS[SCAN_SIZE_TIERS.length - 1];
  return { cost: last.cost, sizeLabel: last.label };
}

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