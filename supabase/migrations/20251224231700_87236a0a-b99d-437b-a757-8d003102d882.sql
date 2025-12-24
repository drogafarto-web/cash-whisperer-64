-- Corrigir cash_component e receivable_component em registros existentes
-- Pagamentos na recepção (DINHEIRO, PIX, CARTAO) devem ter cash_component = amount
-- Outros (CONVENIO, BOLETO, TRANSFERENCIA, NAO_PAGO) devem ter cash_component = 0

-- Atualizar registros onde cash_component está NULL ou incorreto
UPDATE lis_closure_items
SET 
  cash_component = CASE 
    WHEN payment_method IN ('DINHEIRO', 'PIX', 'CARTAO') THEN COALESCE(amount, 0)
    ELSE 0
  END,
  receivable_component = CASE 
    WHEN payment_method IN ('DINHEIRO', 'PIX', 'CARTAO') THEN 0
    ELSE COALESCE(amount, 0)
  END
WHERE cash_component IS NULL 
   OR receivable_component IS NULL
   OR (payment_method IN ('DINHEIRO', 'PIX', 'CARTAO') AND cash_component = 0 AND amount > 0)
   OR (payment_method NOT IN ('DINHEIRO', 'PIX', 'CARTAO') AND cash_component > 0);