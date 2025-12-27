-- Adicionar colunas OCR à tabela accounting_competence_documents
ALTER TABLE public.accounting_competence_documents
ADD COLUMN IF NOT EXISTS ocr_status TEXT DEFAULT 'pendente',
ADD COLUMN IF NOT EXISTS ocr_data JSONB;

-- Comentário explicativo
COMMENT ON COLUMN public.accounting_competence_documents.ocr_status IS 'Status do OCR: pendente, processando, processado, erro';
COMMENT ON COLUMN public.accounting_competence_documents.ocr_data IS 'Resultado do OCR: valor, vencimento, codigo_barras, tipo_documento, confidence';