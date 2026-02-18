
export enum ViewState {
  AUDIT = 'AUDIT',
  GENERATE = 'GENERATE',
  CODE = 'CODE',
  ANALYTICS = 'ANALYTICS',
  SUBSCRIPTION = 'SUBSCRIPTION',
  DOCUMENTATION = 'DOCUMENTATION',
  PRIVACY = 'PRIVACY',
  TERMS = 'TERMS',
  WEBSITE = 'WEBSITE',
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
  name: string;
  email: string;
  avatar: string;
  plan: UserPlan;
  tier?: string; // '1w', '1m', '6m', '1y'
  stats: UserStats;
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
