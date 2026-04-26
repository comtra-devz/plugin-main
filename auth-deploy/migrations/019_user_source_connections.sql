-- Source repository connection for Storybook Sync All.
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

