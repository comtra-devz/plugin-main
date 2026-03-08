/** Versione UI del plugin; aggiornare qui quando si va live (es. 1.0.1, 1.1.0). */
export const APP_VERSION = '1.0.0';

/** Base URL del server OAuth. In build: VITE_AUTH_BACKEND_URL; default production: auth.comtra.dev */
export const AUTH_BACKEND_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_AUTH_BACKEND_URL) ||
  'https://auth.comtra.dev';

/** Plugin ID (manifest); usato per postMessage sicuro verso Figma */
export const FIGMA_PLUGIN_ID = 'COMTRA_PLUGIN_DEV_ID';

/** Email degli utenti di test: crediti infiniti di default; opzione "Simula Free Tier" per testare logica reale. Vuoto = tutti gli account sono effettivi (detrazioni, storico, badge, livelli e dashboard al 100%). */
export const TEST_USER_EMAILS: string[] = [];

/** Crediti free tier (usati anche per simulazione test user quando API non disponibile). */
export const FREE_TIER_CREDITS = 25;

const STORAGE_KEY_SIMULATE_FREE = 'comtra_simulate_free_tier';
const STORAGE_KEY_SIMULATED_CREDITS_PREFIX = 'comtra_test_simulated_credits_';

export function getSimulatedCreditsFromStorage(email: string): { remaining: number; total: number; used: number } | null {
  try {
    const key = STORAGE_KEY_SIMULATED_CREDITS_PREFIX + email.toLowerCase().trim();
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (o && typeof o.remaining === 'number' && typeof o.total === 'number' && typeof o.used === 'number') {
      return { remaining: Math.max(0, o.remaining), total: o.total, used: o.used };
    }
    return null;
  } catch {
    return null;
  }
}

export function setSimulatedCreditsInStorage(email: string, value: { remaining: number; total: number; used: number }): void {
  try {
    const key = STORAGE_KEY_SIMULATED_CREDITS_PREFIX + email.toLowerCase().trim();
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
export function getSimulateFreeTierFromStorage(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_SIMULATE_FREE) === 'true';
  } catch {
    return false;
  }
}
export function setSimulateFreeTierInStorage(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_SIMULATE_FREE, value ? 'true' : 'false');
  } catch {}
}

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
  { maxNodes: Infinity, label: '200k+', cost: 11 }
];

/** Max nodes we count; progress 100% = COUNT_CAP. We stop at this limit; above = "200k+" tier. */
export const COUNT_CAP = 200_000;

export function getScanCostAndSize(nodeCount: number): { cost: number; sizeLabel: string } {
  for (const tier of SCAN_SIZE_TIERS) {
    if (nodeCount <= tier.maxNodes) return { cost: tier.cost, sizeLabel: tier.label };
  }
  const last = SCAN_SIZE_TIERS[SCAN_SIZE_TIERS.length - 1];
  return { cost: last.cost, sizeLabel: last.label };
}

/** A11Y Audit cost by document size (node count). Same complexity bands as DS Audit; lower cost (no Kimi, backend-only). */
export const A11Y_SCAN_SIZE_TIERS: { maxNodes: number; label: string; cost: number }[] = [
  { maxNodes: 500, label: 'Small', cost: 1 },
  { maxNodes: 5_000, label: 'Medium', cost: 2 },
  { maxNodes: 50_000, label: 'Large', cost: 4 },
  { maxNodes: Infinity, label: '200k+', cost: 6 }
];

export function getA11yCostAndSize(nodeCount: number): { cost: number; sizeLabel: string } {
  for (const tier of A11Y_SCAN_SIZE_TIERS) {
    if (nodeCount <= tier.maxNodes) return { cost: tier.cost, sizeLabel: tier.label };
  }
  const last = A11Y_SCAN_SIZE_TIERS[A11Y_SCAN_SIZE_TIERS.length - 1];
  return { cost: last.cost, sizeLabel: last.label };
}

/** Prototype Audit: cost by number of flows selected (multi-select). Low credits; no "All Pages". See audit-specs/prototype-audit/COST-PROSPECT.md, SCOPE-AND-UI.md. */
export const PROTO_AUDIT_FLOW_TIERS: { maxFlows: number; label: string; cost: number }[] = [
  { maxFlows: 1, label: '1 flow', cost: 1 },
  { maxFlows: 3, label: '2–3 flows', cost: 2 },
  { maxFlows: 6, label: '4–6 flows', cost: 3 },
  { maxFlows: Infinity, label: '7+ flows', cost: 4 },
];

export function getPrototypeAuditCost(selectedFlowCount: number): { cost: number; sizeLabel: string } {
  const n = Math.max(0, selectedFlowCount);
  for (const tier of PROTO_AUDIT_FLOW_TIERS) {
    if (n <= tier.maxFlows) return { cost: tier.cost, sizeLabel: tier.label };
  }
  const last = PROTO_AUDIT_FLOW_TIERS[PROTO_AUDIT_FLOW_TIERS.length - 1];
  return { cost: last.cost, sizeLabel: last.label };
}

/** Lemon Squeezy: base checkout URL (store custom domain). Aggiungere ?aff=CODICE per attribuzione affiliato. */
export const LEMON_SQUEEZY_CHECKOUT_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_LEMON_SQUEEZY_CHECKOUT_BASE) || 'https://comtra.lemonsqueezy.com/checkout/buy';

/**
 * Variant ID Lemon Squeezy per tier (override con env VITE_LEMON_VARIANT_* se serve).
 */
export const LEMON_SQUEEZY_VARIANT_IDS: Record<string, string> = {
  '1w': (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_LEMON_VARIANT_1W) || '1345293',
  '1m': (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_LEMON_VARIANT_1M) || '1345303',
  '6m': (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_LEMON_VARIANT_6M) || '1345310',
  '1y': (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_LEMON_VARIANT_1Y) || '1345319',
};

/**
 * Costruisce l'URL di checkout Lemon Squeezy.
 * @param tier - 1w | 1m | 6m | 1y
 * @param affiliateCode - codice affiliato (opzionale)
 * @param userEmail - email utente loggato: passata in custom_data così il webhook può aggiornare l'acquirente (plan PRO)
 */
export function buildCheckoutUrl(tier: string, affiliateCode?: string, userEmail?: string): string {
  const variantId = LEMON_SQUEEZY_VARIANT_IDS[tier] || LEMON_SQUEEZY_VARIANT_IDS['6m'];
  const base = `${LEMON_SQUEEZY_CHECKOUT_BASE}/${variantId}`;
  const code = affiliateCode?.trim();
  const email = userEmail?.trim();
  if (!code && !email) return base;
  const params = new URLSearchParams();
  if (code) {
    params.set('aff', code);
    params.set('checkout[custom][aff]', code);
  }
  if (email) params.set('checkout[custom][email]', email);
  return `${base}?${params.toString()}`;
}

/**
 * URL del backend che reindirizza al checkout Lemon Squeezy.
 * Usare questo per "Pay now" nel plugin per evitare 404 (config centralizzata lato server).
 */
export function buildCheckoutRedirectUrl(
  tier: string,
  affiliateCode?: string,
  userEmail?: string
): string {
  const base =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_AUTH_BACKEND_URL) ||
    'https://auth.comtra.dev';
  const params = new URLSearchParams();
  params.set('tier', tier);
  const code = affiliateCode?.trim();
  const email = userEmail?.trim();
  if (code) params.set('aff', code);
  if (email) params.set('email', email);
  return `${base}/api/checkout/redirect?${params.toString()}`;
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