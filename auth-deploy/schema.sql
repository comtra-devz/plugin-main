-- Comtra credits, affiliates, gamification (XP/livelli)
-- Run once (e.g. Vercel Postgres dashboard o Supabase SQL Editor).
-- Se la tabella users esiste già senza total_xp/current_level, esegui prima:
--   ALTER TABLE users ADD COLUMN IF NOT EXISTS total_xp INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE users ADD COLUMN IF NOT EXISTS current_level INTEGER NOT NULL DEFAULT 1;
--   ALTER TABLE users ADD COLUMN IF NOT EXISTS level_rewards JSONB;

-- id = chiave Comtra: Figma id (OAuth classico) oppure comtra_* (magic link). figma_user_id = id account Figma quando collegato.
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT,
    name TEXT,
    img_url TEXT,
    figma_user_id TEXT,
  plan TEXT NOT NULL DEFAULT 'FREE',
  plan_expires_at TIMESTAMPTZ,
  credits_total INTEGER NOT NULL DEFAULT 25,
  credits_used INTEGER NOT NULL DEFAULT 0,
  total_xp INTEGER NOT NULL DEFAULT 0,
  current_level INTEGER NOT NULL DEFAULT 1,
  level_rewards JSONB,
  tags JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- credits_remaining is always computed server-side as (credits_total - credits_used)
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  credits_consumed INTEGER NOT NULL,
  file_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at);

-- Affiliates: referrer = user_id (Figma), codice univoco, metriche
CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  affiliate_code TEXT NOT NULL UNIQUE,
  lemon_affiliate_id TEXT,
  total_referrals INTEGER NOT NULL DEFAULT 0,
  total_earnings_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliates_user_id ON affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_affiliate_code ON affiliates(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_affiliates_lemon_id ON affiliates(lemon_affiliate_id);

-- Figma OAuth tokens (for REST API: GET /v1/files/:key). Required for pipeline to agents.
CREATE TABLE IF NOT EXISTS figma_tokens (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- XP e livelli (gamification)
CREATE TABLE IF NOT EXISTS xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  xp_earned INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xp_transactions_user_id ON xp_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_created_at ON xp_transactions(created_at);

-- Trofei (Trophy Case): definizioni + sblocchi per utente
CREATE TABLE IF NOT EXISTS trophies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  unlock_condition JSONB NOT NULL,
  icon_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_trophies (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trophy_id TEXT NOT NULL REFERENCES trophies(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, trophy_id)
);

CREATE INDEX IF NOT EXISTS idx_user_trophies_user_id ON user_trophies(user_id);

-- Codici sconto livello (gamification): un codice univoco per utente, creato via API Lemon Squeezy
CREATE TABLE IF NOT EXISTS user_level_discounts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level IN (5, 10, 15, 20)),
  lemon_discount_id TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id)
);
CREATE INDEX IF NOT EXISTS idx_user_level_discounts_user_id ON user_level_discounts(user_id);

