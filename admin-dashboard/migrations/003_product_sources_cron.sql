-- Cron "fonti prodotto": storico run Notion + LinkedIn (gate giorni configurabile via env, default 4 nel codice).
-- Stesso database delle altre tabelle admin (POSTGRES_URL sul progetto Vercel dashboard).

CREATE TABLE IF NOT EXISTS product_sources_cron_runs (
  id BIGSERIAL PRIMARY KEY,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'ok',
  skipped BOOLEAN NOT NULL DEFAULT false,
  link_count INT,
  linkedin_urls_attempted INT,
  linkedin_items_returned INT,
  notion_mode TEXT,
  notion_source_id TEXT,
  error_message TEXT,
  report_markdown TEXT
);

CREATE INDEX IF NOT EXISTS idx_product_sources_cron_runs_ran_at
  ON product_sources_cron_runs (ran_at DESC);
