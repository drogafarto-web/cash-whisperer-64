-- Create unique partial indexes on payables for codigo_barras and linha_digitavel
-- This prevents duplicate entries even if OCR extracts slightly different CNPJ/document_number

-- Unique index for codigo_barras (normalized - only digits)
CREATE UNIQUE INDEX IF NOT EXISTS idx_payables_codigo_barras_unique 
ON public.payables (regexp_replace(codigo_barras, '[^0-9]', '', 'g')) 
WHERE codigo_barras IS NOT NULL AND codigo_barras != '';

-- Unique index for linha_digitavel (normalized - only digits)
CREATE UNIQUE INDEX IF NOT EXISTS idx_payables_linha_digitavel_unique 
ON public.payables (regexp_replace(linha_digitavel, '[^0-9]', '', 'g')) 
WHERE linha_digitavel IS NOT NULL AND linha_digitavel != '';