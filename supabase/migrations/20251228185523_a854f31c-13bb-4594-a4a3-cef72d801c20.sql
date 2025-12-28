-- Expandir tabela accounts com dados bancários completos
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS institution VARCHAR(100);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS institution_code VARCHAR(10);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS agency VARCHAR(20);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_number VARCHAR(30);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_type VARCHAR(50);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS holder_name VARCHAR(200);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS holder_document VARCHAR(20);

-- Adicionar coluna para vincular payables à conta de pagamento
ALTER TABLE payables ADD COLUMN IF NOT EXISTS payment_bank_account_id UUID REFERENCES accounts(id);

-- Adicionar coluna para vincular transações à conta bancária de origem (extrato)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES accounts(id);

-- Criar índices para otimização
CREATE INDEX IF NOT EXISTS idx_payables_payment_bank_account ON payables(payment_bank_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_bank_account ON transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_accounts_is_default ON accounts(is_default) WHERE is_default = TRUE;