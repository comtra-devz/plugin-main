-- A/B test Generate: Direct (A) vs ASCII wireframe first (B)
-- Esegui dopo schema.sql principale.

CREATE TABLE IF NOT EXISTS generate_ab_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('A', 'B')),
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  credits_consumed INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generate_ab_requests_variant ON generate_ab_requests(variant);
CREATE INDEX IF NOT EXISTS idx_generate_ab_requests_created_at ON generate_ab_requests(created_at);

-- Feedback utente (thumbs up/down + commento opzionale)
CREATE TABLE IF NOT EXISTS generate_ab_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES generate_ab_requests(id) ON DELETE CASCADE,
  variant TEXT NOT NULL CHECK (variant IN ('A', 'B')),
  thumbs TEXT NOT NULL CHECK (thumbs IN ('up', 'down')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generate_ab_feedback_request_id ON generate_ab_feedback(request_id);
CREATE INDEX IF NOT EXISTS idx_generate_ab_feedback_variant ON generate_ab_feedback(variant);
