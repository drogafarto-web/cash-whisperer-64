-- Criar categorias padrão para folha e impostos (ignora se já existirem pelo nome)
DO $$
BEGIN
  -- Salários e Ordenados
  IF NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Salários e Ordenados') THEN
    INSERT INTO categories (name, type, tax_group, entra_fator_r, description, active)
    VALUES ('Salários e Ordenados', 'SAIDA', 'PESSOAL', true, 'Pagamento de salários a funcionários CLT', true);
  ELSE
    UPDATE categories SET tax_group = 'PESSOAL', entra_fator_r = true WHERE name = 'Salários e Ordenados';
  END IF;
  
  -- Pró-labore
  IF NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Pró-labore') THEN
    INSERT INTO categories (name, type, tax_group, entra_fator_r, description, active)
    VALUES ('Pró-labore', 'SAIDA', 'PESSOAL', true, 'Retirada de sócios', true);
  ELSE
    UPDATE categories SET tax_group = 'PESSOAL', entra_fator_r = true WHERE name = 'Pró-labore';
  END IF;
  
  -- FGTS
  IF NOT EXISTS (SELECT 1 FROM categories WHERE name = 'FGTS') THEN
    INSERT INTO categories (name, type, tax_group, entra_fator_r, description, active)
    VALUES ('FGTS', 'SAIDA', 'PESSOAL', true, 'Fundo de Garantia por Tempo de Serviço', true);
  ELSE
    UPDATE categories SET tax_group = 'PESSOAL', entra_fator_r = true WHERE name = 'FGTS';
  END IF;
  
  -- GPS - INSS Patronal
  IF NOT EXISTS (SELECT 1 FROM categories WHERE name = 'GPS - INSS Patronal') THEN
    INSERT INTO categories (name, type, tax_group, entra_fator_r, description, active)
    VALUES ('GPS - INSS Patronal', 'SAIDA', 'PESSOAL', true, 'Guia da Previdência Social - contribuição patronal', true);
  ELSE
    UPDATE categories SET tax_group = 'PESSOAL', entra_fator_r = true WHERE name = 'GPS - INSS Patronal';
  END IF;
  
  -- 13º Salário
  IF NOT EXISTS (SELECT 1 FROM categories WHERE name = '13º Salário') THEN
    INSERT INTO categories (name, type, tax_group, entra_fator_r, description, active)
    VALUES ('13º Salário', 'SAIDA', 'PESSOAL', true, 'Décimo terceiro salário', true);
  ELSE
    UPDATE categories SET tax_group = 'PESSOAL', entra_fator_r = true WHERE name = '13º Salário';
  END IF;
  
  -- Férias
  IF NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Férias') THEN
    INSERT INTO categories (name, type, tax_group, entra_fator_r, description, active)
    VALUES ('Férias', 'SAIDA', 'PESSOAL', true, 'Pagamento de férias', true);
  ELSE
    UPDATE categories SET tax_group = 'PESSOAL', entra_fator_r = true WHERE name = 'Férias';
  END IF;
  
  -- DAS - Simples Nacional
  IF NOT EXISTS (SELECT 1 FROM categories WHERE name = 'DAS - Simples Nacional') THEN
    INSERT INTO categories (name, type, tax_group, entra_fator_r, description, active)
    VALUES ('DAS - Simples Nacional', 'SAIDA', 'IMPOSTOS', false, 'Documento de Arrecadação do Simples Nacional', true);
  ELSE
    UPDATE categories SET tax_group = 'IMPOSTOS', entra_fator_r = false WHERE name = 'DAS - Simples Nacional';
  END IF;
  
  -- DARF - IRRF
  IF NOT EXISTS (SELECT 1 FROM categories WHERE name = 'DARF - IRRF') THEN
    INSERT INTO categories (name, type, tax_group, entra_fator_r, description, active)
    VALUES ('DARF - IRRF', 'SAIDA', 'IMPOSTOS', false, 'DARF Imposto de Renda Retido na Fonte', true);
  ELSE
    UPDATE categories SET tax_group = 'IMPOSTOS', entra_fator_r = false WHERE name = 'DARF - IRRF';
  END IF;
  
  -- ISS
  IF NOT EXISTS (SELECT 1 FROM categories WHERE name = 'ISS') THEN
    INSERT INTO categories (name, type, tax_group, entra_fator_r, description, active)
    VALUES ('ISS', 'SAIDA', 'IMPOSTOS', false, 'Imposto Sobre Serviços', true);
  ELSE
    UPDATE categories SET tax_group = 'IMPOSTOS', entra_fator_r = false WHERE name = 'ISS';
  END IF;
END $$;

-- Criar função para criar transaction automaticamente quando payable for pago
CREATE OR REPLACE FUNCTION public.create_transaction_on_payable_paid()
RETURNS TRIGGER AS $$
DECLARE
  v_account_id UUID;
  v_transaction_id UUID;
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
    
    -- Se encontrou conta, criar a transaction
    IF v_account_id IS NOT NULL THEN
      INSERT INTO transactions (
        date,
        type,
        amount,
        description,
        account_id,
        category_id,
        unit_id,
        created_at,
        status
      ) VALUES (
        COALESCE(NEW.paid_at::date, CURRENT_DATE),
        'SAIDA',
        COALESCE(NEW.paid_amount, NEW.valor),
        COALESCE(NEW.beneficiario, 'Pagamento - ' || NEW.id::text),
        v_account_id,
        NEW.category_id,
        NEW.unit_id,
        NOW(),
        'conciliado'
      )
      RETURNING id INTO v_transaction_id;
      
      -- Atualizar o payable com o ID da transaction criada
      NEW.matched_transaction_id := v_transaction_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para executar a função
DROP TRIGGER IF EXISTS trigger_create_transaction_on_payable_paid ON payables;
CREATE TRIGGER trigger_create_transaction_on_payable_paid
  BEFORE UPDATE ON payables
  FOR EACH ROW
  EXECUTE FUNCTION public.create_transaction_on_payable_paid();