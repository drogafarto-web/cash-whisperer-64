-- Tabela para registrar erros da aplicação (instrumentação de produção)
CREATE TABLE public.app_error_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  route TEXT,
  user_id UUID,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_error_logs ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário (mesmo anônimo) pode inserir erros
CREATE POLICY "Anyone can insert error logs"
  ON public.app_error_logs
  FOR INSERT
  WITH CHECK (true);

-- Apenas admins podem ler os logs
CREATE POLICY "Only admins can read error logs"
  ON public.app_error_logs
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Índice para consultas por data
CREATE INDEX idx_app_error_logs_created_at ON public.app_error_logs(created_at DESC);