-- §8.2 — Prompt library (playbooks) + ToV/policy overrides storage (admin dashboard).

CREATE TABLE IF NOT EXISTS generate_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generate_playbooks_updated ON generate_playbooks (updated_at DESC);

CREATE TABLE IF NOT EXISTS generate_tov_config (
  singleton TEXT PRIMARY KEY CHECK (singleton = 'default'),
  prompt_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO generate_tov_config (singleton) VALUES ('default') ON CONFLICT DO NOTHING;
