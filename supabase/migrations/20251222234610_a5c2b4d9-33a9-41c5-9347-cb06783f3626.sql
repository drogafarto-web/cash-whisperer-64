-- Tabela de fechamentos LIS (por período/unidade)
CREATE TABLE public.lis_closures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id UUID REFERENCES public.units(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('ABERTO', 'FECHADO')),
  total_dinheiro NUMERIC NOT NULL DEFAULT 0,
  total_pix NUMERIC NOT NULL DEFAULT 0,
  total_cartao_liquido NUMERIC NOT NULL DEFAULT 0,
  total_taxa_cartao NUMERIC NOT NULL DEFAULT 0,
  total_nao_pago NUMERIC NOT NULL DEFAULT 0,
  itens_sem_comprovante INTEGER NOT NULL DEFAULT 0,
  conferencia_checkbox BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_by UUID,
  closed_at TIMESTAMP WITH TIME ZONE
);

-- Tabela de itens (códigos LIS) dentro do fechamento
CREATE TABLE public.lis_closure_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  closure_id UUID NOT NULL REFERENCES public.lis_closures(id) ON DELETE CASCADE,
  lis_code TEXT NOT NULL,
  date DATE NOT NULL,
  patient_name TEXT,
  convenio TEXT,
  payment_method TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  gross_amount NUMERIC,
  discount_value NUMERIC DEFAULT 0,
  discount_percent NUMERIC DEFAULT 0,
  discount_reason TEXT,
  discount_approved_by TEXT,
  discount_approved_at TIMESTAMP WITH TIME ZONE,
  discount_approval_channel TEXT,
  card_fee_value NUMERIC DEFAULT 0,
  card_fee_percent NUMERIC DEFAULT 0,
  net_amount NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'NORMAL' CHECK (status IN ('NORMAL', 'NAO_PAGO', 'JUSTIFICADO', 'SEM_COMPROVANTE')),
  justificativa TEXT,
  comprovante_status TEXT DEFAULT 'PENDENTE' CHECK (comprovante_status IN ('PENDENTE', 'CONCILIADO', 'SEM_COMPROVANTE', 'DUPLICIDADE')),
  transaction_id UUID REFERENCES public.transactions(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de envelopes de dinheiro (único por fechamento)
CREATE TABLE public.cash_envelopes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  closure_id UUID NOT NULL UNIQUE REFERENCES public.lis_closures(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES public.units(id),
  cash_total NUMERIC NOT NULL DEFAULT 0,
  lis_codes TEXT[] NOT NULL DEFAULT '{}',
  conferencia_checkbox BOOLEAN NOT NULL DEFAULT false,
  label_printed_at TIMESTAMP WITH TIME ZONE,
  label_printed_by UUID,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'EMITIDO')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lis_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lis_closure_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_envelopes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lis_closures
CREATE POLICY "Users can view lis_closures" ON public.lis_closures
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    (get_user_unit(auth.uid()) IS NULL) OR 
    (unit_id = get_user_unit(auth.uid()))
  );

CREATE POLICY "Users can insert lis_closures" ON public.lis_closures
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own open lis_closures" ON public.lis_closures
  FOR UPDATE USING (
    (created_by = auth.uid() AND status = 'ABERTO') OR 
    has_role(auth.uid(), 'admin'::app_role)
  );

-- RLS Policies for lis_closure_items
CREATE POLICY "Users can view lis_closure_items" ON public.lis_closure_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lis_closures lc 
      WHERE lc.id = lis_closure_items.closure_id 
      AND (has_role(auth.uid(), 'admin'::app_role) OR 
           (get_user_unit(auth.uid()) IS NULL) OR 
           (lc.unit_id = get_user_unit(auth.uid())))
    )
  );

CREATE POLICY "Users can insert lis_closure_items" ON public.lis_closure_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lis_closures lc 
      WHERE lc.id = lis_closure_items.closure_id 
      AND lc.created_by = auth.uid() 
      AND lc.status = 'ABERTO'
    )
  );

CREATE POLICY "Users can update lis_closure_items" ON public.lis_closure_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.lis_closures lc 
      WHERE lc.id = lis_closure_items.closure_id 
      AND ((lc.created_by = auth.uid() AND lc.status = 'ABERTO') OR has_role(auth.uid(), 'admin'::app_role))
    )
  );

-- RLS Policies for cash_envelopes
CREATE POLICY "Users can view cash_envelopes" ON public.cash_envelopes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lis_closures lc 
      WHERE lc.id = cash_envelopes.closure_id 
      AND (has_role(auth.uid(), 'admin'::app_role) OR 
           (get_user_unit(auth.uid()) IS NULL) OR 
           (lc.unit_id = get_user_unit(auth.uid())))
    )
  );

CREATE POLICY "Users can insert cash_envelopes" ON public.cash_envelopes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lis_closures lc 
      WHERE lc.id = cash_envelopes.closure_id 
      AND lc.created_by = auth.uid() 
      AND lc.status = 'ABERTO'
    )
  );

CREATE POLICY "Users can update cash_envelopes" ON public.cash_envelopes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.lis_closures lc 
      WHERE lc.id = cash_envelopes.closure_id 
      AND ((lc.created_by = auth.uid() AND lc.status = 'ABERTO') OR has_role(auth.uid(), 'admin'::app_role))
    )
  );

-- Indexes for performance
CREATE INDEX idx_lis_closures_unit_id ON public.lis_closures(unit_id);
CREATE INDEX idx_lis_closures_status ON public.lis_closures(status);
CREATE INDEX idx_lis_closure_items_closure_id ON public.lis_closure_items(closure_id);
CREATE INDEX idx_lis_closure_items_payment_method ON public.lis_closure_items(payment_method);
CREATE INDEX idx_lis_closure_items_status ON public.lis_closure_items(status);
CREATE INDEX idx_cash_envelopes_closure_id ON public.cash_envelopes(closure_id);