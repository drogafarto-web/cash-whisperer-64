-- Remover a constraint antiga
ALTER TABLE lis_closure_items 
  DROP CONSTRAINT IF EXISTS lis_closure_items_payment_status_check;

-- Adicionar a nova constraint com CONFIRMADO
ALTER TABLE lis_closure_items 
  ADD CONSTRAINT lis_closure_items_payment_status_check 
  CHECK (payment_status = ANY (ARRAY[
    'PENDENTE'::text,
    'PAGO_NESTE_FECHAMENTO'::text,
    'A_RECEBER'::text,
    'PAGO_POSTERIOR'::text,
    'FECHADO_EM_ENVELOPE'::text,
    'CONFIRMADO'::text
  ]));