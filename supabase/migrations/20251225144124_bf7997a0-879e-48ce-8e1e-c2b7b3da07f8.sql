-- Add fiscal identity fields to units table
ALTER TABLE public.units 
ADD COLUMN IF NOT EXISTS cnpj TEXT,
ADD COLUMN IF NOT EXISTS inscricao_municipal TEXT,
ADD COLUMN IF NOT EXISTS inscricao_estadual TEXT,
ADD COLUMN IF NOT EXISTS municipio_codigo_ibge TEXT,
ADD COLUMN IF NOT EXISTS municipio_nome TEXT;

-- Add hierarchy and centralization fields to units
ALTER TABLE public.units 
ADD COLUMN IF NOT EXISTS unit_type TEXT DEFAULT 'FILIAL_COM_NF',
ADD COLUMN IF NOT EXISTS parent_unit_id UUID REFERENCES public.units(id),
ADD COLUMN IF NOT EXISTS centraliza_tributos_federais BOOLEAN DEFAULT FALSE;

-- Expand tax_config table with full ISS and validity
ALTER TABLE public.tax_config 
ADD COLUMN IF NOT EXISTS iss_municipio_incidente TEXT,
ADD COLUMN IF NOT EXISTS iss_tipo_apuracao TEXT DEFAULT 'SOBRE_FATURAMENTO',
ADD COLUMN IF NOT EXISTS iss_valor_fixo_mensal DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS iss_responsavel_unit_id UUID REFERENCES public.units(id),
ADD COLUMN IF NOT EXISTS vigencia_inicio DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS vigencia_fim DATE;

-- Add comment for unit_type values
COMMENT ON COLUMN public.units.unit_type IS 'MATRIZ, FILIAL_COM_NF, POSTO_COLETA_SEM_NF';

-- Add comment for iss_tipo_apuracao values
COMMENT ON COLUMN public.tax_config.iss_tipo_apuracao IS 'SOBRE_FATURAMENTO, FIXO_MENSAL';