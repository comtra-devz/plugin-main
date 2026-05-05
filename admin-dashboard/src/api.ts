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

/** GET verso API dashboard: retry su errori transitori (cold start, DB, rate limit). */
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  const retryable = new Set([429, 500, 502, 503, 504]);
  const maxAttempts = 3;
  let last: Response | undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    last = await fetch(url, init);
    if (last.ok || !retryable.has(last.status) || attempt === maxAttempts - 1) return last;
    await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
  }
  return last!;
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
export async function requestMagicLink(email: string, redirectPath?: string): Promise<{ ok: boolean }> {
  let r: Response;
  try {
    r = await fetch(authApiUrl(), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        action: 'request-magic-link',
        email: email.trim().toLowerCase(),
        ...(redirectPath ? { redirect: redirectPath } : {}),
      }),
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
  /** URL assoluto (?redirect=…) per Discord / condivisione: dopo login atterra su `target_path`. */
  open_url?: string | null;
}

export interface AdminNotificationsResponse {
  items: AdminNotification[];
}

export async function fetchNotifications(): Promise<AdminNotificationsResponse> {
  const r = await fetchWithRetry(apiUrl('notifications'), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export async function fetchStats(): Promise<AdminStats> {
  const r = await fetchWithRetry(apiUrl('stats'), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export async function fetchCreditsTimeline(period = 30, plan?: 'PRO' | 'FREE'): Promise<CreditsTimeline> {
  const params: Record<string, string | number> = { period };
  if (plan === 'PRO' || plan === 'FREE') params.plan = plan;
  const r = await fetchWithRetry(apiUrl('credits-timeline', params), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export async function fetchUsers(limit = 50, offset = 0, country?: string): Promise<AdminUsersResponse> {
  const params: Record<string, string | number> = { limit, offset };
  if (country && country.trim()) params.country = country.trim().toUpperCase().slice(0, 2);
  const r = await fetchWithRetry(apiUrl('users', params), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

/** Ricarica crediti admin: step 1 – richiedi PIN (inviato a admin@comtra.dev) */
export async function rechargeRequest(userId: string, amount: number): Promise<{ ok: boolean; expires_at?: string }> {
  const r = await fetch(`${BASE}/api/recharge`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ step: 'request', user_id: userId, amount }),
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    if (r.status === 429) throw new Error(data.error || 'Ricarica consentita solo dopo 12 ore dall\'ultima');
    throw new Error(data.error || `Errore ${r.status}`);
  }
  return r.json();
}

/** Ricarica crediti admin: step 2 – conferma con PIN */
export async function rechargeConfirm(
  userId: string,
  amount: number,
  pin: string
): Promise<{ ok: boolean; credits_total: number; credits_remaining: number }> {
  const r = await fetch(`${BASE}/api/recharge`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ step: 'confirm', user_id: userId, amount, pin: pin.trim() }),
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.error || `Errore ${r.status}`);
  }
  return r.json();
}

export async function fetchUsersCountries(): Promise<{ countries: string[] }> {
  const r = await fetchWithRetry(apiUrl('users-countries'), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export async function fetchAffiliates(): Promise<AdminAffiliatesResponse> {
  const r = await fetchWithRetry(apiUrl('affiliates'), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export async function fetchTokenUsage(period = 30): Promise<TokenUsageResponse> {
  const r = await fetchWithRetry(apiUrl('token-usage', { period }), { headers: headers() });
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
  const r = await fetchWithRetry(apiUrl('weekly-updates', { per_page: perPage }), { headers: headers() });
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
  const r = await fetchWithRetry(apiUrl('health'), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export interface ThrottleEventsResponse {
  total: number;
  by_day: { day: string; count: number }[];
  recent: { id: string; user_id: string; user_masked: string; occurred_at: string }[];
}

export async function fetchThrottleEvents(): Promise<ThrottleEventsResponse> {
  const r = await fetchWithRetry(apiUrl('throttle-events'), { headers: headers() });
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
    /** Consumi (30d) solo utenti con plan PRO al momento della query */
    credits_consumed_30d_pro: number;
    /** Consumi (30d) solo utenti FREE */
    credits_consumed_30d_free: number;
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
  plan_filter?: 'PRO' | 'FREE' | null;
  kimi_note?: string | null;
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
  /** Cooldown 12h: se impostato, la CTA Ricarica è disabilitata fino a 12h dopo questa data */
  last_admin_recharge_at: string | null;
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
  /** Filtra per piano utente corrente in DB (PRO / FREE) */
  plan?: 'PRO' | 'FREE';
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
  if (filters?.plan === 'PRO' || filters?.plan === 'FREE') params.plan = filters.plan;
  const r = await fetchWithRetry(apiUrl('function-executions', params), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export async function fetchExecutionsUsers(
  dateFrom?: string,
  dateTo?: string,
  country?: string,
  plan?: 'PRO' | 'FREE'
): Promise<ExecutionsUsersResponse> {
  const params: Record<string, string> = {};
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;
  if (country && country.trim()) params.country = country.trim().toUpperCase().slice(0, 2);
  if (plan === 'PRO' || plan === 'FREE') params.plan = plan;
  const r = await fetchWithRetry(apiUrl('executions-users', params), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

// --- Codici sconto (livello gamification + throttle 5%)
export interface DiscountsStats {
  level: { total: number; by_level: { 5: number; 10: number; 15: number; 20: number } };
  throttle: { total: number; valid: number; expired: number };
}

export async function fetchDiscountsStats(): Promise<DiscountsStats> {
  const r = await fetchWithRetry(apiUrl('discounts-stats'), { headers: headers() });
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
  const r = await fetchWithRetry(apiUrl('discounts-level', params), { headers: headers() });
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
  const r = await fetchWithRetry(apiUrl('discounts-throttle', params), { headers: headers() });
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
  by_kimi_model: {
    kimi_model: string;
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
    kimi_model: string | null;
    generation_route: string | null;
    input_tokens: number;
    output_tokens: number;
    credits_consumed: number;
    latency_ms: number | null;
    created_at: string;
    feedback_thumbs: string | null;
    feedback_comment: string | null;
  }[];
  timeline: {
    date: string;
    A: { count: number; credits: number };
    B: { count: number; credits: number };
    S?: { count: number; credits: number };
  }[];
}

export async function fetchGenerateABStats(period = 30): Promise<GenerateABStatsResponse> {
  const r = await fetchWithRetry(apiUrl('generate-ab-stats', { period }), { headers: headers() });
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
  const r = await fetchWithRetry(apiUrl('support-feedback', { limit }), { headers: headers() });
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
  const r = await fetchWithRetry(apiUrl('plugin-logs', { limit }), { headers: headers() });
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
  const r = await fetchWithRetry(apiUrl('brand-awareness', { period, limit, offset }), { headers: headers() });
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
  const r = await fetchWithRetry(apiUrl('touchpoint-funnel', { period }), { headers: headers() });
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
  const r = await fetchWithRetry(`${BASE}/api/doc-content`, { headers: headers() });
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

// --- Notion: fonti per migliorie prodotto (ruleset / docs)
export interface NotionProductSourcesLink {
  url: string;
  contexts: string[];
}

export interface NotionProductSourcesResponse {
  ok: boolean;
  mode: 'page' | 'database';
  sourceId: string;
  linkCount: number;
  linkedinEnriched?: number;
  enrichLinkedInRequested?: boolean;
  /** Fetch web + strategia Fase 2 (checkbox / body). */
  fetchWebRequested?: boolean;
  webEnriched?: number;
  includeDocSnapshotRequested?: boolean;
  includeLlmSynthesisRequested?: boolean;
  llmSynthesisChars?: number;
  docSnapshot?: {
    skipped?: boolean;
    skipReason?: string;
    truncated?: boolean;
    sourceCount?: number;
    okCount?: number;
  } | null;
  links: NotionProductSourcesLink[];
  markdown: string;
  stats: {
    ignoredBlocks: number;
    blockOrPageCount?: number;
  };
}

export async function scanNotionProductSources(body: {
  pageId?: string;
  databaseId?: string;
  ignoreTokens?: string[];
  /** Chiama Apify sui post LinkedIn (lenta; stessi env del cron). */
  enrichLinkedIn?: boolean;
  /** Fetch HTTP + strategia tipo URL (Fase 1 bis–2; stessi limiti env del cron). */
  fetchWeb?: boolean;
  /** Snapshot rules/docs plugin (Fase 4). */
  includeDocSnapshot?: boolean;
  /** Sintesi LLM nel report (Fase 5; richiede env `PRODUCT_SOURCES_LLM_SYNTHESIS=1` + key). */
  includeLlmSynthesis?: boolean;
}): Promise<NotionProductSourcesResponse> {
  const r = await fetch(`${BASE}/api/notion-product-sources`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error((data as { error?: string }).error || `Errore ${r.status}`);
  }
  return data as NotionProductSourcesResponse;
}

// --- Storico cron fonti prodotto (report Markdown + stato Discord/Git)
export interface ProductSourcesRunRow {
  id: number;
  ran_at: string;
  status: string;
  skipped: boolean;
  link_count: number | null;
  linkedin_urls_attempted: number | null;
  linkedin_items_returned: number | null;
  notion_mode: string | null;
  notion_source_id: string | null;
  error_message: string | null;
  discord_notified?: boolean;
  github_sync_status?: string;
  github_pr_url?: string | null;
  github_updated_at?: string | null;
  github_error?: string | null;
  markdown_preview?: string;
  report_markdown?: string | null;
}

export async function fetchProductSourcesRuns(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ ok: boolean; runs: ProductSourcesRunRow[]; total: number; limit: number; offset: number }> {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set('limit', String(params.limit));
  if (params?.offset != null) q.set('offset', String(params.offset));
  const r = await fetchWithRetry(`${BASE}/api/product-sources-runs?${q}`, { headers: headers() });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error((data as { error?: string }).error || `Errore ${r.status}`);
  }
  return data as {
    ok: boolean;
    runs: ProductSourcesRunRow[];
    total: number;
    limit: number;
    offset: number;
  };
}

export async function fetchProductSourcesRunById(
  id: number,
): Promise<{ ok: boolean; run: ProductSourcesRunRow }> {
  const r = await fetchWithRetry(`${BASE}/api/product-sources-runs?id=${encodeURIComponent(String(id))}`, {
    headers: headers(),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error((data as { error?: string }).error || `Errore ${r.status}`);
  }
  return data as { ok: boolean; run: ProductSourcesRunRow };
}

export async function productSourcesRunAction(
  runId: number,
  action: 'request_pr_stub' | 'set_pr_url' | 'reset_git',
  prUrl?: string,
): Promise<{ ok: boolean; stub?: boolean; message?: string }> {
  const body: Record<string, unknown> = { action, runId };
  if (action === 'set_pr_url' && prUrl) body.prUrl = prUrl;
  const r = await fetch(`${BASE}/api/product-sources-runs`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error((data as { error?: string }).error || `Errore ${r.status}`);
  }
  return data as { ok: boolean; stub?: boolean; message?: string };
}

// --- Coda Fase 3 (batch job fetch / LinkedIn)
export interface ProductSourcesQueueBatchRow {
  id: number;
  created_at: string;
  updated_at: string;
  status: string;
  total_jobs: number;
  completed_jobs: number;
  last_error: string | null;
  final_run_id: number | null;
  pending_jobs: number;
  running_jobs: number;
}

export async function fetchProductSourcesQueue(params?: { limit?: number }): Promise<{
  ok: boolean;
  batches: ProductSourcesQueueBatchRow[];
  migrationNeeded?: boolean;
}> {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set('limit', String(params.limit));
  const r = await fetchWithRetry(`${BASE}/api/product-sources-queue?${q}`, { headers: headers() });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error((data as { error?: string }).error || `Errore ${r.status}`);
  }
  return data as {
    ok: boolean;
    batches: ProductSourcesQueueBatchRow[];
    migrationNeeded?: boolean;
  };
}

// --- Stato “quando parte la prossima analisi profonda” (Fase 0/3/4/5/6 deep run)
export interface ProductSourcesStatusResponse {
  ok: boolean;
  serverNowMs: number;
  serverNowIso: string;
  gateDays: number;
  gateMs: number;
  lastOkRanAtMs: number | null;
  lastOkRanAtIso: string | null;
  nextAtMs: number;
  nextAtIso: string;
  remainingMs: number;
  queuePending: boolean;
  queueBatchId: number | null;
}

export async function fetchProductSourcesStatus(): Promise<ProductSourcesStatusResponse> {
  const r = await fetchWithRetry(`${BASE}/api/product-sources-status`, { headers: headers() });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error((data as { error?: string }).error || `Errore ${r.status}`);
  }
  return data as ProductSourcesStatusResponse;
}

// --- External design systems (admin managed)
export type ExternalDesignSystemStatus = 'draft' | 'published' | 'archived';

export interface ExternalDesignSystemItem {
  slug: string;
  display_name: string;
  ds_source: string;
  status: ExternalDesignSystemStatus;
  ds_package: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function fetchExternalDesignSystems(): Promise<{ items: ExternalDesignSystemItem[] }> {
  const r = await fetchWithRetry(`${BASE}/api/external-design-systems`, { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export async function upsertExternalDesignSystem(body: {
  slug: string;
  display_name: string;
  ds_source: string;
  status: ExternalDesignSystemStatus;
  ds_package: Record<string, unknown>;
}): Promise<{ ok: boolean; slug: string; status: ExternalDesignSystemStatus }> {
  const r = await fetch(`${BASE}/api/external-design-systems`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error((data as { error?: string }).error || `Errore ${r.status}`);
  }
  return data as { ok: boolean; slug: string; status: ExternalDesignSystemStatus };
}

// --- Generate conversational threads (same DB as plugin; Phase 4 hub §8)
export interface AdminGenerateThreadRow {
  id: string;
  user_id: string;
  file_key: string;
  ds_cache_hash: string;
  title: string | null;
  updated_at_ms: number;
  message_count: number;
}

export async function fetchAdminGenerateThreads(options?: {
  q?: string;
  limit?: number;
}): Promise<{ threads: AdminGenerateThreadRow[] }> {
  const params: Record<string, string | number> = { limit: options?.limit ?? 80 };
  if (options?.q?.trim()) params.q = options.q.trim().slice(0, 200);
  const r = await fetchWithRetry(apiUrl('generate-threads', params), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export interface AdminGenerateThreadMessageRow {
  id: string;
  role: string;
  message_type: string | null;
  content_json: Record<string, unknown> | null;
  credit_estimate: number | null;
  credit_consumed: number | null;
  created_at_ms: number;
}

export async function fetchAdminGenerateThreadMessages(
  threadId: string
): Promise<{ messages: AdminGenerateThreadMessageRow[] }> {
  const r = await fetchWithRetry(
    apiUrl('generate-thread-messages', { thread_id: threadId }),
    { headers: headers() }
  );
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export async function fetchAdminGeneratePluginAnalytics(days?: number): Promise<{
  period_days: number;
  generation_plugin_events: Array<{ event_type: string; cnt: number }>;
  threads_touched: number;
  messages_created: number;
}> {
  const params: Record<string, string | number> = {};
  if (days != null && Number.isFinite(days)) params.days = Math.floor(days);
  const r = await fetchWithRetry(apiUrl('generate-plugin-analytics', params), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export interface GeneratePlaybookRow {
  id: string;
  title: string;
  body: string;
  updated_at_ms?: number;
}

export async function fetchGenerateGovernance(): Promise<{
  playbooks: GeneratePlaybookRow[];
  tov: { prompt_overrides: Record<string, unknown> };
}> {
  const r = await fetchWithRetry(`${BASE}/api/generate-governance`, { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export async function postGenerateGovernance(body: {
  action: 'create_playbook' | 'delete_playbook' | 'save_tov';
  title?: string;
  body?: string;
  id?: string;
  prompt_overrides?: Record<string, unknown>;
}): Promise<{ ok?: boolean; id?: string; error?: string }> {
  const r = await fetch(`${BASE}/api/generate-governance`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error || `Errore ${r.status}`);
  return data as { ok: boolean; id?: string };
}

// --- UI Corpus (ingestion + curation for Generate references)
export interface UICorpusItem {
  id: string;
  source_kind: string;
  source_license: string;
  source_url: string | null;
  title: string | null;
  archetype: string;
  platform: string;
  locale: string | null;
  quality_score: number | null;
  status: 'draft' | 'approved' | 'rejected' | 'archived';
  tags: string[];
  sections: string[];
  anti_patterns: string[];
  keywords: string[];
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UICorpusListResponse {
  items: UICorpusItem[];
  total: number;
  limit: number;
  offset: number;
  migration_needed?: boolean;
  stats: {
    by_status: Array<{ status: string; c: number }>;
    top_archetypes: Array<{ archetype: string; c: number }>;
  };
}

function uiCorpusUrl(params?: Record<string, string | number>) {
  const q = new URLSearchParams(
    params
      ? Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
      : {},
  );
  return `${BASE}/api/ui-corpus${q.toString() ? `?${q}` : ''}`;
}

export async function fetchUICorpus(params?: {
  q?: string;
  status?: 'draft' | 'approved' | 'rejected' | 'archived' | '';
  archetype?: string;
  limit?: number;
  offset?: number;
}): Promise<UICorpusListResponse> {
  const p: Record<string, string | number> = {};
  if (params?.q?.trim()) p.q = params.q.trim();
  if (params?.status) p.status = params.status;
  if (params?.archetype?.trim()) p.archetype = params.archetype.trim().toLowerCase();
  if (params?.limit != null) p.limit = Math.floor(params.limit);
  if (params?.offset != null) p.offset = Math.floor(params.offset);
  const r = await fetchWithRetry(uiCorpusUrl(p), { headers: headers() });
  if (!r.ok) throw new Error(r.status === 401 ? 'Non autorizzato' : `Errore ${r.status}`);
  return r.json();
}

export async function ingestUICorpusExample(example: {
  title?: string;
  source_url?: string;
  figma_url?: string;
  prompt_summary?: string;
  notes?: string;
  archetype?: string;
  platform?: string;
  locale?: string;
  quality_score?: number;
  tags?: string[];
  sections?: string[];
  anti_patterns?: string[];
  keywords?: string[];
  metadata?: Record<string, unknown>;
  source_kind?: string;
  source_license?: string;
}): Promise<{ ok: boolean; item?: { id: string } }> {
  const r = await fetch(uiCorpusUrl(), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ action: 'ingest_example', example }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error || `Errore ${r.status}`);
  return data as { ok: boolean; item?: { id: string } };
}

export async function ingestUICorpusBatch(
  examples: Array<Record<string, unknown>>,
): Promise<{ ok: boolean; inserted: number }> {
  const r = await fetch(uiCorpusUrl(), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ action: 'ingest_batch', examples }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error || `Errore ${r.status}`);
  return data as { ok: boolean; inserted: number };
}

export async function setUICorpusStatus(
  id: string,
  status: 'draft' | 'approved' | 'rejected' | 'archived',
): Promise<{ ok: boolean }> {
  const r = await fetch(uiCorpusUrl(), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ action: 'set_status', id, status }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error || `Errore ${r.status}`);
  return data as { ok: boolean };
}
