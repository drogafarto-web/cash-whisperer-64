-- Add column for NF exemption reason when boleto is registered without NF
ALTER TABLE payables 
ADD COLUMN nf_exemption_reason TEXT DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN payables.nf_exemption_reason IS 'Justification when boleto is registered without linked NF (supplier invoice)';