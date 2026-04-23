-- Generate A/B: track Moonshot chat slug and pipeline route per request (50/50 model arms A/B).

ALTER TABLE generate_ab_requests ADD COLUMN IF NOT EXISTS kimi_model TEXT;
ALTER TABLE generate_ab_requests ADD COLUMN IF NOT EXISTS generation_route TEXT;

CREATE INDEX IF NOT EXISTS idx_generate_ab_requests_kimi_model ON generate_ab_requests(kimi_model);
CREATE INDEX IF NOT EXISTS idx_generate_ab_requests_generation_route ON generate_ab_requests(generation_route);
