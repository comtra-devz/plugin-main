-- Design Intelligence v2: learning snapshot on generate + plugin telemetry + variant S for dual pipeline.

ALTER TABLE generate_ab_requests DROP CONSTRAINT IF EXISTS generate_ab_requests_variant_check;
ALTER TABLE generate_ab_requests
  ADD CONSTRAINT generate_ab_requests_variant_check CHECK (variant IN ('A', 'B', 'S'));

ALTER TABLE generate_ab_feedback DROP CONSTRAINT IF EXISTS generate_ab_feedback_variant_check;
ALTER TABLE generate_ab_feedback
  ADD CONSTRAINT generate_ab_feedback_variant_check CHECK (variant IN ('A', 'B', 'S'));

ALTER TABLE generate_ab_requests
  ADD COLUMN IF NOT EXISTS figma_file_key TEXT,
  ADD COLUMN IF NOT EXISTS ds_source TEXT,
  ADD COLUMN IF NOT EXISTS inferred_screen_archetype TEXT,
  ADD COLUMN IF NOT EXISTS inferred_pack_v2_archetype TEXT,
  ADD COLUMN IF NOT EXISTS kimi_enrichment_used BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS learning_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

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
