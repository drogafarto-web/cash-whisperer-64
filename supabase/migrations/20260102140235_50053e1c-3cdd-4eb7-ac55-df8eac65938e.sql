-- 1. Adicionar coluna unit_id para vincular parceiros a unidades
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES units(id);

-- 2. Criar índice para performance de busca de funcionários por unidade
CREATE INDEX IF NOT EXISTS idx_partners_unit_type 
ON partners(unit_id, type) WHERE active = true;

-- 3. Comentário explicativo
COMMENT ON COLUMN partners.unit_id IS 'Unidade do parceiro. Obrigatório para tipo FUNCIONARIO';