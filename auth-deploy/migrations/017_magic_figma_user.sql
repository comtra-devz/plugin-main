-- Unisce account email-first (magic link) e Figma: stessa mail = stessa riga users.
-- figma_user_id = ID Figma (api /v1/me) anche quando users.id interno (es. comtra_...).

ALTER TABLE users ADD COLUMN IF NOT EXISTS figma_user_id TEXT;

-- Backfill: solo profili Figma (PK = id Figma), non account creati con magic (id comtra_*)
UPDATE users
SET figma_user_id = id
WHERE figma_user_id IS NULL
  AND id !~ '^comtra_';

CREATE UNIQUE INDEX IF NOT EXISTS users_figma_user_id_key
  ON users (figma_user_id) WHERE figma_user_id IS NOT NULL;

-- Stessa email normalizzata = stesso account (un solo login magico o merge Figma)
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key
  ON users (lower(btrim(email)))
  WHERE email IS NOT NULL AND btrim(email) <> '';
