-- Add intended_payment_method column to payables table
ALTER TABLE public.payables 
ADD COLUMN IF NOT EXISTS intended_payment_method text;

-- Add check constraint for valid payment methods
ALTER TABLE public.payables 
ADD CONSTRAINT payables_intended_payment_method_check 
CHECK (intended_payment_method IS NULL OR intended_payment_method IN ('dinheiro_caixa', 'pix', 'transferencia'));

-- Add comment for documentation
COMMENT ON COLUMN public.payables.intended_payment_method IS 'Intended payment method: dinheiro_caixa, pix, or transferencia';