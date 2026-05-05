-- Product Memory Layer foundations (Phase 3A/3B/3C groundwork).
-- Safe to run after 024_ui_corpus_examples.sql.

ALTER TABLE ui_corpus_examples
  ADD COLUMN IF NOT EXISTS project_id text,
  ADD COLUMN IF NOT EXISTS project_name text,
  ADD COLUMN IF NOT EXISTS site_domain text,
  ADD COLUMN IF NOT EXISTS brand_key text,
  ADD COLUMN IF NOT EXISTS design_system_id text,
  ADD COLUMN IF NOT EXISTS ds_state text NOT NULL DEFAULT 'unknown'
    CHECK (ds_state IN ('connected', 'inferred', 'unknown', 'none'));

CREATE INDEX IF NOT EXISTS idx_ui_corpus_examples_project_id ON ui_corpus_examples(project_id);
CREATE INDEX IF NOT EXISTS idx_ui_corpus_examples_site_domain ON ui_corpus_examples(site_domain);
CREATE INDEX IF NOT EXISTS idx_ui_corpus_examples_brand_key ON ui_corpus_examples(brand_key);
CREATE INDEX IF NOT EXISTS idx_ui_corpus_examples_design_system_id ON ui_corpus_examples(design_system_id);
CREATE INDEX IF NOT EXISTS idx_ui_corpus_examples_ds_state ON ui_corpus_examples(ds_state);

-- Screen Vocabulary: per-file memory of existing screens and signatures.
CREATE TABLE IF NOT EXISTS product_screen_vocabulary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  figma_file_key text NOT NULL,
  frame_node_id text NOT NULL,
  frame_name text,
  archetype text NOT NULL,
  slot_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  navigation_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  visual_signature jsonb NOT NULL DEFAULT '{}'::jsonb,
  ds_compliance_score numeric(5,2),
  source text NOT NULL DEFAULT 'ds_import',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (figma_file_key, frame_node_id)
);

CREATE INDEX IF NOT EXISTS idx_product_screen_vocab_file ON product_screen_vocabulary(figma_file_key);
CREATE INDEX IF NOT EXISTS idx_product_screen_vocab_archetype ON product_screen_vocabulary(archetype);
CREATE INDEX IF NOT EXISTS idx_product_screen_vocab_updated ON product_screen_vocabulary(updated_at DESC);

-- Decision History aggregate: per-file preference profile learned from feedback/signals.
CREATE TABLE IF NOT EXISTS product_preference_profiles (
  figma_file_key text PRIMARY KEY,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  signals_count integer NOT NULL DEFAULT 0,
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Cross-screen consistency snapshots for diagnostics/history.
CREATE TABLE IF NOT EXISTS product_consistency_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  figma_file_key text NOT NULL,
  contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  coverage_score numeric(5,2),
  source_screen_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_consistency_file ON product_consistency_snapshots(figma_file_key);
CREATE INDEX IF NOT EXISTS idx_product_consistency_created ON product_consistency_snapshots(created_at DESC);

