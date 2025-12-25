-- Drop existing constraint
ALTER TABLE public.convenio_production_reports 
DROP CONSTRAINT IF EXISTS convenio_production_unique;

-- Create simpler constraint based on lis_code uniqueness
ALTER TABLE public.convenio_production_reports
ADD CONSTRAINT convenio_production_lis_unique UNIQUE (unit_id, lis_code);