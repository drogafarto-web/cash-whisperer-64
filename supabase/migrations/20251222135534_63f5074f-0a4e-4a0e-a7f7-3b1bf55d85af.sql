-- Adicionar coluna recurrence_type na tabela categories
ALTER TABLE categories 
ADD COLUMN recurrence_type text DEFAULT NULL;

-- Constraint para valores válidos
ALTER TABLE categories 
ADD CONSTRAINT categories_recurrence_type_check 
CHECK (recurrence_type IN ('RECORRENTE', 'NAO_RECORRENTE'));

-- Classificar Despesas Recorrentes (fixas mensais)
UPDATE categories SET recurrence_type = 'RECORRENTE' 
WHERE name IN ('Água', 'Aluguel', 'Energia Elétrica', 'Internet/Telefone', 
               'Salários', 'Material de Escritório', 'Impostos');

-- Classificar Despesas Não Recorrentes (variáveis/pontuais)
UPDATE categories SET recurrence_type = 'NAO_RECORRENTE' 
WHERE name IN ('Fornecedores', 'Manutenção', 'Outras Despesas');

-- Classificar Receitas Não Recorrentes (por volume de atendimento)
UPDATE categories SET recurrence_type = 'NAO_RECORRENTE' 
WHERE name IN ('Recebimento de Clientes', 'Vendas à Vista', 
               'Vendas a Prazo', 'Outras Receitas');