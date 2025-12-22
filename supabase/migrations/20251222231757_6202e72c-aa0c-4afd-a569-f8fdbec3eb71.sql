-- Tabela para configurar taxas de cartão por tipo
CREATE TABLE public.card_fee_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  fee_percent numeric(5,2) NOT NULL DEFAULT 2.50,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.card_fee_config ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage card_fee_config"
  ON public.card_fee_config FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "All authenticated can view card_fee_config"
  ON public.card_fee_config FOR SELECT
  USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_card_fee_config_updated_at
  BEFORE UPDATE ON public.card_fee_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir configurações padrão
INSERT INTO public.card_fee_config (name, fee_percent) VALUES
  ('Cartão de crédito', 2.99),
  ('Cartão de débito', 1.99);

-- Adicionar colunas em transactions para taxa de cartão e desconto
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS gross_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS card_fee_value numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS card_fee_percent numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lis_protocol_id text,
  ADD COLUMN IF NOT EXISTS discount_value numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason text,
  ADD COLUMN IF NOT EXISTS discount_approved_by text,
  ADD COLUMN IF NOT EXISTS discount_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS discount_approval_channel text;