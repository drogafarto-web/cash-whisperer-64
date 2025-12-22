-- Create units table
CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on units
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- RLS: Everyone authenticated can view units
CREATE POLICY "Authenticated users can view units"
ON public.units
FOR SELECT
TO authenticated
USING (true);

-- RLS: Only admins can manage units
CREATE POLICY "Admins can manage units"
ON public.units
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert the 4 laboratory units
INSERT INTO public.units (name, code) VALUES
  ('Rio Pomba', 'RIOPOMBA'),
  ('Mercês', 'MERCES'),
  ('Guarani', 'GUARANI'),
  ('Silveirânia', 'SILVEIRANIA');

-- Add unit_id to accounts
ALTER TABLE public.accounts 
  ADD COLUMN unit_id uuid REFERENCES public.units(id),
  ADD COLUMN type text DEFAULT 'CAIXA';

-- Add unit_id to transactions
ALTER TABLE public.transactions 
  ADD COLUMN unit_id uuid REFERENCES public.units(id);

-- Add unit_id and envelope_id to cash_closings
ALTER TABLE public.cash_closings 
  ADD COLUMN unit_id uuid REFERENCES public.units(id),
  ADD COLUMN envelope_id text UNIQUE;

-- Add unit_id to profiles (NULL = admin geral, with value = secretária dessa unidade)
ALTER TABLE public.profiles 
  ADD COLUMN unit_id uuid REFERENCES public.units(id);

-- Create function to get user's unit
CREATE OR REPLACE FUNCTION public.get_user_unit(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT unit_id FROM public.profiles WHERE id = _user_id
$$;

-- Update RLS on transactions to filter by unit
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
CREATE POLICY "Users can view transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  OR (
    created_by = auth.uid() 
    AND (
      public.get_user_unit(auth.uid()) IS NULL 
      OR unit_id = public.get_user_unit(auth.uid())
    )
  )
);

-- Update RLS on cash_closings
DROP POLICY IF EXISTS "Users can view cash closings" ON public.cash_closings;
CREATE POLICY "Users can view cash closings"
ON public.cash_closings
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.get_user_unit(auth.uid()) IS NULL
  OR unit_id = public.get_user_unit(auth.uid())
);

DROP POLICY IF EXISTS "Users can insert cash closings" ON public.cash_closings;
CREATE POLICY "Users can insert cash closings"
ON public.cash_closings
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = closed_by
  AND (
    public.get_user_unit(auth.uid()) IS NULL
    OR unit_id = public.get_user_unit(auth.uid())
  )
);

-- Update accounts RLS to include unit filtering
DROP POLICY IF EXISTS "All authenticated can view active accounts" ON public.accounts;
CREATE POLICY "Users can view accounts"
ON public.accounts
FOR SELECT
TO authenticated
USING (
  active = true
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.get_user_unit(auth.uid()) IS NULL
    OR unit_id = public.get_user_unit(auth.uid())
  )
);