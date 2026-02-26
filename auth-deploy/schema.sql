-- Comtra credits, affiliates, gamification (XP/livelli)
-- Run once (e.g. Vercel Postgres dashboard o Supabase SQL Editor).
-- Se la tabella users esiste già senza total_xp/current_level, esegui prima:
--   ALTER TABLE users ADD COLUMN IF NOT EXISTS total_xp INTEGER NOT NULL DEFAULT 0;
--   ALTER TABLE users ADD COLUMN IF NOT EXISTS current_level INTEGER NOT NULL DEFAULT 1;
--   ALTER TABLE users ADD COLUMN IF NOT EXISTS level_rewards JSONB;

-- id = Figma user id (from OAuth)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT,
  name TEXT,
  img_url TEXT,
  plan TEXT NOT NULL DEFAULT 'FREE',
  plan_expires_at TIMESTAMPTZ,
  credits_total INTEGER NOT NULL DEFAULT 25,
  credits_used INTEGER NOT NULL DEFAULT 0,
  total_xp INTEGER NOT NULL DEFAULT 0,
  current_level INTEGER NOT NULL DEFAULT 1,
  level_rewards JSONB,
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

-- Migrazione: se la tabella users esiste già senza colonne XP, esegui (PostgreSQL 9.5+):
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS total_xp INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS current_level INTEGER NOT NULL DEFAULT 1;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS level_rewards JSONB;
