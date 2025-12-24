-- 1. Deletar duplicados mantendo apenas o registro mais antigo
-- (se tiver envelope_id, mantém esse; senão, o primeiro criado)
DELETE FROM lis_closure_items 
WHERE id NOT IN (
  SELECT DISTINCT ON (unit_id, date, lis_code) id
  FROM lis_closure_items
  ORDER BY unit_id, date, lis_code, 
           (envelope_id IS NOT NULL) DESC,
           created_at ASC
);

-- 2. Adicionar constraint CHECK para payment_status incluir novo valor
ALTER TABLE lis_closure_items DROP CONSTRAINT IF EXISTS lis_closure_items_payment_status_check;
ALTER TABLE lis_closure_items 
ADD CONSTRAINT lis_closure_items_payment_status_check 
CHECK (payment_status IN ('PENDENTE', 'PAGO_NESTE_FECHAMENTO', 'A_RECEBER', 'PAGO_POSTERIOR', 'FECHADO_EM_ENVELOPE'));

-- 3. Criar índice único para impedir futuros duplicados
CREATE UNIQUE INDEX IF NOT EXISTS idx_lis_items_unique_code 
ON lis_closure_items (unit_id, date, lis_code);