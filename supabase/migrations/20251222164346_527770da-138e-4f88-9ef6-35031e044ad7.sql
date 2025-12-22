-- Criar tabela de configurações do sistema
CREATE TABLE public.system_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  category text DEFAULT 'general',
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);

-- Habilitar RLS
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Apenas admin pode ler configurações
CREATE POLICY "Admin can read system_config" ON public.system_config
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Apenas admin pode gerenciar configurações  
CREATE POLICY "Admin can manage system_config" ON public.system_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Inserir configurações padrão
INSERT INTO public.system_config (key, value, description, category) VALUES
  ('fator_r_thresholds', '{"verde": 0.32, "amarelo": 0.28, "vermelho": 0.25}', 
   'Limites de Fator R: verde (bom), amarelo (atenção), vermelho (crítico)', 'fator_r'),
  ('folha_informal_max', '{"alerta": 0.10, "critico": 0.20}', 
   'Percentual máximo de folha informal antes de alertas', 'folha'),
  ('caixa_diferenca_toleravel', '{"valor": 50}', 
   'Diferença tolerada em R$ no fechamento de caixa', 'caixa'),
  ('carga_tributaria_max', '{"percentual": 0.15}', 
   'Limite de carga tributária em % da receita', 'tributario');