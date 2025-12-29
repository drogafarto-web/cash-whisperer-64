-- Add nf_vinculacao_status column to payables
ALTER TABLE payables ADD COLUMN IF NOT EXISTS
  nf_vinculacao_status text DEFAULT 'nao_requer'
  CHECK (nf_vinculacao_status IN ('nao_requer', 'pendente', 'vinculado'));

-- Add dias_alerta_boleto_ausente to alert_preferences
ALTER TABLE alert_preferences ADD COLUMN IF NOT EXISTS
  dias_alerta_boleto_ausente integer DEFAULT 7;

-- Update existing boletos that have supplier_invoice_id to be 'vinculado'
UPDATE payables 
SET nf_vinculacao_status = 'vinculado' 
WHERE tipo = 'boleto' AND supplier_invoice_id IS NOT NULL;

-- Create index for faster queries on status
CREATE INDEX IF NOT EXISTS idx_payables_nf_vinculacao_status ON payables(nf_vinculacao_status);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_status ON supplier_invoices(status);