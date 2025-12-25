-- Create convenios table
CREATE TABLE public.convenios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  codigo TEXT,
  tipo TEXT DEFAULT 'convenio',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint on nome
ALTER TABLE public.convenios ADD CONSTRAINT convenios_nome_key UNIQUE (nome);

-- Enable RLS
ALTER TABLE public.convenios ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage convenios"
  ON public.convenios FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "All authenticated can view active convenios"
  ON public.convenios FOR SELECT
  USING (active = true);

-- Trigger for updated_at
CREATE TRIGGER update_convenios_updated_at
  BEFORE UPDATE ON public.convenios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();