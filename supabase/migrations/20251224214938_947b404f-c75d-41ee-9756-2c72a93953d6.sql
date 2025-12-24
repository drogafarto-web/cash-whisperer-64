-- Drop existing constraint
ALTER TABLE transactions 
DROP CONSTRAINT IF EXISTS transactions_payment_method_check;

-- Add new constraint including NAO_PAGO
ALTER TABLE transactions 
ADD CONSTRAINT transactions_payment_method_check 
CHECK (payment_method = ANY (ARRAY['DINHEIRO'::text, 'CARTAO'::text, 'TRANSFERENCIA'::text, 'PIX'::text, 'BOLETO'::text, 'NAO_PAGO'::text]));