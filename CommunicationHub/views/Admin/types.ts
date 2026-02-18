
export interface ExtendedStats {
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

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  country: string;
  status: 'ACTIVE' | 'BLOCKED';
  subscription: 'FREE' | 'PRO_MONTHLY' | 'PRO_ANNUAL';
  joinedAt: string;
  totalSpent: number;
  referrals: number;
  creditsRemaining: number;
  extendedStats: ExtendedStats;
}

export interface AdminTeamMember {
    id: string;
    email: string;
    role: 'SUPER_ADMIN' | 'EDITOR' | 'VIEWER';
    joinedAt: string;
    status: 'ACTIVE' | 'PENDING';
}

export interface SecurityLog {
    id: string;
    type: 'LOGIN_FAIL' | 'Rate_Limit' | 'Admin_Action';
    ip: string;
    date: string;
    desc: string;
    severity: 'LOW' | 'MED' | 'HIGH';
}

export type RequestCategory = 'ALL' | 'FALSE_POSITIVE' | 'AUDIT_ERROR' | 'BUG' | 'FEATURE' | 'GENERAL';

export interface RequestItem {
    id: string;
    user: string;
    email: string;
    type: 'BUG' | 'FEATURE' | 'GENERAL'; 
    categoryTag: RequestCategory; 
    status: 'TODO' | 'IN_PROGRESS' | 'DONE';
    desc: string;
    fullMessage: string;
    date: string;
    lastAction?: string; // e.g. "Moved to IN_PROGRESS by admin..."
    // Mock images for visual regression
    images?: { before: string; after: string };
}

export const BRUTAL = {
  card: `bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] p-4 transition-all`,
  btn: `border-2 border-black shadow-[4px_4px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_#000] transition-all font-bold uppercase tracking-wider px-4 py-2 text-sm flex items-center justify-center gap-2`,
  input: `w-full border-2 border-black p-2 font-mono text-sm focus:bg-[#ffc900] outline-none transition-colors bg-white text-black`,
  label: `block text-[10px] font-bold uppercase mb-1 text-gray-500`, 
  tableHeader: `px-3 py-3 text-xs font-black uppercase border-r-2 border-black text-left bg-black text-white`, 
  tableCell: `px-3 py-3 text-sm border-r-2 border-black border-b-2 border-black text-black font-medium`
};
