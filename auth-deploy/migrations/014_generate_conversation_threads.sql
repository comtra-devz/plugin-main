-- Conversational Generate: thread storage (file_key + ds_cache_hash scope)

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
