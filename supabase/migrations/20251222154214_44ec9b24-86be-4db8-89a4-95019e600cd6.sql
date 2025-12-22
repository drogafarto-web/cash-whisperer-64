-- Adicionar coluna is_informal na tabela categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_informal BOOLEAN DEFAULT false;

-- Inserir categorias de pagamentos informais (NÃO entram no Fator R)
INSERT INTO categories (name, type, tax_group, recurrence_type, description, entra_fator_r, is_informal) VALUES
  ('Complementação Salarial Informal', 'SAIDA', 'PESSOAL', 'RECORRENTE', 
   'Pagamentos variáveis não registrados em folha - ATENÇÃO: Representa risco trabalhista e fiscal', false, true),
  ('Comissão Informal', 'SAIDA', 'PESSOAL', 'RECORRENTE', 
   'Comissões pagas fora da folha - ATENÇÃO: Representa risco trabalhista e fiscal', false, true),
  ('Premiação Informal', 'SAIDA', 'PESSOAL', 'NAO_RECORRENTE', 
   'Premiações não registradas - ATENÇÃO: Representa risco trabalhista e fiscal', false, true)
ON CONFLICT DO NOTHING;