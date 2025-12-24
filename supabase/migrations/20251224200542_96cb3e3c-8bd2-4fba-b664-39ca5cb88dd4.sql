-- Constraint de unicidade para invoices (documento + emissor + competência)
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_unique_doc 
ON invoices(document_number, issuer_cnpj, competence_year, competence_month)
WHERE issuer_cnpj IS NOT NULL;

-- Constraint alternativa para invoices sem issuer_cnpj
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_unique_doc_no_issuer 
ON invoices(document_number, competence_year, competence_month)
WHERE issuer_cnpj IS NULL;

-- Constraint de unicidade para payables com código de barras
CREATE UNIQUE INDEX IF NOT EXISTS idx_payables_codigo_barras_unique 
ON payables(codigo_barras) 
WHERE codigo_barras IS NOT NULL;

-- Constraint de unicidade para payables com linha digitável
CREATE UNIQUE INDEX IF NOT EXISTS idx_payables_linha_digitavel_unique 
ON payables(linha_digitavel) 
WHERE linha_digitavel IS NOT NULL;

-- Constraints de unicidade para tabelas seed (ano + mês)
CREATE UNIQUE INDEX IF NOT EXISTS idx_seed_revenue_unique 
ON seed_revenue(ano, mes);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seed_payroll_unique 
ON seed_payroll(ano, mes);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seed_taxes_unique 
ON seed_taxes(ano, mes);