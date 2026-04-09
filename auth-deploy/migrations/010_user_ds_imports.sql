-- DS context index per user + Figma file (Generate / custom design system)
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
