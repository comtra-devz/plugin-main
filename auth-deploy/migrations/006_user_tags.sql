-- User tags (e.g. enterprise): manual tagging for contact-request conversions
-- See docs/CONTACT-REQUESTS.md

ALTER TABLE users ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]';
CREATE INDEX IF NOT EXISTS idx_users_tags ON users USING GIN (tags);
