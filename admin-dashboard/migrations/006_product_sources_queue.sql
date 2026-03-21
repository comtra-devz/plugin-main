-- Fase 3: coda job per spezzare fetch web / batch LinkedIn su più invocazioni cron.

CREATE TABLE IF NOT EXISTS product_sources_queue_batches (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending_work',
  -- pending_work | done | failed
  context_json JSONB NOT NULL,
  total_jobs INT NOT NULL DEFAULT 0,
  completed_jobs INT NOT NULL DEFAULT 0,
  last_error TEXT,
  final_run_id BIGINT
);

CREATE INDEX IF NOT EXISTS idx_psq_batches_status_created
  ON product_sources_queue_batches (status, created_at DESC);

CREATE TABLE IF NOT EXISTS product_sources_queue_jobs (
  id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT NOT NULL REFERENCES product_sources_queue_batches (id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  -- web | linkedin_apify
  sort_order INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  -- pending | running | done | error
  payload_json JSONB NOT NULL DEFAULT '{}',
  result_json JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_psq_jobs_batch_status
  ON product_sources_queue_jobs (batch_id, status);

CREATE INDEX IF NOT EXISTS idx_psq_jobs_pending
  ON product_sources_queue_jobs (batch_id)
  WHERE status = 'pending';

COMMENT ON TABLE product_sources_queue_batches IS 'Fase 3: una sessione logica (Notion estratto) spezzata su più hit cron';
COMMENT ON TABLE product_sources_queue_jobs IS 'Singolo job: 1 URL web o 1 batch Apify LinkedIn';
