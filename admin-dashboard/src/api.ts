// Same-origin quando deployata sul suo progetto Vercel (API in /api/admin); opzionale override per dev.
const BASE = (import.meta as any).env?.VITE_ADMIN_API_URL ?? '';
const SECRET = (import.meta as any).env?.VITE_ADMIN_SECRET ?? '';

const AUTH_TOKEN_KEY = 'admin_token';

export function getStoredToken(): string | null {
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  else sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

function authHeaders(): HeadersInit {
  const h: HeadersInit = { 'Content-Type': 'application/json' };
  const token = getStoredToken();
  if (token) {
    (h as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  } else if (SECRET) {
    (h as Record<string, string>)['Authorization'] = `Bearer ${SECRET}`;
    (h as Record<string, string>)['X-Admin-Key'] = SECRET;
  }
  return h;
}

function headers(): HeadersInit {
  return authHeaders();
}

function authApiUrl(): string {
  return `${BASE}/api/admin-auth`;
}

export interface LoginResponse {
  need2FA?: boolean | 'setup';
  tempToken?: string;
}

export interface Setup2FAResponse {
  qrUrl: string;
  secret: string;
  setupToken: string;
}

/** Magic link: richiedi invio email con link */
export async function requestMagicLink(email: string): Promise<{ ok: boolean }> {
  let r: Response;
  try {
    r = await fetch(authApiUrl(), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ action: 'request-magic-link', email: email.trim().toLowerCase() }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/fetch|network|failed/i.test(msg)) {
      throw new Error('Impossibile raggiungere il server. In locale imposta VITE_ADMIN_API_URL con l\'URL della dashboard deployata.');
    }
    throw err;
  }
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.error || `Errore ${r.status}`);
  }
  return r.json();
}

/** Magic link: scambia token dal link con session JWT */
export async function verifyMagicLink(token: string): Promise<{ token: string }> {
  const r = await fetch(authApiUrl(), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ action: 'verify-magic-link', token }),
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.error || 'Link non valido o scaduto');
  }
  return r.json();
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  let r: Response;
  try {
    r = await fetch(authApiUrl(), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ action: 'login', email: email.trim().toLowerCase(), password }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/fetch|network|failed/i.test(msg)) {
      throw new Error('Impossibile raggiungere il server. Se sei in locale (npm run dev), imposta VITE_ADMIN_API_URL con l\'URL della dashboard deployata.');
    }
    throw err;
  }
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    const serverMsg = data.error || '';
    if (r.status === 503) throw new Error(serverMsg || 'Server non configurato (manca POSTGRES_URL?)');
    if (r.status === 401) throw new Error(serverMsg || 'Credenziali non valide');
    throw new Error(serverMsg || `Errore ${r.status}`);
  }
  return r.json();
}

export async function verify2fa(tempToken: string, code: string): Promise<{ token: string }> {
  const r = await fetch(authApiUrl(), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ action: 'verify-2fa', tempToken, code: code.trim() }),
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.error || `Errore ${r.status}`);
  }
  return r.json();
}

export async function setup2fa(tempToken: string): Promise<Setup2FAResponse> {
  const r = await fetch(authApiUrl(), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ action: 'setup-2fa', tempToken }),
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.error || `Errore ${r.status}`);
  }
  return r.json();
}

export async function confirm2fa(setupToken: string, code: string): Promise<{ token: string }> {
  const r = await fetch(authApiUrl(), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ action: 'confirm-2fa', setupToken, code: code.trim() }),
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.error || `Errore ${r.status}`);
  }
  return r.json();
}

function apiUrl(route: string, params?: Record<string, string | number>) {
  const q = new URLSearchParams({ route, ...(params && Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))) });
  return `${BASE}/api/admin?${q.toString()}`;
}

// --- Notifiche admin
export type NotificationSeverity = 'info' | 'warning' | 'critical';

export interface AdminNotification {
  id: string;
  created_at: string;
  title: string;
  description: string;
  severity: NotificationSeverity;
  target_path: string;
}

export interface AdminNotificationsResponse {
  items: AdminNotification[];
}

