-- Fase 1: Ajuste do modelo de dados para Fechamento por Envelope

-- 1.1 Renomear daily_closing_id para envelope_id em lis_closure_items
-- (Verificar se a FK existe antes de remover)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'lis_closure_items_daily_closing_id_fkey'
  ) THEN
    ALTER TABLE lis_closure_items DROP CONSTRAINT lis_closure_items_daily_closing_id_fkey;
  END IF;
END $$;

-- Renomear coluna
ALTER TABLE lis_closure_items 
RENAME COLUMN daily_closing_id TO envelope_id;

-- 1.2 Adicionar campos em cash_envelopes para o novo fluxo
ALTER TABLE cash_envelopes
ADD COLUMN IF NOT EXISTS expected_cash NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS counted_cash NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS difference NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS justificativa TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID,
ADD COLUMN IF NOT EXISTS lis_codes_count INTEGER DEFAULT 0;

-- 1.3 Adicionar FK de lis_closure_items.envelope_id para cash_envelopes
ALTER TABLE lis_closure_items
ADD CONSTRAINT fk_lis_closure_items_envelope
FOREIGN KEY (envelope_id) REFERENCES cash_envelopes(id) ON DELETE SET NULL;

-- 1.4 Criar índice para buscar items disponíveis para envelope (performance)
CREATE INDEX IF NOT EXISTS idx_lis_items_available_for_envelope
ON lis_closure_items(closure_id, envelope_id) 
WHERE cash_component > 0 AND envelope_id IS NULL;

-- 1.5 Criar índice para buscar items por envelope
CREATE INDEX IF NOT EXISTS idx_lis_items_by_envelope
ON lis_closure_items(envelope_id) 
WHERE envelope_id IS NOT NULL;

-- 1.6 Comentários para documentação
COMMENT ON COLUMN lis_closure_items.envelope_id IS 'FK para cash_envelopes - cada item pode estar em no máximo um envelope';
COMMENT ON COLUMN cash_envelopes.expected_cash IS 'Soma dos cash_component dos items selecionados para este envelope';
COMMENT ON COLUMN cash_envelopes.counted_cash IS 'Valor contado fisicamente pela recepção';
COMMENT ON COLUMN cash_envelopes.difference IS 'counted_cash - expected_cash';
COMMENT ON COLUMN cash_envelopes.justificativa IS 'Justificativa obrigatória se houver diferença significativa';