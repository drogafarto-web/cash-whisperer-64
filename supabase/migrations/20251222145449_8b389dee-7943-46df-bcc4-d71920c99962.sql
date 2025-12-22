-- Tabela de configuração tributária por unidade
CREATE TABLE public.tax_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES public.units(id) UNIQUE,
  regime_atual TEXT NOT NULL DEFAULT 'SIMPLES' CHECK (regime_atual IN ('SIMPLES', 'PRESUMIDO', 'REAL')),
  iss_aliquota DECIMAL(5,4) NOT NULL DEFAULT 0.05,
  cnpj TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de parâmetros tributários configuráveis
CREATE TABLE public.tax_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ano INTEGER NOT NULL DEFAULT 2025 UNIQUE,
  -- Lucro Presumido
  presuncao_servicos DECIMAL(5,4) NOT NULL DEFAULT 0.32,
  pis_cumulativo DECIMAL(5,4) NOT NULL DEFAULT 0.0065,
  cofins_cumulativo DECIMAL(5,4) NOT NULL DEFAULT 0.03,
  -- Lucro Real
  irpj_aliquota DECIMAL(5,4) NOT NULL DEFAULT 0.15,
  irpj_adicional DECIMAL(5,4) NOT NULL DEFAULT 0.10,
  irpj_adicional_limite DECIMAL NOT NULL DEFAULT 20000,
  csll_aliquota DECIMAL(5,4) NOT NULL DEFAULT 0.09,
  pis_nao_cumulativo DECIMAL(5,4) NOT NULL DEFAULT 0.0165,
  cofins_nao_cumulativo DECIMAL(5,4) NOT NULL DEFAULT 0.076,
  -- Reforma Tributária (estimativas)
  cbs_aliquota DECIMAL(5,4) NOT NULL DEFAULT 0.088,
  ibs_aliquota DECIMAL(5,4) NOT NULL DEFAULT 0.175,
  reducao_saude DECIMAL(5,4) NOT NULL DEFAULT 0.60,
  -- Simples Nacional Anexo III (faixas)
  simples_anexo3_faixas JSONB NOT NULL DEFAULT '[
    {"faixa": 1, "limiteInferior": 0, "limiteSuperior": 180000, "aliquota": 0.06, "deducao": 0},
    {"faixa": 2, "limiteInferior": 180000.01, "limiteSuperior": 360000, "aliquota": 0.112, "deducao": 9360},
    {"faixa": 3, "limiteInferior": 360000.01, "limiteSuperior": 720000, "aliquota": 0.135, "deducao": 17640},
    {"faixa": 4, "limiteInferior": 720000.01, "limiteSuperior": 1800000, "aliquota": 0.16, "deducao": 35640},
    {"faixa": 5, "limiteInferior": 1800000.01, "limiteSuperior": 3600000, "aliquota": 0.21, "deducao": 125640},
    {"faixa": 6, "limiteInferior": 3600000.01, "limiteSuperior": 4800000, "aliquota": 0.33, "deducao": 648000}
  ]'::jsonb,
  -- Simples Nacional Anexo V (faixas)
  simples_anexo5_faixas JSONB NOT NULL DEFAULT '[
    {"faixa": 1, "limiteInferior": 0, "limiteSuperior": 180000, "aliquota": 0.155, "deducao": 0},
    {"faixa": 2, "limiteInferior": 180000.01, "limiteSuperior": 360000, "aliquota": 0.18, "deducao": 4500},
    {"faixa": 3, "limiteInferior": 360000.01, "limiteSuperior": 720000, "aliquota": 0.195, "deducao": 9900},
    {"faixa": 4, "limiteInferior": 720000.01, "limiteSuperior": 1800000, "aliquota": 0.205, "deducao": 17100},
    {"faixa": 5, "limiteInferior": 1800000.01, "limiteSuperior": 3600000, "aliquota": 0.23, "deducao": 62100},
    {"faixa": 6, "limiteInferior": 3600000.01, "limiteSuperior": 4800000, "aliquota": 0.305, "deducao": 540000}
  ]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tax_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_parameters ENABLE ROW LEVEL SECURITY;

-- Policies for tax_config
CREATE POLICY "Admins can manage tax_config"
ON public.tax_config
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view tax_config"
ON public.tax_config
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  get_user_unit(auth.uid()) IS NULL OR
  unit_id = get_user_unit(auth.uid())
);

-- Policies for tax_parameters
CREATE POLICY "Admins can manage tax_parameters"
ON public.tax_parameters
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "All authenticated can view tax_parameters"
ON public.tax_parameters
FOR SELECT
USING (true);

-- Insert default parameters for 2025
INSERT INTO public.tax_parameters (ano) VALUES (2025);

-- Trigger for updated_at on tax_config
CREATE TRIGGER update_tax_config_updated_at
BEFORE UPDATE ON public.tax_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();