export async function fetchNotifications(): Promise<AdminNotificationsResponse> {
  const r = await fetch(apiUrl('notifications'), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
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

export interface ThrottleEventsResponse {
  total: number;
  by_day: { day: string; count: number }[];
  recent: { id: string; user_id: string; user_masked: string; occurred_at: string }[];
}

export async function fetchThrottleEvents(): Promise<ThrottleEventsResponse> {
  const r = await fetch(apiUrl('throttle-events'), { headers: headers() });
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
  timeline: { date: string; credits: number; scans: number; kimi_calls?: number; kimi_cost_usd?: number }[];
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

// --- Codici sconto (livello gamification + throttle 5%)
export interface DiscountsStats {
  level: { total: number; by_level: { 5: number; 10: number; 15: number; 20: number } };
  throttle: { total: number; valid: number; expired: number };
}

export async function fetchDiscountsStats(): Promise<DiscountsStats> {
  const r = await fetch(apiUrl('discounts-stats'), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export interface DiscountLevelItem {
  user_id: string;
  user_masked: string;
  level: number;
  code: string;
  created_at: string;
}

export interface DiscountsLevelResponse {
  total: number;
  limit: number;
  offset: number;
  items: DiscountLevelItem[];
}

export async function fetchDiscountsLevel(limit: number, offset: number, level?: number): Promise<DiscountsLevelResponse> {
  const params: Record<string, string | number> = { limit, offset };
  if (level != null && [5, 10, 15, 20].includes(level)) params.level = level;
  const r = await fetch(apiUrl('discounts-level', params), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export interface DiscountThrottleItem {
  user_id: string;
  user_masked: string;
  code: string;
  expires_at: string;
  issued_at: string;
  status: 'valid' | 'expired';
}

export interface DiscountsThrottleResponse {
  total: number;
  limit: number;
  offset: number;
  items: DiscountThrottleItem[];
}

export async function fetchDiscountsThrottle(
  limit: number,
  offset: number,
  status?: 'valid' | 'expired'
): Promise<DiscountsThrottleResponse> {
  const params: Record<string, string | number> = { limit, offset };
  if (status) params.status = status;
  const r = await fetch(apiUrl('discounts-throttle', params), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

// --- A/B test Generate
export interface GenerateABStatsResponse {
  period_days: number;
  since: string;
  total: {
    count: number;
    input_tokens: number;
    output_tokens: number;
    credits_consumed: number;
    avg_latency_ms: number | null;
    cost_usd: number;
  };
  by_variant: {
    variant: string;
    count: number;
    input_tokens: number;
    output_tokens: number;
    credits_consumed: number;
    avg_latency_ms: number | null;
  }[];
  feedback_by_variant: Record<string, { up: number; down: number }>;
  requests_list: {
    id: string;
    user_id: string;
    user_masked: string;
    variant: string;
    input_tokens: number;
    output_tokens: number;
    credits_consumed: number;
    latency_ms: number | null;
    created_at: string;
    feedback_thumbs: string | null;
    feedback_comment: string | null;
  }[];
  timeline: { date: string; A: { count: number; credits: number }; B: { count: number; credits: number } }[];
}

export async function fetchGenerateABStats(period = 30): Promise<GenerateABStatsResponse> {
  const r = await fetch(apiUrl('generate-ab-stats', { period }), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

// --- Supporto (feedback A/B test e altre fonti)
export interface SupportFeedbackItem {
  id: string;
  source: string;
  variant: string;
  thumbs: string;
  comment: string | null;
  user_masked: string;
  created_at: string;
}

export interface SupportFeedbackResponse {
  items: SupportFeedbackItem[];
}

export async function fetchSupportFeedback(limit = 100): Promise<SupportFeedbackResponse> {
  const r = await fetch(apiUrl('support-feedback', { limit }), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

// --- Sicurezza e log (throttle, problematiche plugin)
export interface PluginLogItem {
  id: string;
  date: string;
  category: string;
  category_label: string;
  description: string;
  fix: string;
  risolto: boolean;
  user_masked: string;
}

export interface PluginLogsResponse {
  items: PluginLogItem[];
}

export async function fetchPluginLogs(limit = 100): Promise<PluginLogsResponse> {
  const r = await fetch(apiUrl('plugin-logs', { limit }), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

// --- Brand awareness (Share on LinkedIn, futuro: post pubblicati, click pagina/footer)
export interface BrandAwarenessShareClick {
  id: string;
  user_id: string;
  user_masked: string;
  trophy_id: string;
  created_at: string;
}

export interface BrandAwarenessResponse {
  period_days: number;
  since: string;
  share_clicks: {
    total: number;
    limit: number;
    offset: number;
    items: BrandAwarenessShareClick[];
  };
  by_trophy: Record<string, number>;
  unique_users: number;
  posts_published_note?: string;
  activity_note?: string;
}

export async function fetchBrandAwareness(period = 30, limit = 100, offset = 0): Promise<BrandAwarenessResponse> {
  const r = await fetch(apiUrl('brand-awareness', { period, limit, offset }), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

// --- Funnel touchpoint (Landing, Plugin, LinkedIn, Instagram, TikTok)
export interface TouchpointSourceData {
  source: string;
  label: string;
  visite: number;
  click: number;
  ingressi: number;
  primo_utilizzo: number;
  upgrade_pro: number;
  pro_attivi: number;
  note?: string;
}

export interface TouchpointFunnelResponse {
  period_days: number;
  since: string;
  by_source: TouchpointSourceData[];
  data_note?: string;
}

export async function fetchTouchpointFunnel(period = 30): Promise<TouchpointFunnelResponse> {
  const r = await fetch(apiUrl('touchpoint-funnel', { period }), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

// --- Content Management (Documentation CMS)
export interface DocContentData {
  header: { title: string; subtitle: string };
  tutorials: Record<string, { title: string; content: string }>;
  videos: { id: string; title: string; time: string; url: string }[];
  faqs: { q: string; a: string }[];
}

export interface DocContentResponse {
  data: DocContentData;
}

export async function fetchDocContent(): Promise<DocContentResponse> {
  const r = await fetch(`${BASE}/api/doc-content`, { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export async function saveDocContent(data: DocContentData): Promise<{ ok: boolean }> {
  const r = await fetch(`${BASE}/api/doc-content`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ data }),
  });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}
