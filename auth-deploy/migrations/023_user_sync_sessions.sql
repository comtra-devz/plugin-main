-- Deep Sync: AI reconcile session + PR payloads (per doc comtra-deep-sync-plan)
CREATE TABLE IF NOT EXISTS user_sync_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  figma_file_key TEXT NOT NULL,
  storybook_url TEXT NOT NULL,
  repo_provider TEXT NOT NULL,
  repo_url TEXT NOT NULL,
  repo_branch TEXT NOT NULL DEFAULT 'main',
  storybook_path TEXT NOT NULL DEFAULT '',
  pr_payloads JSONB NOT NULL DEFAULT '[]'::jsonb,
  drift_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  analysis_mode TEXT NOT NULL DEFAULT 'ai',
  reasoning_summary TEXT,
  avg_confidence DOUBLE PRECISION,
  pr_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sync_sessions_user_created
  ON user_sync_sessions(user_id, created_at DESC);
