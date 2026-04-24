-- Nome/cognome manuali (magic link); conflitto se poi si collega Figma con handle diverso.
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS surname TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_saved_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name_conflict JSONB;
