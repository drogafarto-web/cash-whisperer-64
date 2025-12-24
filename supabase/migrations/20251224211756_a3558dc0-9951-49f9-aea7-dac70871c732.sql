-- Tabela para fechamento de caixa simplificado
-- Vincula fechamento de caixa diário ao movimento do LIS

CREATE TABLE public.daily_cash_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Vínculo com LIS closure (obrigatório)
  lis_closure_id UUID NOT NULL REFERENCES public.lis_closures(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id),
  date DATE NOT NULL,
  
  -- Valores do LIS (esperado)
  expected_cash NUMERIC NOT NULL DEFAULT 0,
  
  -- Valor informado pela secretária
  counted_cash NUMERIC,
  
  -- Diferença calculada
  difference NUMERIC GENERATED ALWAYS AS (counted_cash - expected_cash) STORED,
  
  -- Status do fechamento
  -- PENDENTE: LIS importado mas caixa não conferido
  -- CONFERIDO: caixa bateu (diferença = 0 ou tolerância)
  -- CONFERIDO_COM_DIFERENCA: caixa fechado com diferença justificada
  -- FECHADO: processo concluído
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'CONFERIDO', 'CONFERIDO_COM_DIFERENCA', 'FECHADO')),
  
  -- Quem contou e quando
  counted_by UUID REFERENCES auth.users(id),
  counted_at TIMESTAMPTZ,
  
  -- Quem confirmou/fechou e quando
  confirmed_by UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMPTZ,
  
  -- Justificativa (obrigatória quando há diferença)
  notes TEXT,
  
  -- ID do envelope gerado
  envelope_id TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Apenas um fechamento por unidade/data
  UNIQUE(unit_id, date)
);

-- Índices para performance
CREATE INDEX idx_daily_cash_closings_unit_date ON public.daily_cash_closings(unit_id, date);
CREATE INDEX idx_daily_cash_closings_status ON public.daily_cash_closings(status);
CREATE INDEX idx_daily_cash_closings_lis_closure ON public.daily_cash_closings(lis_closure_id);

-- Trigger para updated_at
CREATE TRIGGER update_daily_cash_closings_updated_at
  BEFORE UPDATE ON public.daily_cash_closings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.daily_cash_closings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
-- Visualização: usuários autenticados podem ver fechamentos da sua unidade ou admins veem tudo
CREATE POLICY "Users can view daily_cash_closings"
  ON public.daily_cash_closings
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'financeiro'::app_role) OR
    has_role(auth.uid(), 'contabilidade'::app_role) OR
    (get_user_unit(auth.uid()) IS NULL) OR
    (unit_id = get_user_unit(auth.uid()))
  );

-- Insert: usuários da unidade podem inserir
CREATE POLICY "Users can insert daily_cash_closings"
  ON public.daily_cash_closings
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    (
      has_role(auth.uid(), 'admin'::app_role) OR
      (get_user_unit(auth.uid()) IS NULL) OR
      (unit_id = get_user_unit(auth.uid()))
    )
  );

-- Update: usuários da unidade ou admin podem atualizar
CREATE POLICY "Users can update daily_cash_closings"
  ON public.daily_cash_closings
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    (get_user_unit(auth.uid()) IS NULL) OR
    (unit_id = get_user_unit(auth.uid()))
  );

-- Comentários
COMMENT ON TABLE public.daily_cash_closings IS 'Fechamento de caixa diário simplificado vinculado ao LIS';
COMMENT ON COLUMN public.daily_cash_closings.expected_cash IS 'Total em dinheiro do LIS (total_dinheiro do lis_closure)';
COMMENT ON COLUMN public.daily_cash_closings.counted_cash IS 'Valor contado fisicamente pela secretária';
COMMENT ON COLUMN public.daily_cash_closings.difference IS 'Diferença calculada automaticamente (counted - expected)';