-- Brand awareness: click su "Share on LinkedIn" per trofeo (email celata in dashboard)
CREATE TABLE IF NOT EXISTS linkedin_share_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trophy_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_linkedin_share_events_user_id ON linkedin_share_events(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_share_events_trophy_id ON linkedin_share_events(trophy_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_share_events_created_at ON linkedin_share_events(created_at);

-- Colonne aggiuntive users per condizioni trofei (max_health_score, fix consecutivi, linkedin, ecc.)
-- Migrazione: ALTER TABLE users ADD COLUMN IF NOT EXISTS max_health_score INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS fixes_accepted_total INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS consecutive_fixes INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS token_fixes_total INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS bug_reports_total INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_shared BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE users ADD COLUMN IF NOT EXISTS max_health_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fixes_accepted_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS consecutive_fixes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_fixes_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bug_reports_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_shared BOOLEAN NOT NULL DEFAULT false;
-- Level discounts lifecycle:
-- - locked_until_renewal=true after a discounted purchase (must wait next paid renewal to use another discount)
-- - reset to false on next paid cycle without discount
ALTER TABLE users ADD COLUMN IF NOT EXISTS level_discount_locked_until_renewal BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS level_discount_used_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS level_discount_used_code TEXT;

-- Seed of 20 trophies (id, name, description in English, unlock_condition, icon_id, sort_order)
INSERT INTO trophies (id, name, description, unlock_condition, icon_id, sort_order) VALUES
  ('NOVICE_SPROUT', 'Novice Sprout', 'First action completed (any).', '{"type":"xp_min","value":1}', 'SPROUT', 1),
  ('SOLID_ROCK', 'Solid Rock', '10 audits completed.', '{"type":"audits_min","value":10}', 'ROCK', 2),
  ('IRON_FRAME', 'Iron Frame', '50 wireframes generated.', '{"type":"wireframes_gen_min","value":50}', 'IRON', 3),
  ('BRONZE_AUDITOR', 'Bronze Auditor', '100 audits completed.', '{"type":"audits_min","value":100}', 'BRONZE', 4),
  ('DIAMOND_PARSER', 'Diamond Parser', 'Health Score 95%+ on a file.', '{"type":"health_min","value":95}', 'DIAMOND', 5),
  ('SILVER_SURFER', 'Silver Surfer', '500 total XP earned.', '{"type":"xp_min","value":500}', 'SILVER', 6),
  ('GOLDEN_STANDARD', 'Golden Standard', '50 consecutive fixes accepted without dismissing.', '{"type":"consecutive_fixes_min","value":50}', 'GOLD', 7),
  ('PLATINUM_PRODUCER', 'Platinum Producer', '2,000 total XP earned.', '{"type":"xp_min","value":2000}', 'PLATINUM', 8),
  ('OBSIDIAN_MODE', 'Obsidian Mode', '100 proto scans completed.', '{"type":"proto_scans_min","value":100}', 'OBSIDIAN', 9),
  ('PIXEL_PERFECT', 'Pixel Perfect', 'Health Score 100% on a file.', '{"type":"health_min","value":100}', 'PIXEL', 10),
  ('TOKEN_MASTER', 'Token Master', '200 tokens/variables fixed via audit.', '{"type":"token_fixes_min","value":200}', 'TOKEN', 11),
  ('SYSTEM_LORD', 'System Lord', '5,000 total XP earned.', '{"type":"xp_min","value":5000}', 'SYSTEM', 12),
  ('BUG_HUNTER', 'Bug Hunter', '50 bug/error reports submitted.', '{"type":"bug_reports_min","value":50}', 'BUG', 13),
  ('THE_FIXER', 'The Fixer', '500 total fixes accepted.', '{"type":"fixes_accepted_min","value":500}', 'FIXER', 14),
  ('SPEED_DEMON', 'Speed Demon', '10 audits completed in a single day.', '{"type":"audits_today_min","value":10}', 'SPEED', 15),
  ('HARMONIZER', 'Harmonizer', 'Used all 3 sync targets (Storybook + GitHub + Bitbucket).', '{"type":"all_syncs_used"}', 'HARMONY', 16),
  ('SOCIALITE', 'Socialite', 'Shared profile on LinkedIn.', '{"type":"linkedin_shared"}', 'SOCIAL', 17),
  ('INFLUENCER', 'Influencer', '5 successful affiliate referrals.', '{"type":"affiliate_referrals_min","value":5}', 'INFLUENCER', 18),
  ('DESIGN_LEGEND', 'Design Legend', '10,000 total XP earned.', '{"type":"xp_min","value":10000}', 'LEGEND', 19),
  ('GOD_MODE', 'God Mode', 'All other 19 trophies unlocked.', '{"type":"all_other_trophies"}', 'GOD', 20)
ON CONFLICT (id) DO NOTHING;

-- Telemetria uso token Kimi (anonima: nessun user_id/file_key). Vedi docs/TOKEN-USAGE-TELEMETRY.md
CREATE TABLE IF NOT EXISTS kimi_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  size_band TEXT,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kimi_usage_log_action_created ON kimi_usage_log(action_type, created_at);
CREATE INDEX IF NOT EXISTS idx_kimi_usage_log_created_at ON kimi_usage_log(created_at);

-- Provenienza utente (paese da IP, header Vercel x-vercel-ip-country). Non salviamo l'IP, solo il codice paese 2 lettere.
ALTER TABLE users ADD COLUMN IF NOT EXISTS country_code TEXT;
CREATE INDEX IF NOT EXISTS idx_users_country_code ON users(country_code);

-- Throttle/503: eventi per dashboard + codice sconto 5% (una tantum, valido 1 settimana)
CREATE TABLE IF NOT EXISTS throttle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_throttle_events_user_id ON throttle_events(user_id);
CREATE INDEX IF NOT EXISTS idx_throttle_events_occurred_at ON throttle_events(occurred_at);

-- Codice sconto 5% per utente che ha subito 503/throttle (una tantum)
CREATE TABLE IF NOT EXISTS user_throttle_discounts (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  lemon_discount_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_throttle_discounts_issued_at ON user_throttle_discounts(issued_at);

-- A/B test Generate: arm A vs B (random 50/50 chat models); variant S kept for legacy rows
CREATE TABLE IF NOT EXISTS generate_ab_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('A', 'B', 'S')),
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  credits_consumed INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  figma_file_key TEXT,
  ds_source TEXT,
  inferred_screen_archetype TEXT,
  inferred_pack_v2_archetype TEXT,
  kimi_enrichment_used BOOLEAN NOT NULL DEFAULT false,
  learning_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  kimi_model TEXT,
  generation_route TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_generate_ab_requests_variant ON generate_ab_requests(variant);
CREATE INDEX IF NOT EXISTS idx_generate_ab_requests_created_at ON generate_ab_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_generate_ab_requests_kimi_model ON generate_ab_requests(kimi_model);
CREATE INDEX IF NOT EXISTS idx_generate_ab_requests_generation_route ON generate_ab_requests(generation_route);

CREATE TABLE IF NOT EXISTS generate_ab_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES generate_ab_requests(id) ON DELETE CASCADE,
  variant TEXT NOT NULL CHECK (variant IN ('A', 'B', 'S')),
  thumbs TEXT NOT NULL CHECK (thumbs IN ('up', 'down')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_generate_ab_feedback_request_id ON generate_ab_feedback(request_id);
CREATE INDEX IF NOT EXISTS idx_generate_ab_feedback_variant ON generate_ab_feedback(variant);

CREATE INDEX IF NOT EXISTS idx_generate_ab_requests_file ON generate_ab_requests (figma_file_key);

CREATE TABLE IF NOT EXISTS generation_plugin_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  request_id UUID REFERENCES generate_ab_requests (id) ON DELETE SET NULL,
  figma_file_key TEXT,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_generation_plugin_events_user_created ON generation_plugin_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_plugin_events_type ON generation_plugin_events (event_type);

-- Generate conversational UX: threads + messages (scope: user + file_key + ds_cache_hash)
CREATE TABLE IF NOT EXISTS generate_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_key TEXT NOT NULL,
  ds_cache_hash TEXT NOT NULL DEFAULT '',
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_generate_threads_user_scope
  ON generate_threads (user_id, file_key, ds_cache_hash);
CREATE INDEX IF NOT EXISTS idx_generate_threads_user_updated
  ON generate_threads (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS generate_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES generate_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  message_type TEXT NOT NULL DEFAULT 'chat'
    CHECK (message_type IN ('chat', 'reasoning_summary', 'action_result', 'error')),
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  credit_estimate INTEGER,
  credit_consumed INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_generate_messages_thread_created
  ON generate_messages (thread_id, created_at);

-- Funnel touchpoint: Landing, Plugin, LinkedIn, Instagram, TikTok (ingressi e conversioni)
CREATE TABLE IF NOT EXISTS touchpoint_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('landing', 'plugin', 'linkedin', 'instagram', 'tiktok')),
  event_type TEXT NOT NULL CHECK (event_type IN ('visit', 'click', 'signup', 'usage', 'upgrade')),
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_touchpoint_events_source ON touchpoint_events(source);
CREATE INDEX IF NOT EXISTS idx_touchpoint_events_created_at ON touchpoint_events(created_at);

CREATE TABLE IF NOT EXISTS user_attribution (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('landing', 'plugin', 'linkedin', 'instagram', 'tiktok')),
  first_touch_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_attribution_source ON user_attribution(source);
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_source TEXT CHECK (signup_source IN ('landing', 'plugin', 'linkedin', 'instagram', 'tiktok'));

-- Support tickets from Documentation & Help (plugin)
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('BUG', 'FEATURE', 'LOVE', 'AUDIT')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at);

-- Generate: snapshot indice design system (plugin) per utente e file Figma
CREATE TABLE IF NOT EXISTS user_ds_imports (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  figma_file_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  figma_file_name TEXT NOT NULL DEFAULT '',
  ds_cache_hash TEXT NOT NULL DEFAULT '',
  ds_context_index JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, figma_file_key)
);
CREATE INDEX IF NOT EXISTS idx_user_ds_imports_user_updated ON user_ds_imports(user_id, updated_at DESC);

-- Code Sync: source repository that builds a connected Storybook.
CREATE TABLE IF NOT EXISTS user_source_connections (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  figma_file_key TEXT NOT NULL,
  storybook_url TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('github', 'bitbucket', 'gitlab', 'custom')),
  repo_url TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  storybook_path TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'needs_auth', 'connected_manual', 'scan_failed', 'ready')),
  auth_status TEXT NOT NULL DEFAULT 'needs_auth' CHECK (auth_status IN ('not_configured', 'needs_auth', 'connected')),
  source_access_token TEXT,
  scan_result JSONB,
  last_scanned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, figma_file_key, storybook_url)
);
CREATE INDEX IF NOT EXISTS idx_user_source_connections_user_updated
  ON user_source_connections(user_id, updated_at DESC);

