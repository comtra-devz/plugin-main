
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
