-- Fase 2: Adicionar campos para preparar modelo Lucro Real

-- Adicionar tax_group à tabela categories
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS tax_group text;

-- Adicionar campos de competência e fonte de receita às transações
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS competencia_mes integer,
  ADD COLUMN IF NOT EXISTS competencia_ano integer,
  ADD COLUMN IF NOT EXISTS revenue_source text;

-- Comentários para documentação
COMMENT ON COLUMN public.categories.tax_group IS 'Grupo tributário para análise de Lucro Real: INSUMOS, PESSOAL, SERVICOS_TERCEIROS, ADMINISTRATIVAS, FINANCEIRAS, RECEITA_SERVICOS';
COMMENT ON COLUMN public.transactions.competencia_mes IS 'Mês de competência (1-12) para regime de competência';
COMMENT ON COLUMN public.transactions.competencia_ano IS 'Ano de competência para regime de competência';
COMMENT ON COLUMN public.transactions.revenue_source IS 'Fonte da receita: PARTICULAR, CONVENIO, OUTRAS';