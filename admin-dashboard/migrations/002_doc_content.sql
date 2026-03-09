-- Content Management: documentation (plugin Documentation & Help)
-- Esegui dopo 001_admin_users.sql. Stesso DB di auth-deploy.

CREATE TABLE IF NOT EXISTS doc_content (
  id TEXT PRIMARY KEY DEFAULT 'documentation',
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
