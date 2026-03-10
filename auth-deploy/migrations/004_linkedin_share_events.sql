-- Brand awareness: click "Share on LinkedIn" per trofeo (dashboard Brand awareness)
-- Esegui dopo 003_support_tickets.sql

CREATE TABLE IF NOT EXISTS linkedin_share_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trophy_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_linkedin_share_events_user_id ON linkedin_share_events(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_share_events_trophy_id ON linkedin_share_events(trophy_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_share_events_created_at ON linkedin_share_events(created_at);
