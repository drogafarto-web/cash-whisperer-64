-- Create seed_initial_data table for storing additional accounting data
CREATE TABLE IF NOT EXISTS public.seed_initial_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL,
  chave text NOT NULL,
  valor jsonb NOT NULL,
  referencia_id uuid,
  data_referencia date,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (categoria, chave)
);

-- Enable RLS
ALTER TABLE public.seed_initial_data ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (same pattern as other seed tables)
CREATE POLICY "Admin e contabilidade podem ver dados iniciais seed"
  ON public.seed_initial_data
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'contabilidade'::app_role));

CREATE POLICY "Admin e contabilidade podem inserir dados iniciais seed"
  ON public.seed_initial_data
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'contabilidade'::app_role));

CREATE POLICY "Admin e contabilidade podem atualizar dados iniciais seed"
  ON public.seed_initial_data
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'contabilidade'::app_role));

CREATE POLICY "Apenas admin pode deletar dados iniciais seed"
  ON public.seed_initial_data
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_seed_initial_data_updated_at
  BEFORE UPDATE ON public.seed_initial_data
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();