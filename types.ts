
export enum ViewState {
  AUDIT = 'AUDIT',
  GENERATE = 'GENERATE',
  CODE = 'CODE',
  ANALYTICS = 'ANALYTICS',
  SUBSCRIPTION = 'SUBSCRIPTION',
  DOCUMENTATION = 'DOCUMENTATION',
  PRIVACY = 'PRIVACY',
  TERMS = 'TERMS',
  AFFILIATE = 'AFFILIATE'
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
