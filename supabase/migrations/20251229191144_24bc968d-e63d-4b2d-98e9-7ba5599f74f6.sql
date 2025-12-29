-- Add payment method fields to supplier_invoices
ALTER TABLE supplier_invoices
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'boleto',
ADD COLUMN IF NOT EXISTS payment_pix_key text,
ADD COLUMN IF NOT EXISTS payment_bank_account_id uuid REFERENCES accounts(id);

-- Add check constraint for payment_method values
ALTER TABLE supplier_invoices
ADD CONSTRAINT supplier_invoices_payment_method_check
CHECK (payment_method IN ('boleto', 'pix', 'transferencia', 'dinheiro'));

-- Make payment_method NOT NULL after setting default
ALTER TABLE supplier_invoices
ALTER COLUMN payment_method SET NOT NULL;

-- Add constraint to payables: boleto type requires supplier_invoice_id
ALTER TABLE payables
ADD CONSTRAINT payables_boleto_requires_invoice
CHECK (
  tipo != 'boleto' OR supplier_invoice_id IS NOT NULL
);