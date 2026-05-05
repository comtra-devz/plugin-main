-- UI corpus for Generate retrieval/learning loop.
-- Shared DB: used by admin dashboard ingestion and auth-deploy generate pipeline.

CREATE TABLE IF NOT EXISTS ui_corpus_examples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind text NOT NULL DEFAULT 'internal_figma',
  source_license text NOT NULL DEFAULT 'owned',
  source_url text,
  title text,
  archetype text NOT NULL,
  platform text NOT NULL DEFAULT 'unknown',
  locale text,
  quality_score numeric(3,2),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'rejected', 'archived')),
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  anti_patterns jsonb NOT NULL DEFAULT '[]'::jsonb,
  keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ui_corpus_examples_status ON ui_corpus_examples(status);
CREATE INDEX IF NOT EXISTS idx_ui_corpus_examples_archetype ON ui_corpus_examples(archetype);
CREATE INDEX IF NOT EXISTS idx_ui_corpus_examples_platform ON ui_corpus_examples(platform);
CREATE INDEX IF NOT EXISTS idx_ui_corpus_examples_updated_at ON ui_corpus_examples(updated_at DESC);

