-- Tabela para registrar alertas de Fator R enviados
CREATE TABLE public.fator_r_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID REFERENCES public.units(id),
  user_id UUID NOT NULL,
  fator_r_atual DECIMAL(5,4) NOT NULL,
  fator_r_anterior DECIMAL(5,4),
  tipo_alerta TEXT NOT NULL CHECK (tipo_alerta IN ('CAIU_ABAIXO_30', 'CAIU_ABAIXO_28', 'SUBIU_ACIMA_28', 'SUBIU_ACIMA_30')),
  ajuste_sugerido DECIMAL(12,2),
  economia_potencial DECIMAL(12,2),
  email_enviado BOOLEAN DEFAULT false,
  email_enviado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela para preferências de alertas do usuário
CREATE TABLE public.alert_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email_fator_r_critico BOOLEAN DEFAULT true,
  email_fator_r_alerta BOOLEAN DEFAULT true,
  limite_alerta_preventivo DECIMAL(5,4) DEFAULT 0.30,
  frequencia TEXT DEFAULT 'imediato' CHECK (frequencia IN ('imediato', 'diario', 'semanal')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.fator_r_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_preferences ENABLE ROW LEVEL SECURITY;

-- Políticas para fator_r_alerts
CREATE POLICY "Users can view own alerts"
ON public.fator_r_alerts
FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert alerts"
ON public.fator_r_alerts
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can manage alerts"
ON public.fator_r_alerts
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas para alert_preferences
CREATE POLICY "Users can view own preferences"
ON public.alert_preferences
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences"
ON public.alert_preferences
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own preferences"
ON public.alert_preferences
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all preferences"
ON public.alert_preferences
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_alert_preferences_updated_at
BEFORE UPDATE ON public.alert_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();