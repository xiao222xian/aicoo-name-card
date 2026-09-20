-- Apply after 001, with an explicit backup and administrator approval.
BEGIN;
ALTER TABLE card_connections DROP CONSTRAINT IF EXISTS card_connections_pair_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS card_connections_live_pair
  ON card_connections(pair_key) WHERE status IN ('pending','accepted');
ALTER TABLE card_renewals ADD COLUMN IF NOT EXISTS lease_token text;
ALTER TABLE card_renewals ADD COLUMN IF NOT EXISTS message text;
CREATE INDEX IF NOT EXISTS card_renewals_due
  ON card_renewals(checked_at NULLS FIRST) WHERE enabled=true;
COMMIT;
