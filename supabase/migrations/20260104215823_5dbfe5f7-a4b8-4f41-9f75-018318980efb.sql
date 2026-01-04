-- ==========================================
-- MIGRATION: LIS Financial Synchronization
-- Purpose: Enable strong LIS ↔ Financial reconciliation
-- ==========================================

-- 1. Add unique index to prevent duplicate LIS entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_lis_unique 
ON transactions (lis_protocol_id, unit_id) 
WHERE lis_protocol_id IS NOT NULL AND deleted_at IS NULL;

-- 2. Add lis_source column to track origin of LIS link
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS lis_source TEXT;

-- Add check constraint for valid lis_source values
ALTER TABLE transactions 
ADD CONSTRAINT transactions_lis_source_check 
CHECK (lis_source IS NULL OR lis_source IN ('IMPORT_LIS', 'IMPORT_EXTRATO', 'FECHAMENTO_CAIXA', 'MANUAL', 'OCR'));

COMMENT ON COLUMN transactions.lis_source IS 'Origin of the LIS link: IMPORT_LIS, IMPORT_EXTRATO, FECHAMENTO_CAIXA, MANUAL, OCR';

-- 3. Create reconciliation log table for audit trail
CREATE TABLE IF NOT EXISTS lis_reconciliation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lis_code TEXT NOT NULL,
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  lis_closure_item_id UUID REFERENCES lis_closure_items(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'CONCILIADO', 'SEM_MATCH', 'IGNORADO')),
  notes TEXT,
  reconciled_by UUID,
  reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE lis_reconciliation_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lis_reconciliation_log
CREATE POLICY "Users can read reconciliation logs" 
ON lis_reconciliation_log FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert reconciliation logs" 
ON lis_reconciliation_log FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update reconciliation logs" 
ON lis_reconciliation_log FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_lis_reconciliation_code ON lis_reconciliation_log(lis_code, unit_id, date);
CREATE INDEX IF NOT EXISTS idx_lis_reconciliation_status ON lis_reconciliation_log(status);

-- 4. Add index on transactions.lis_protocol_id for faster searches
CREATE INDEX IF NOT EXISTS idx_transactions_lis_protocol ON transactions(lis_protocol_id) WHERE lis_protocol_id IS NOT NULL;