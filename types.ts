
export enum ViewState {
  AUDIT = 'AUDIT',
  GENERATE = 'GENERATE',
  CODE = 'CODE',
  ANALYTICS = 'ANALYTICS',
  SUBSCRIPTION = 'SUBSCRIPTION',
  DOCUMENTATION = 'DOCUMENTATION',
  PRIVACY = 'PRIVACY',
  TERMS = 'TERMS',
  AFFILIATE = 'AFFILIATE',
  PERSONAL_DETAILS = 'PERSONAL_DETAILS',
}

export type UserPlan = 'FREE' | 'PRO';

export interface UserStats {
  maxHealthScore: number;
  wireframesGenerated: number;
  wireframesModified: number;
  analyzedA11y: number;
  analyzedUX: number;
  analyzedProto: number;
  syncedStorybook: number;
  syncedGithub: number;
  syncedBitbucket: number;
  affiliatesCount: number;
}

export interface User {
  id?: string;
  name: string;
  email: string;
  /** Iniziali (es. "JD") o singola lettera; usato se manca img_url */
  avatar: string;
  /** URL immagine profilo Figma (opzionale) */
  img_url?: string | null;
  plan: UserPlan;
  tier?: string; // '1w', '1m', '6m', '1y'
  stats: UserStats;
  /** JWT per API credits; presente dopo login OAuth (nuovo flusso) */
  authToken?: string;
  /** Gamification: da backend (OAuth callback + GET/POST credits) */
  current_level?: number;
  total_xp?: number;
  xp_for_next_level?: number;
  xp_for_current_level_start?: number;
  /** Tag da backend (es. "enterprise"); clienti Enterprise inseriti manualmente, vedi docs/CONTACT-REQUESTS.md */
  tags?: string[];
  /** Collegato Figma (OAuth) — "Personal details" in sola lettura. */
  figma_user_id?: string | null;
  first_name?: string | null;
  surname?: string | null;
  profile_saved_at?: string | null;
  name_conflict?: {
    figma_handle?: string;
    manual_first?: string;
    manual_surname?: string | null;
  } | null;
  profile_locked?: boolean;
  /** Dot rosso su avatar: nome mancante (magic) o conflitto nome dopo OAuth. */
  show_profile_badge?: boolean;
}

export interface AuditCategory {
  id: string;
  label: string;
  score: number; // -1 indicates Insufficient Data
  icon: string;
  color: string;
  issuesCount: number;
}

export interface AuditIssue {
  id: string;
  categoryId: string;
  msg: string;
  severity: 'HIGH' | 'MED' | 'LOW';
  layerId: string;
  layerIds?: string[];
  fix: string;
  tokenPath?: string;
  pageName?: string;
  /** Rule ID from Comtra Accessibility Ruleset (e.g. CTR-001, TGT-001) or UX Logic (UXL-001) */
  rule_id?: string;
  /** WCAG Success Criterion (e.g. 1.4.3, 2.5.8) */
  wcag_sc?: string;
  wcag_level?: 'A' | 'AA' | 'AAA';
  measured_value?: number;
  required_value?: number;
  passes?: boolean;
  /** UX Logic Audit: Nielsen heuristic (e.g. "H1 - Visibility of System Status") */
  heuristic?: string;
  /** UX Logic Audit: Figma node name (e.g. "submit-btn") */
  nodeName?: string;
  /** UX Logic Audit: whether an auto-fix is available */
  autoFixAvailable?: boolean;
  /** Prototype Audit: flow name (e.g. "Checkout Flow") */
  flowName?: string;
  /** Contrast: foreground color hex (e.g. "#6b7280") for swatch + variable name if bound */
  foregroundHex?: string;
  foregroundVariable?: string;
  /** Contrast: background color hex */
  backgroundHex?: string;
  backgroundVariable?: string;
  /** True if the issue is on a hidden (invisible) layer in Figma. */
  isOnHiddenLayer?: boolean;
  /** When true, hide Select layer + Auto-fix (e.g. page-level prototype advisories with no actionable layer). */
  hideLayerActions?: boolean;
  /** DS Optimization: true = recommendation (not critical issue). */
  recommendation?: boolean;
  /** DS Optimization: structured suggestions for merge/slots/tokens/variants. */
  optimizationPayload?: {
    componentIdsToMerge?: string[];
    suggestedSlots?: string[];
    suggestedTokens?: string[];
    suggestedVariants?: Record<string, string[]>;
  };
}

export interface DsAuditSummary {
  score: number;
  issues_total: number;
  high_issues: number;
  med_issues: number;
  low_issues: number;
  penalty_points?: number;
  breakdown?: {
    description_rate?: number;
    property_contract_rate?: number;
    token_binding_rate?: number;
    text_style_rate?: number;
    penalty_points?: number;
  };
}

export interface DsQualityGates {
  overall_score: number;
  status: 'pass' | 'warn' | 'block';
  gates: {
    spec_coverage: 'pass' | 'warn' | 'block';
    agent_readability: 'pass' | 'warn' | 'block';
  };
}

/**
 * Lightweight design-system snapshot built in the plugin sandbox for Deep Sync.
 * Replaces sending full `file_json` for the sync-scan flow (avoids Figma REST 429).
 */
export interface SyncSnapshot {
  fileKey: string;
  fileName: string;
  pages: Array<{
    id: string;
    name: string;
  }>;
  components: Array<{
    /** Stable id for "Select layer" (Figma node id in the file). */
    key: string;
    name: string;
    pageId: string;
    variantProperties: Record<string, string> | null;
    description: string;
    width?: number;
    height?: number;
  }>;
  /** Canvas instances — used with `components` so drift names match the previous document walk. */
  instances: Array<{
    id: string;
    name: string;
    mainComponentName: string | null;
    width?: number;
    height?: number;
  }>;
  styles: Array<{
    key: string;
    name: string;
    type: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID';
  }>;
}

export interface NavProps {
  current: ViewState;
  onChange: (view: ViewState) => void;
}

export interface AffiliateTransaction {
  id: string;
  date: string;
  amount: string;
  commission: string;
  status: 'PENDING' | 'CLEARED';
}

export interface Trophy {
  id: string;
  name: string;
  description: string;
  icon_id: string;
  sort_order: number;
  unlocked: boolean;
  unlocked_at: string | null;
}
