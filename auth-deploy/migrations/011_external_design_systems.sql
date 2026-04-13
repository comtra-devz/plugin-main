-- External design systems managed from admin portal.
CREATE TABLE IF NOT EXISTS external_design_systems (
  slug TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  ds_source TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  ds_package JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_external_design_systems_status_updated
  ON external_design_systems(status, updated_at DESC);
