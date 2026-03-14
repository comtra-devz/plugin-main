-- Admin recharge: PIN a 5 min, cooldown 12h per utente, regalo in plugin
-- Run on same DB used by dashboard and auth.

-- Cooldown: ultima ricarica admin per utente (blocca CTA per 12h)
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_admin_recharge_at TIMESTAMPTZ;

-- PIN monouso per conferma ricarica (scadenza 5 min), inviato a admin@comtra.dev
CREATE TABLE IF NOT EXISTS admin_recharge_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  pin_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_recharge_pins_user_expires ON admin_recharge_pins(user_id, expires_at);

-- Regalo crediti: mostrato una volta nel plugin (modale "hai ricevuto un regalo")
CREATE TABLE IF NOT EXISTS user_credit_gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credits_added INTEGER NOT NULL CHECK (credits_added > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  shown_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_user_credit_gifts_user_shown ON user_credit_gifts(user_id, shown_at);
