-- Add pix_key column to payables table for PIX payment tracking
ALTER TABLE public.payables 
ADD COLUMN pix_key text;

-- Add comment for documentation
COMMENT ON COLUMN public.payables.pix_key IS 'PIX key used for payment (CPF, CNPJ, email, phone, or random key)';