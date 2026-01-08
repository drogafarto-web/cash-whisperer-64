-- Trigger para impedir re-registro de pagamento em boletos já pagos
-- Se o payable já está PAGO, bloqueia alterações em campos de pagamento

CREATE OR REPLACE FUNCTION public.prevent_duplicate_payment()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o status antigo já era PAGO e estamos tentando atualizar campos de pagamento
  IF OLD.status = 'PAGO' AND (
    -- Detectar tentativa de alterar dados de pagamento
    (NEW.paid_at IS DISTINCT FROM OLD.paid_at) OR
    (NEW.paid_amount IS DISTINCT FROM OLD.paid_amount) OR
    (NEW.paid_method IS DISTINCT FROM OLD.paid_method)
  ) THEN
    -- Permitir apenas se for uma operação administrativa (ex: estorno)
    -- Para estorno, o status precisa mudar de PAGO para outro valor
    IF NEW.status = 'PAGO' THEN
      RAISE EXCEPTION 'Este boleto já foi marcado como pago em %. Pagamentos duplicados não são permitidos.', 
        TO_CHAR(OLD.paid_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar o trigger na tabela payables
DROP TRIGGER IF EXISTS prevent_duplicate_payment_trigger ON public.payables;

CREATE TRIGGER prevent_duplicate_payment_trigger
  BEFORE UPDATE ON public.payables
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_payment();