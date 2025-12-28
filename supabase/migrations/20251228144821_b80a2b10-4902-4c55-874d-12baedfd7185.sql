-- Add business registration columns to units table
ALTER TABLE public.units 
ADD COLUMN IF NOT EXISTS data_abertura date,
ADD COLUMN IF NOT EXISTS porte text,
ADD COLUMN IF NOT EXISTS natureza_juridica text,
ADD COLUMN IF NOT EXISTS opcao_mei boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS opcao_simples boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS data_opcao_simples date,
ADD COLUMN IF NOT EXISTS capital_social numeric(15,2),
ADD COLUMN IF NOT EXISTS tipo_unidade_receita text,
ADD COLUMN IF NOT EXISTS situacao_cadastral text,
ADD COLUMN IF NOT EXISTS data_situacao_cadastral date;

-- Update Rio Pomba unit with business registration data
UPDATE public.units 
SET 
  data_abertura = '1999-01-26',
  porte = 'Micro Empresa',
  natureza_juridica = 'Sociedade Empresária Limitada',
  opcao_mei = false,
  opcao_simples = true,
  data_opcao_simples = '2009-01-01',
  capital_social = 30000.00,
  tipo_unidade_receita = 'Matriz',
  situacao_cadastral = 'Ativa',
  data_situacao_cadastral = '2005-11-03'
WHERE code = 'RIOPOMBA';

-- Add comments for documentation
COMMENT ON COLUMN public.units.data_abertura IS 'Data de abertura da empresa na Receita Federal';
COMMENT ON COLUMN public.units.porte IS 'Porte da empresa (MEI, Micro Empresa, Pequeno Porte, etc)';
COMMENT ON COLUMN public.units.natureza_juridica IS 'Natureza jurídica da empresa';
COMMENT ON COLUMN public.units.opcao_mei IS 'Se a empresa é optante pelo MEI';
COMMENT ON COLUMN public.units.opcao_simples IS 'Se a empresa é optante pelo Simples Nacional';
COMMENT ON COLUMN public.units.data_opcao_simples IS 'Data de opção pelo Simples Nacional';
COMMENT ON COLUMN public.units.capital_social IS 'Capital social da empresa';
COMMENT ON COLUMN public.units.tipo_unidade_receita IS 'Tipo na Receita Federal (Matriz/Filial)';
COMMENT ON COLUMN public.units.situacao_cadastral IS 'Situação cadastral na Receita Federal';
COMMENT ON COLUMN public.units.data_situacao_cadastral IS 'Data da situação cadastral';