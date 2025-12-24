-- Primeiro remover duplicatas existentes (mantém o registro mais antigo)
DELETE FROM lis_closure_items a
USING lis_closure_items b
WHERE a.id > b.id 
  AND a.closure_id = b.closure_id 
  AND a.lis_code = b.lis_code 
  AND a.date = b.date;

-- Agora criar índice único
CREATE UNIQUE INDEX IF NOT EXISTS idx_lis_closure_items_unique 
ON lis_closure_items(closure_id, lis_code, date);