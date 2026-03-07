// Same-origin quando deployata sul suo progetto Vercel (API in /api/admin); opzionale override per dev.
const BASE = (import.meta as any).env?.VITE_ADMIN_API_URL ?? '';
const SECRET = (import.meta as any).env?.VITE_ADMIN_SECRET ?? '';

function headers(): HeadersInit {
  const h: HeadersInit = { 'Content-Type': 'application/json' };
  if (SECRET) {
    (h as Record<string, string>)['Authorization'] = `Bearer ${SECRET}`;
    (h as Record<string, string>)['X-Admin-Key'] = SECRET;
  }
  return h;
}

function apiUrl(route: string, params?: Record<string, string | number>) {
  const q = new URLSearchParams({ route, ...(params && Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))) });
  return `${BASE}/api/admin?${q.toString()}`;
}

export async function fetchStats(): Promise<AdminStats> {
  const r = await fetch(apiUrl('stats'), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export async function fetchCreditsTimeline(period = 30): Promise<CreditsTimeline> {
  const r = await fetch(apiUrl('credits-timeline', { period }), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export async function fetchUsers(limit = 50, offset = 0, country?: string): Promise<AdminUsersResponse> {
  const params: Record<string, string | number> = { limit, offset };
  if (country && country.trim()) params.country = country.trim().toUpperCase().slice(0, 2);
  const r = await fetch(apiUrl('users', params), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export async function fetchUsersCountries(): Promise<{ countries: string[] }> {
  const r = await fetch(apiUrl('users-countries'), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export async function fetchAffiliates(): Promise<AdminAffiliatesResponse> {
  const r = await fetch(apiUrl('affiliates'), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export async function fetchTokenUsage(period = 30): Promise<TokenUsageResponse> {
  const r = await fetch(apiUrl('token-usage', { period }), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export interface WeeklyUpdateItem {
  id: string;
  date: string;
  category: string;
  title: string;
  description: string;
  commitHash?: string;
}

export interface WeeklyUpdatesResponse {
  updates: WeeklyUpdateItem[];
  source: 'github' | 'none';
  message?: string;
}

export async function fetchWeeklyUpdates(perPage = 30): Promise<WeeklyUpdatesResponse> {
  const r = await fetch(apiUrl('weekly-updates', { per_page: perPage }), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export type HealthStatus = 'up' | 'degraded' | 'down' | 'unknown';

export interface HealthCheckItem {
  id: string;
  name: string;
  status: HealthStatus;
  latencyMs: number | null;
  message: string | null;
}

export interface HealthResponse {
  global: HealthStatus;
  checks: HealthCheckItem[];
  cachedAt: string;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const r = await fetch(apiUrl('health'), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export interface TokenUsageResponse {
  period_days: number;
  since: string;
  totals: { count: number; input_tokens: number; output_tokens: number; cost_usd: number };
  by_action: { action_type: string; count: number; input_tokens: number; output_tokens: number; cost_usd: number }[];
  by_size_band: { size_band: string; count: number; input_tokens: number; output_tokens: number; cost_usd: number }[];
  by_day: { date: string; count: number; input_tokens: number; output_tokens: number; cost_usd: number }[];
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
    token_usage_30d: { calls: number; cost_usd: number } | null;
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
  country_code?: string | null;
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

export interface FunctionExecution {
  id: string;
  user_masked: string;
  country_code?: string | null;
  action_type: string;
  credits_consumed: number;
  created_at: string;
}

export interface FunctionExecutionsResponse {
  total: number;
  limit: number;
  offset: number;
  executions: FunctionExecution[];
}

export interface ExecutionsUser {
  user_id: string;
  user_masked: string;
  country_code?: string | null;
}

export interface ExecutionsUsersResponse {
  users: ExecutionsUser[];
}

export interface FunctionExecutionsFilters {
  action_type?: string;
  date_from?: string;
  date_to?: string;
  user_id?: string;
  country?: string;
}

export async function fetchFunctionExecutions(
  limit: number,
  offset: number,
  filters?: FunctionExecutionsFilters
): Promise<FunctionExecutionsResponse> {
  const params: Record<string, string | number> = { limit, offset };
  if (filters?.action_type) params.action_type = filters.action_type;
  if (filters?.date_from) params.date_from = filters.date_from;
  if (filters?.date_to) params.date_to = filters.date_to;
  if (filters?.user_id) params.user_id = filters.user_id;
  if (filters?.country) params.country = filters.country.trim().toUpperCase().slice(0, 2);
  const r = await fetch(apiUrl('function-executions', params), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export async function fetchExecutionsUsers(dateFrom?: string, dateTo?: string, country?: string): Promise<ExecutionsUsersResponse> {
  const params: Record<string, string> = {};
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;
  if (country && country.trim()) params.country = country.trim().toUpperCase().slice(0, 2);
  const r = await fetch(apiUrl('executions-users', params), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}
