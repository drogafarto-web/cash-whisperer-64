-- Módulo 2: Alertas de Fluxo de Caixa
CREATE TABLE public.cashflow_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES public.units(id),
  week_start DATE NOT NULL,
  projected_balance DECIMAL(14,2),
  alert_type TEXT CHECK (alert_type IN ('NEGATIVO', 'BAIXO', 'OK')),
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID
);

-- Enable RLS
ALTER TABLE public.cashflow_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies for cashflow_alerts
CREATE POLICY "Admins can view all cashflow alerts" ON public.cashflow_alerts
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert cashflow alerts" ON public.cashflow_alerts
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update cashflow alerts" ON public.cashflow_alerts
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Módulo 3: Patrimônio do Grupo
CREATE TABLE public.patrimony_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('ATIVO', 'PASSIVO')),
  categoria TEXT NOT NULL CHECK (categoria IN (
    'IMOVEL', 'VEICULO', 'EQUIPAMENTO', 'INVESTIMENTO',
    'EMPRESTIMO_BANCARIO', 'FINANCIAMENTO', 'EMPRESTIMO_PARTES_RELACIONADAS', 'OUTROS'
  )),
  descricao TEXT NOT NULL,
  valor_atual DECIMAL(14,2) NOT NULL,
  valor_original DECIMAL(14,2),
  data_aquisicao DATE,
  data_vencimento DATE,
  proprietario_tipo TEXT CHECK (proprietario_tipo IN ('EMPRESA', 'HOLDING', 'SOCIO', 'FAMILIAR')),
  proprietario_nome TEXT,
  observacoes TEXT,
  unit_id UUID REFERENCES public.units(id),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.patrimony_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for patrimony_items
CREATE POLICY "Admins can manage patrimony items" ON public.patrimony_items
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Contabilidade can view patrimony items" ON public.patrimony_items
  FOR SELECT USING (public.has_role(auth.uid(), 'contabilidade'));

-- Adicionar campos de parte relacionada em payables e invoices
ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS parte_relacionada_tipo TEXT 
  CHECK (parte_relacionada_tipo IN ('HOLDING', 'SOCIO', 'FAMILIAR', NULL));
ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS parte_relacionada_nome TEXT;

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS parte_relacionada_tipo TEXT 
  CHECK (parte_relacionada_tipo IN ('HOLDING', 'SOCIO', 'FAMILIAR', NULL));
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS parte_relacionada_nome TEXT;

-- Trigger para atualizar updated_at em patrimony_items
CREATE TRIGGER update_patrimony_items_updated_at
  BEFORE UPDATE ON public.patrimony_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();