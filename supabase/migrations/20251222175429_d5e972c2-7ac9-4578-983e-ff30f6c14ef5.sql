-- Tabela para metadados dos extratos bancários 2025
CREATE TABLE IF NOT EXISTS public.seed_bank_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano integer NOT NULL DEFAULT 2025,
  mes integer NOT NULL CHECK (mes >= 1 AND mes <= 12),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('csv', 'pdf', 'outro')),
  storage_path text NOT NULL,
  imported boolean NOT NULL DEFAULT false,
  imported_at timestamptz,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  UNIQUE (ano, mes, account_id, file_name)
);

-- Tabela consolidada de folha de pagamento 2025
CREATE TABLE IF NOT EXISTS public.seed_payroll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano integer NOT NULL DEFAULT 2025,
  mes integer NOT NULL CHECK (mes >= 1 AND mes <= 12),
  salarios numeric NOT NULL DEFAULT 0,
  prolabore numeric NOT NULL DEFAULT 0,
  inss_patronal numeric NOT NULL DEFAULT 0,
  fgts numeric NOT NULL DEFAULT 0,
  decimo_terceiro numeric NOT NULL DEFAULT 0,
  ferias numeric NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (ano, mes)
);

-- Tabela de impostos pagos 2025
CREATE TABLE IF NOT EXISTS public.seed_taxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano integer NOT NULL DEFAULT 2025,
  mes integer NOT NULL CHECK (mes >= 1 AND mes <= 12),
  das numeric NOT NULL DEFAULT 0,
  iss_proprio numeric NOT NULL DEFAULT 0,
  iss_retido numeric NOT NULL DEFAULT 0,
  irrf_retido numeric NOT NULL DEFAULT 0,
  outros numeric NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (ano, mes)
);

-- Tabela de receita consolidada 2025
CREATE TABLE IF NOT EXISTS public.seed_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano integer NOT NULL DEFAULT 2025,
  mes integer NOT NULL CHECK (mes >= 1 AND mes <= 12),
  receita_servicos numeric NOT NULL DEFAULT 0,
  receita_outras numeric NOT NULL DEFAULT 0,
  fonte_principal text,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (ano, mes)
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.seed_bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seed_payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seed_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seed_revenue ENABLE ROW LEVEL SECURITY;

-- RLS para seed_bank_statements
CREATE POLICY "Admin e contabilidade podem ver extratos seed"
ON public.seed_bank_statements FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'contabilidade'));

CREATE POLICY "Admin e contabilidade podem inserir extratos seed"
ON public.seed_bank_statements FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'contabilidade'));

CREATE POLICY "Admin e contabilidade podem atualizar extratos seed"
ON public.seed_bank_statements FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'contabilidade'));

CREATE POLICY "Apenas admin pode deletar extratos seed"
ON public.seed_bank_statements FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- RLS para seed_payroll
CREATE POLICY "Admin e contabilidade podem ver folha seed"
ON public.seed_payroll FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'contabilidade'));

CREATE POLICY "Admin e contabilidade podem inserir folha seed"
ON public.seed_payroll FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'contabilidade'));

CREATE POLICY "Admin e contabilidade podem atualizar folha seed"
ON public.seed_payroll FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'contabilidade'));

CREATE POLICY "Apenas admin pode deletar folha seed"
ON public.seed_payroll FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- RLS para seed_taxes
CREATE POLICY "Admin e contabilidade podem ver impostos seed"
ON public.seed_taxes FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'contabilidade'));

CREATE POLICY "Admin e contabilidade podem inserir impostos seed"
ON public.seed_taxes FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'contabilidade'));

CREATE POLICY "Admin e contabilidade podem atualizar impostos seed"
ON public.seed_taxes FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'contabilidade'));

CREATE POLICY "Apenas admin pode deletar impostos seed"
ON public.seed_taxes FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- RLS para seed_revenue
CREATE POLICY "Admin e contabilidade podem ver receita seed"
ON public.seed_revenue FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'contabilidade'));

CREATE POLICY "Admin e contabilidade podem inserir receita seed"
ON public.seed_revenue FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'contabilidade'));

CREATE POLICY "Admin e contabilidade podem atualizar receita seed"
ON public.seed_revenue FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'contabilidade'));

CREATE POLICY "Apenas admin pode deletar receita seed"
ON public.seed_revenue FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_seed_bank_statements_ano_mes ON public.seed_bank_statements(ano, mes);
CREATE INDEX IF NOT EXISTS idx_seed_payroll_ano_mes ON public.seed_payroll(ano, mes);
CREATE INDEX IF NOT EXISTS idx_seed_taxes_ano_mes ON public.seed_taxes(ano, mes);
CREATE INDEX IF NOT EXISTS idx_seed_revenue_ano_mes ON public.seed_revenue(ano, mes);

-- Triggers para updated_at
CREATE TRIGGER update_seed_payroll_updated_at
BEFORE UPDATE ON public.seed_payroll
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_seed_taxes_updated_at
BEFORE UPDATE ON public.seed_taxes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_seed_revenue_updated_at
BEFORE UPDATE ON public.seed_revenue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();