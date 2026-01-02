-- Remove o constraint existente e recria com FUNCIONARIO incluído
ALTER TABLE partners DROP CONSTRAINT IF EXISTS partners_type_check;

ALTER TABLE partners ADD CONSTRAINT partners_type_check 
  CHECK (type = ANY (ARRAY['CLIENTE'::text, 'FORNECEDOR'::text, 'FUNCIONARIO'::text]));