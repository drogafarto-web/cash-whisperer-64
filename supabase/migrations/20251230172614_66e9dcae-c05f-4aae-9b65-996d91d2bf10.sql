-- Simplificar trigger para NÃO criar transactions
-- A criação de transactions será feita APENAS pela função JavaScript
-- createTransactionFromPayable() que tem acesso ao user.id
CREATE OR REPLACE FUNCTION public.create_transaction_on_payable_paid()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Este trigger foi simplificado para NÃO criar transactions
  -- Motivo: O trigger não tem acesso ao usuário autenticado (auth.uid())
  -- e a tabela transactions exige created_by NOT NULL
  
  -- A criação de transactions ao pagar um payable é feita pela
  -- função JavaScript createTransactionFromPayable() que tem 
  -- acesso ao supabase.auth.getUser()
  
  RETURN NEW;
END;
$function$;