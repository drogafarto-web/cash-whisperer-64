-- Tabela para sessões de importação
CREATE TABLE public.import_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  unit_id UUID REFERENCES public.units(id),
  period_start DATE,
  period_end DATE,
  total_records INTEGER DEFAULT 0,
  pending_count INTEGER DEFAULT 0,
  imported_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'PENDING',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela para registros em staging (antes de ir para transactions)
CREATE TABLE public.import_staging (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_session_id UUID NOT NULL REFERENCES public.import_sessions(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.units(id),
  date DATE NOT NULL,
  codigo TEXT NOT NULL,
  paciente TEXT,
  convenio TEXT,
  valor_bruto DECIMAL(10,2) DEFAULT 0,
  valor_pago DECIMAL(10,2) DEFAULT 0,
  payment_method TEXT NOT NULL,
  is_particular BOOLEAN DEFAULT false,
  is_nao_pago BOOLEAN DEFAULT false,
  is_duplicate BOOLEAN DEFAULT false,
  has_error BOOLEAN DEFAULT false,
  error_message TEXT,
  
  -- Resolução de pendência financeira
  resolved BOOLEAN DEFAULT false,
  resolution_payment_method TEXT,
  resolution_amount DECIMAL(10,2),
  resolution_justification TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  
  -- Status do registro
  status TEXT DEFAULT 'PENDING',
  transaction_id UUID REFERENCES public.transactions(id),
  selected BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.import_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_staging ENABLE ROW LEVEL SECURITY;

-- RLS Policies para import_sessions
CREATE POLICY "Users can view import_sessions by unit"
  ON public.import_sessions FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR get_user_unit(auth.uid()) IS NULL 
    OR unit_id = get_user_unit(auth.uid())
  );

CREATE POLICY "Users can insert import_sessions"
  ON public.import_sessions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update import_sessions"
  ON public.import_sessions FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR created_by = auth.uid()
  );

CREATE POLICY "Users can delete import_sessions"
  ON public.import_sessions FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR created_by = auth.uid()
  );

-- RLS Policies para import_staging
CREATE POLICY "Users can view import_staging by unit"
  ON public.import_staging FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR get_user_unit(auth.uid()) IS NULL 
    OR unit_id = get_user_unit(auth.uid())
  );

CREATE POLICY "Users can insert import_staging"
  ON public.import_staging FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update import_staging"
  ON public.import_staging FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete import_staging"
  ON public.import_staging FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR created_by = auth.uid()
  );

-- Trigger para updated_at
CREATE TRIGGER update_import_sessions_updated_at
  BEFORE UPDATE ON public.import_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_import_staging_updated_at
  BEFORE UPDATE ON public.import_staging
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();