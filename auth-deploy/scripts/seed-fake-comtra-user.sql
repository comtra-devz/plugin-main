-- Utente finto per test senza OAuth Figma (id Comtra stabile).
-- Esegui in Supabase SQL Editor (o psql) una tantum.
-- Se l'email è già usata da un altro utente, cambia la mail qui sotto.

INSERT INTO users (
  id,
  email,
  name,
  img_url,
  plan,
  credits_total,
  credits_used,
  total_xp,
  current_level,
  figma_user_id,
  updated_at
)
VALUES (
  'comtra_test_e2e',
  'test.plugin.e2e@comtra.test',
  'QA Fake Plugin User',
  NULL,
  'FREE',
  25,
  0,
  0,
  1,
  NULL,
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  updated_at = NOW();
