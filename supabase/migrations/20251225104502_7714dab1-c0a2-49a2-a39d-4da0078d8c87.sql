-- Tabela para log de sessões de importação de relatórios por convênio
CREATE TABLE public.convenio_import_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id UUID REFERENCES public.units(id),
  file_name TEXT NOT NULL,
  imported_by UUID NOT NULL,
  period_start DATE,
  period_end DATE,
  total_records INTEGER DEFAULT 0,
  providers_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para armazenar dados de produção por convênio/particular
CREATE TABLE public.convenio_production_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_session_id UUID REFERENCES public.convenio_import_sessions(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.units(id),
  provider_name TEXT NOT NULL,
  is_particular BOOLEAN NOT NULL DEFAULT false,
  report_period_start DATE,
  report_period_end DATE,
  report_filename TEXT,
  row_index INTEGER,
  exam_date DATE NOT NULL,
  lis_code TEXT NOT NULL,
  patient_name TEXT,
  company_name TEXT,
  exam_list TEXT,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraint para evitar duplicatas
  CONSTRAINT convenio_production_unique UNIQUE (unit_id, provider_name, exam_date, lis_code, amount)
);

-- Índice para matching com lis_closure_items
CREATE INDEX idx_convenio_prod_unit_date_code 
  ON public.convenio_production_reports(unit_id, exam_date, lis_code);

-- Índice para filtros por convênio
CREATE INDEX idx_convenio_prod_provider 
  ON public.convenio_production_reports(provider_name, is_particular);

-- Índice para sessão de importação
CREATE INDEX idx_convenio_prod_session 
  ON public.convenio_production_reports(import_session_id);

-- Enable RLS
ALTER TABLE public.convenio_import_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convenio_production_reports ENABLE ROW LEVEL SECURITY;

-- Políticas para convenio_import_sessions
CREATE POLICY "Users can view import sessions from their unit"
  ON public.convenio_import_sessions
  FOR SELECT
  USING (
    unit_id IN (
      SELECT unit_id FROM public.profiles WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'financeiro', 'contabilidade')
    )
  );

CREATE POLICY "Users can insert import sessions for their unit"
  ON public.convenio_import_sessions
  FOR INSERT
  WITH CHECK (
    unit_id IN (
      SELECT unit_id FROM public.profiles WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'financeiro')
    )
  );

-- Políticas para convenio_production_reports
CREATE POLICY "Users can view production reports from their unit"
  ON public.convenio_production_reports
  FOR SELECT
  USING (
    unit_id IN (
      SELECT unit_id FROM public.profiles WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'financeiro', 'contabilidade')
    )
  );

CREATE POLICY "Users can insert production reports for their unit"
  ON public.convenio_production_reports
  FOR INSERT
  WITH CHECK (
    unit_id IN (
      SELECT unit_id FROM public.profiles WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'financeiro')
    )
  );

CREATE POLICY "Users can delete production reports from their unit"
  ON public.convenio_production_reports
  FOR DELETE
  USING (
    unit_id IN (
      SELECT unit_id FROM public.profiles WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'financeiro')
    )
  );