-- Add new fiscal identity columns to units table
ALTER TABLE public.units 
ADD COLUMN IF NOT EXISTS razao_social text,
ADD COLUMN IF NOT EXISTS nome_fantasia text,
ADD COLUMN IF NOT EXISTS endereco text,
ADD COLUMN IF NOT EXISTS telefone text,
ADD COLUMN IF NOT EXISTS uf text;

-- Update Rio Pomba unit with complete fiscal data
UPDATE public.units 
SET 
  cnpj = '03.047.218/0001-90',
  inscricao_municipal = '76000205',
  municipio_nome = 'Rio Pomba',
  municipio_codigo_ibge = '3155009',
  razao_social = 'LABCLIN LABORATORIO DE ANALISES CLINICAS RIO POMBA LTDA',
  nome_fantasia = 'LABCLIN',
  endereco = 'RUA FLORIPES MARIA DE JESUS, 5 - CENTRO - 36.180-000 - RIO POMBA - MG',
  telefone = '(32)3571-1444',
  uf = 'MG'
WHERE code = 'RIOPOMBA';

-- Add comment for documentation
COMMENT ON COLUMN public.units.razao_social IS 'Razão social completa da empresa';
COMMENT ON COLUMN public.units.nome_fantasia IS 'Nome fantasia da empresa';
COMMENT ON COLUMN public.units.endereco IS 'Endereço completo';
COMMENT ON COLUMN public.units.telefone IS 'Telefone de contato';
COMMENT ON COLUMN public.units.uf IS 'Unidade federativa (estado)';