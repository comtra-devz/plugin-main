-- Funnel touchpoint: Landing, Plugin, LinkedIn, Instagram, TikTok
-- Tracciamento ingressi e conversioni da tutti i touchpoint

-- Eventi generici da qualsiasi touchpoint (visit, click, signup, ecc.)
CREATE TABLE IF NOT EXISTS touchpoint_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('landing', 'plugin', 'linkedin', 'instagram', 'tiktok')),
  event_type TEXT NOT NULL CHECK (event_type IN ('visit', 'click', 'signup', 'usage', 'upgrade')),
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_touchpoint_events_source ON touchpoint_events(source);
CREATE INDEX IF NOT EXISTS idx_touchpoint_events_event_type ON touchpoint_events(event_type);
CREATE INDEX IF NOT EXISTS idx_touchpoint_events_user_id ON touchpoint_events(user_id);
CREATE INDEX IF NOT EXISTS idx_touchpoint_events_created_at ON touchpoint_events(created_at);

-- Attribuzione user: quale touchpoint ha portato l'utente (first-touch)
-- Popolato quando signup o quando si riceve tracking dalla landing
CREATE TABLE IF NOT EXISTS user_attribution (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('landing', 'plugin', 'linkedin', 'instagram', 'tiktok')),
  first_touch_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_attribution_source ON user_attribution(source);

-- Colonna opzionale su users per retrocompatibilità (se non c'è user_attribution)
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_source TEXT CHECK (signup_source IN ('landing', 'plugin', 'linkedin', 'instagram', 'tiktok'));
