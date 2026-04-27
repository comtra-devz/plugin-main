-- Persist latest Deep Sync scan result per user/file/storybook.
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
