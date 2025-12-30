-- Drop the existing constraint that blocks tax document types
ALTER TABLE public.accounting_lab_documents DROP CONSTRAINT IF EXISTS accounting_lab_documents_tipo_check;

-- Add new constraint that includes all tax document types
ALTER TABLE public.accounting_lab_documents ADD CONSTRAINT accounting_lab_documents_tipo_check 
CHECK (tipo IN ('nf', 'despesa', 'extrato_bancario', 'outro', 'das', 'darf', 'gps', 'inss', 'fgts', 'iss'));

-- Make file_path nullable to support cases where document is skipped/failed
ALTER TABLE public.accounting_lab_documents ALTER COLUMN file_path DROP NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.accounting_lab_documents.tipo IS 'Document type: nf, despesa, extrato_bancario, outro, das, darf, gps, inss, fgts, iss';