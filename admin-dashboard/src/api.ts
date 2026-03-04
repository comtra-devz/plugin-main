const API_URL = (import.meta as any).env?.VITE_ADMIN_API_URL || 'https://auth.comtra.dev';
const SECRET = (import.meta as any).env?.VITE_ADMIN_SECRET || '';

function headers(): HeadersInit {
  const h: HeadersInit = { 'Content-Type': 'application/json' };
  if (SECRET) {
    (h as Record<string, string>)['Authorization'] = `Bearer ${SECRET}`;
    (h as Record<string, string>)['X-Admin-Key'] = SECRET;
  }
  return h;
}

export async function fetchStats(): Promise<AdminStats> {
  const r = await fetch(`${API_URL}/api/admin/stats`, { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export async function fetchCreditsTimeline(period = 30): Promise<CreditsTimeline> {
  const r = await fetch(`${API_URL}/api/admin/credits-timeline?period=${period}`, { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export async function fetchUsers(limit = 50, offset = 0): Promise<AdminUsersResponse> {
  const r = await fetch(`${API_URL}/api/admin/users?limit=${limit}&offset=${offset}`, { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export async function fetchAffiliates(): Promise<AdminAffiliatesResponse> {
  const r = await fetch(`${API_URL}/api/admin/affiliates`, { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export interface AdminStats {
  users: {
    total: number;
    by_plan: Record<string, number>;
    pro_by_variant: { credits_total: number; label: string; count: number }[];
    signups_today: number;
    signups_7d: number;
    signups_30d: number;
    pro_expiring_7d: number;
  };
  credits: {
    scans_today: number;
    scans_7d: number;
    scans_30d: number;
    credits_consumed_30d: number;
    by_action_type: { action_type: string; count: number; credits: number }[];
  };
  kimi: {
    cost_30d_usd: number;
    cost_per_scan_usd: number;
    suggested_buffer_30d_usd: number;
    alert_threshold_usd: number;
    cost_alert: boolean;
  };
  affiliates: { total: number; referrals_total: number };
  funnel: {
    signups_30d: number;
    free_active: number;
    pro: number;
    conversion_free_to_pro_pct: number;
  };
}

export interface CreditsTimeline {
  period_days: number;
  since: string;
  timeline: { date: string; credits: number; scans: number }[];
  by_action_per_day: Record<string, Record<string, { count: number; credits: number }>>;
}

export interface AdminUser {
  id: string;
  email_masked: string;
  name: string;
  plan: string;
  plan_expires_at: string | null;
  credits_total: number;
  credits_used: number;
  credits_remaining: number;
  created_at: string;
}

export interface AdminUsersResponse {
  total: number;
  limit: number;
  offset: number;
  users: AdminUser[];
}

export interface AdminAffiliate {
  affiliate_code: string;
  total_referrals: number;
  total_earnings_cents: number;
  created_at: string;
}

export interface AdminAffiliatesResponse {
  total: number;
  affiliates: AdminAffiliate[];
}
