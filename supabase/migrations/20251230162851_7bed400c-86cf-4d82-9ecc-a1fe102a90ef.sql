-- Add OCR editing audit fields to payables table
ALTER TABLE payables ADD COLUMN IF NOT EXISTS ocr_original_value numeric;
ALTER TABLE payables ADD COLUMN IF NOT EXISTS ocr_value_edited boolean DEFAULT false;
ALTER TABLE payables ADD COLUMN IF NOT EXISTS ocr_edit_reason text;
ALTER TABLE payables ADD COLUMN IF NOT EXISTS ocr_edited_by uuid;
ALTER TABLE payables ADD COLUMN IF NOT EXISTS ocr_edited_at timestamptz;

-- Add comment for documentation
COMMENT ON COLUMN payables.ocr_original_value IS 'Valor original extraído pelo OCR antes de correção manual';
COMMENT ON COLUMN payables.ocr_value_edited IS 'Indica se o valor foi corrigido manualmente';
COMMENT ON COLUMN payables.ocr_edit_reason IS 'Justificativa da correção do valor OCR';
COMMENT ON COLUMN payables.ocr_edited_by IS 'UUID do usuário que corrigiu o valor';
COMMENT ON COLUMN payables.ocr_edited_at IS 'Data/hora da correção do valor';