
export enum ViewState {
  AUDIT = 'AUDIT',
  GENERATE = 'GENERATE',
  CODE = 'CODE',
  SUBSCRIPTION = 'SUBSCRIPTION',
  DOCUMENTATION = 'DOCUMENTATION',
  PRIVACY = 'PRIVACY',
  WEBSITE = 'WEBSITE'
}

export type UserPlan = 'FREE' | 'PRO';

export interface User {
  name: string;
  email: string;
  avatar: string;
  plan: UserPlan;
}

export interface AuditCategory {
  id: string;
  label: string;
  score: number;
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
  fix: string;
  tokenPath?: string;
}

export interface NavProps {
  current: ViewState;
  onChange: (view: ViewState) => void;
}