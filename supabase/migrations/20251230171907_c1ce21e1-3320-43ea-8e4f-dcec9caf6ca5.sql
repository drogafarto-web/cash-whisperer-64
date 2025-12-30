-- Corrigir função do trigger para incluir category_id com fallback
CREATE OR REPLACE FUNCTION public.create_transaction_on_payable_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_account_id UUID;
  v_transaction_id UUID;
  v_category_id UUID;
BEGIN
  -- Só executar se status mudou para 'pago' e ainda não tem transaction vinculada
  IF NEW.status = 'pago' AND (OLD.status IS NULL OR OLD.status != 'pago') AND NEW.matched_transaction_id IS NULL THEN
    
    -- Buscar conta padrão da unidade (ou primeira conta ativa)
    SELECT id INTO v_account_id
    FROM accounts
    WHERE unit_id = NEW.unit_id AND active = true
    ORDER BY is_default DESC NULLS LAST, created_at ASC
    LIMIT 1;
    
    -- Se não encontrar conta, buscar qualquer conta ativa
    IF v_account_id IS NULL THEN
      SELECT id INTO v_account_id
      FROM accounts
      WHERE active = true
      ORDER BY is_default DESC NULLS LAST, created_at ASC
      LIMIT 1;
    END IF;
    
    -- Definir category_id: usar do payable ou buscar categoria padrão
    v_category_id := NEW.category_id;
    
    IF v_category_id IS NULL THEN
      -- Buscar categoria "Outras Despesas" como fallback
      SELECT id INTO v_category_id
      FROM categories
      WHERE name = 'Outras Despesas'
      LIMIT 1;
    END IF;
    
    IF v_category_id IS NULL THEN
      -- Se ainda não encontrou, buscar qualquer categoria
      SELECT id INTO v_category_id
      FROM categories
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;
    
    -- Se encontrou conta E categoria, criar a transaction
    IF v_account_id IS NOT NULL AND v_category_id IS NOT NULL THEN
      INSERT INTO transactions (
        date,
        type,
        amount,
        description,
        account_id,
        category_id,
        unit_id,
        created_at,
        status,
        payment_method
      ) VALUES (
        COALESCE(NEW.paid_at::date, CURRENT_DATE),
        'SAIDA',
        COALESCE(NEW.paid_amount, NEW.valor),
        COALESCE(NEW.beneficiario, 'Pagamento - ' || NEW.id::text),
        v_account_id,
        v_category_id,
        NEW.unit_id,
        NOW(),
        'conciliado',
        COALESCE(NEW.paid_method, 'boleto')
      )
      RETURNING id INTO v_transaction_id;
      
      -- Atualizar o payable com o ID da transaction criada
      NEW.matched_transaction_id := v_transaction_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;