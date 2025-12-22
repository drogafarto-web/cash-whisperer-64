-- Adicionar coluna entra_fator_r na tabela categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS entra_fator_r BOOLEAN DEFAULT false;

-- Inserir novas categorias de PESSOAL para Fator R
INSERT INTO categories (name, type, tax_group, recurrence_type, description, entra_fator_r) VALUES
  ('Pró-labore', 'SAIDA', 'PESSOAL', 'RECORRENTE', 'Remuneração dos sócios', true),
  ('13º Salário', 'SAIDA', 'PESSOAL', 'NAO_RECORRENTE', 'Décimo terceiro salário', true),
  ('Férias', 'SAIDA', 'PESSOAL', 'NAO_RECORRENTE', 'Remuneração de férias', true),
  ('INSS Patronal', 'SAIDA', 'PESSOAL', 'RECORRENTE', 'Contribuição Patronal Previdenciária (CPP)', true),
  ('FGTS', 'SAIDA', 'PESSOAL', 'RECORRENTE', 'Fundo de Garantia por Tempo de Serviço', true),
  ('Vale Transporte', 'SAIDA', 'PESSOAL', 'RECORRENTE', 'Benefício de transporte - NÃO entra no Fator R', false),
  ('Vale Alimentação', 'SAIDA', 'PESSOAL', 'RECORRENTE', 'Benefício de alimentação - NÃO entra no Fator R', false),
  ('Plano de Saúde Funcionários', 'SAIDA', 'PESSOAL', 'RECORRENTE', 'Assistência médica - NÃO entra no Fator R', false),
  ('Adiantamento Salarial', 'SAIDA', 'PESSOAL', 'NAO_RECORRENTE', 'Adiantamento de salários - NÃO entra no Fator R', false),
  ('Distribuição de Lucros', 'SAIDA', 'PESSOAL', 'NAO_RECORRENTE', 'Distribuição de lucros aos sócios - NÃO entra no Fator R', false)
ON CONFLICT DO NOTHING;

-- Inserir novas categorias TRIBUTÁRIAS específicas
INSERT INTO categories (name, type, tax_group, recurrence_type, description, entra_fator_r) VALUES
  ('DAS - Simples Nacional', 'SAIDA', 'TRIBUTARIAS', 'RECORRENTE', 'Documento de Arrecadação do Simples', false),
  ('ISS Próprio', 'SAIDA', 'TRIBUTARIAS', 'RECORRENTE', 'ISS sobre faturamento próprio', false),
  ('ISS Retido', 'SAIDA', 'TRIBUTARIAS', 'RECORRENTE', 'ISS retido na fonte por tomadores', false),
  ('IRRF Retido', 'SAIDA', 'TRIBUTARIAS', 'NAO_RECORRENTE', 'IR retido sobre serviços prestados', false),
  ('PIS/COFINS', 'SAIDA', 'TRIBUTARIAS', 'RECORRENTE', 'Contribuições federais', false)
ON CONFLICT DO NOTHING;

-- Renomear categoria genérica "Impostos" para "Outros Tributos" se existir
UPDATE categories 
SET name = 'Outros Tributos', description = 'Tributos diversos não classificados' 
WHERE name = 'Impostos' AND tax_group = 'TRIBUTARIAS';

-- Marcar categoria "Salários" existente como entra_fator_r = true
UPDATE categories SET entra_fator_r = true 
WHERE name = 'Salários' AND tax_group = 'PESSOAL';