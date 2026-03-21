-- Stato notifica Discord e sync Git/PR per ogni run cron fonti prodotto.

ALTER TABLE product_sources_cron_runs
  ADD COLUMN IF NOT EXISTS discord_notified BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE product_sources_cron_runs
  ADD COLUMN IF NOT EXISTS github_sync_status TEXT NOT NULL DEFAULT 'not_sent';

ALTER TABLE product_sources_cron_runs
  ADD COLUMN IF NOT EXISTS github_pr_url TEXT;

ALTER TABLE product_sources_cron_runs
  ADD COLUMN IF NOT EXISTS github_updated_at TIMESTAMPTZ;

ALTER TABLE product_sources_cron_runs
  ADD COLUMN IF NOT EXISTS github_error TEXT;

-- github_sync_status: not_sent | pending | pr_opened | failed

COMMENT ON COLUMN product_sources_cron_runs.discord_notified IS 'true se almeno il messaggio riepilogo è stato inviato al webhook Discord';
COMMENT ON COLUMN product_sources_cron_runs.github_sync_status IS 'not_sent=pulito; pending=in coda/stub; pr_opened=URL in github_pr_url; failed=github_error';
