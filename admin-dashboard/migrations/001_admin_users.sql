-- Admin dashboard: utenti con email + password + TOTP 2FA (opzionale)
-- Esegui questo script sul DB usato dalla dashboard (POSTGRES_URL).
-- Dopo la creazione, inserisci i 2 utenti con uno script o manualmente (vedi README auth).

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  totp_secret TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users (LOWER(email));

COMMENT ON TABLE admin_users IS 'Utenti admin dashboard: login email+password, 2FA TOTP opzionale';
