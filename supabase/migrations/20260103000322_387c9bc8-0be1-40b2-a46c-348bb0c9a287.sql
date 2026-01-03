-- Remove existing constraint
ALTER TABLE payables DROP CONSTRAINT IF EXISTS payables_tipo_check;

-- Recreate with 'titulo' included
ALTER TABLE payables ADD CONSTRAINT payables_tipo_check 
  CHECK (tipo = ANY (ARRAY['boleto'::text, 'parcela'::text, 'avulso'::text, 'recibo'::text, 'titulo'::text]));