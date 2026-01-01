-- ============================================
-- FASE 1: Corrigir RLS do payables para ocultar categorias informais de não-admins
-- ============================================

-- Primeiro, verificar se a função has_role existe, se não, criar uma helper
CREATE OR REPLACE FUNCTION public.is_admin_user(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = $1 AND ur.role = 'admin'
  );
$$;

-- Remover política atual permissiva de SELECT
DROP POLICY IF EXISTS "Users can view payables" ON public.payables;

-- Nova política: Admin vê tudo, outros não veem categorias informais
CREATE POLICY "Users can view payables filtered"
ON public.payables
FOR SELECT
USING (
  -- Admin vê tudo
  public.is_admin_user(auth.uid())
  OR
  -- Outros usuários: só veem payables SEM categoria informal
  (
    NOT EXISTS (
      SELECT 1 FROM public.categories c
      WHERE c.id = payables.category_id
      AND c.name ILIKE '%informal%'
    )
    OR payables.category_id IS NULL
  )
);