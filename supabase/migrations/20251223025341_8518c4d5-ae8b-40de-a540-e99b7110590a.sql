-- Criar índice único para evitar duplicatas de notas fiscais
-- Combinação de número do documento + CNPJ do emissor
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_unique_doc 
ON invoices (document_number, issuer_cnpj) 
WHERE issuer_cnpj IS NOT NULL;

-- Para notas sem issuer_cnpj, usar número do documento + competência
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_unique_doc_competence 
ON invoices (document_number, competence_year, competence_month) 
WHERE issuer_cnpj IS NULL;