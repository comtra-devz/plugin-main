-- Level discount lifecycle (Lemon webhook + consume):
-- After any discounted paid order, block issuing new level codes until next paid renewal without discount.
-- See auth-deploy/api/webhooks/lemonsqueezy.mjs and GET /api/discounts/me.

ALTER TABLE users ADD COLUMN IF NOT EXISTS level_discount_locked_until_renewal BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS level_discount_used_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS level_discount_used_code TEXT;
