-- Add conferido_at column to track when envelope was verified
ALTER TABLE cash_envelopes ADD COLUMN conferido_at timestamptz;

-- Backfill existing CONFERIDO envelopes with created_at
UPDATE cash_envelopes 
SET conferido_at = created_at 
WHERE status = 'CONFERIDO';