-- Persist latest Deep Sync drift result for fast restore.
CREATE TABLE IF NOT EXISTS user_sync_scans (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  figma_file_key TEXT NOT NULL,
  storybook_url TEXT NOT NULL,
  items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, figma_file_key, storybook_url)
);

CREATE INDEX IF NOT EXISTS idx_user_sync_scans_user_updated
  ON user_sync_scans(user_id, updated_at DESC);

-- External DS catalog (admin managed): source of dynamic dropdown options + ds_package payload.
CREATE TABLE IF NOT EXISTS external_design_systems (
  slug TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  ds_source TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  ds_package JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_external_design_systems_status_updated
  ON external_design_systems(status, updated_at DESC);

-- Generate: playbooks (riuso prompt) + config ToV lato server (admin, §8.2)
CREATE TABLE IF NOT EXISTS generate_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_generate_playbooks_updated ON generate_playbooks (updated_at DESC);

CREATE TABLE IF NOT EXISTS generate_tov_config (
  singleton TEXT PRIMARY KEY CHECK (singleton = 'default'),
  prompt_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migrazione: se la tabella users esiste già senza colonne XP, esegui (PostgreSQL 9.5+):
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS total_xp INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS current_level INTEGER NOT NULL DEFAULT 1;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS level_rewards JSONB;
