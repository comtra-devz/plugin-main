-- Optional provider token/app-password for private repositories source scan.
ALTER TABLE user_source_connections
  ADD COLUMN IF NOT EXISTS source_access_token TEXT;

