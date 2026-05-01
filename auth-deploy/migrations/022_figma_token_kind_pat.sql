-- Support Personal Access Token (PAT) rows: no OAuth refresh; use X-Figma-Token for REST.
ALTER TABLE figma_tokens
  ADD COLUMN IF NOT EXISTS token_kind TEXT NOT NULL DEFAULT 'oauth';

ALTER TABLE figma_tokens
  ALTER COLUMN refresh_token DROP NOT NULL;

UPDATE figma_tokens SET token_kind = 'oauth' WHERE COALESCE(token_kind, '') = '';
