-- Allow AUDIT tickets (Discard / Bad fix from Audit tab — type sent by plugin)
-- Previously CHECK only allowed BUG, FEATURE, LOVE → INSERT with AUDIT caused 500.

ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_type_check;
ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_type_check
  CHECK (type IN ('BUG', 'FEATURE', 'LOVE', 'AUDIT'));
