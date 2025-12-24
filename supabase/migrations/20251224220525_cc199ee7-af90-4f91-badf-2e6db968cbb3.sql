-- Fase 1: Extensão do modelo de dados para fechamento de caixa com seleção de códigos LIS

-- 1.1 Adicionar campos de controle de pagamento à lis_closure_items
ALTER TABLE lis_closure_items
ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'PENDENTE',
ADD COLUMN IF NOT EXISTS cash_component NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS receivable_component NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_closing_id UUID REFERENCES daily_cash_closings(id);

-- 1.2 Constraint para validar valores de payment_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'lis_closure_items_payment_status_check'
  ) THEN
    ALTER TABLE lis_closure_items
    ADD CONSTRAINT lis_closure_items_payment_status_check
    CHECK (payment_status IN ('PENDENTE', 'PAGO_NESTE_FECHAMENTO', 'A_RECEBER', 'PAGO_POSTERIOR'));
  END IF;
END $$;

-- 1.3 Index para buscar itens pendentes por status (performance)
CREATE INDEX IF NOT EXISTS idx_lis_closure_items_payment_status 
ON lis_closure_items(closure_id, payment_status);

-- 1.4 Index para buscar itens por daily_closing_id
CREATE INDEX IF NOT EXISTS idx_lis_closure_items_daily_closing 
ON lis_closure_items(daily_closing_id) WHERE daily_closing_id IS NOT NULL;

-- 1.5 Adicionar campos de controle de emissão de etiqueta ao daily_cash_closings
ALTER TABLE daily_cash_closings
ADD COLUMN IF NOT EXISTS label_emitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS label_sequence INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS lis_codes_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS selected_lis_item_ids UUID[] DEFAULT '{}';

-- 1.6 Comentários nas colunas para documentação
COMMENT ON COLUMN lis_closure_items.payment_status IS 'Status do pagamento: PENDENTE (aguardando vincular a fechamento), PAGO_NESTE_FECHAMENTO (vinculado), A_RECEBER (convênio puro), PAGO_POSTERIOR (pago em dia diferente)';
COMMENT ON COLUMN lis_closure_items.cash_component IS 'Valor que entra no envelope (pago pelo paciente em dinheiro/pix/cartão)';
COMMENT ON COLUMN lis_closure_items.receivable_component IS 'Valor a receber (faturamento para convênio/prefeitura)';
COMMENT ON COLUMN lis_closure_items.daily_closing_id IS 'ID do fechamento diário ao qual este item foi vinculado';
COMMENT ON COLUMN daily_cash_closings.label_emitted_at IS 'Timestamp de quando a etiqueta foi impressa (para controle de emissão única)';
COMMENT ON COLUMN daily_cash_closings.label_sequence IS 'Número sequencial da etiqueta (para identificação única)';
COMMENT ON COLUMN daily_cash_closings.lis_codes_count IS 'Quantidade de códigos LIS incluídos neste fechamento';
COMMENT ON COLUMN daily_cash_closings.selected_lis_item_ids IS 'Array de IDs dos lis_closure_items selecionados para este fechamento';