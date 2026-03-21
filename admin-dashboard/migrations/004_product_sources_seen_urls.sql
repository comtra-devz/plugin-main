-- URL già "esaminati" nelle run cron (dedup persistente; chiave = normalizzazione come in codice).
-- Stesso database di product_sources_cron_runs (POSTGRES_URL).

CREATE TABLE IF NOT EXISTS product_sources_seen_urls (
  url_key TEXT PRIMARY KEY,
  url_sample TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_sources_seen_urls_last_seen
  ON product_sources_seen_urls (last_seen_at DESC);
