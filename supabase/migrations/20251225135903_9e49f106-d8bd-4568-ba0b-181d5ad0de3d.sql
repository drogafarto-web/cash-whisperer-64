-- 1. Add LIS identity columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lis_login VARCHAR(100);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lis_id INTEGER;

-- Index for fast LIS login lookup
CREATE INDEX IF NOT EXISTS idx_profiles_lis_login ON public.profiles(lis_login);

-- 2. Create profile_units table (N:N - multiple units per user)
CREATE TABLE IF NOT EXISTS public.profile_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (profile_id, unit_id)
);

ALTER TABLE public.profile_units ENABLE ROW LEVEL SECURITY;

-- RLS policies for profile_units
CREATE POLICY "Authenticated users can view profile_units"
  ON public.profile_units FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert profile_units"
  ON public.profile_units FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update profile_units"
  ON public.profile_units FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete profile_units"
  ON public.profile_units FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Create profile_functions table (operational functions)
CREATE TABLE IF NOT EXISTS public.profile_functions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  function VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (profile_id, function)
);

ALTER TABLE public.profile_functions ENABLE ROW LEVEL SECURITY;

-- RLS policies for profile_functions
CREATE POLICY "Authenticated users can view profile_functions"
  ON public.profile_functions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert profile_functions"
  ON public.profile_functions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update profile_functions"
  ON public.profile_functions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete profile_functions"
  ON public.profile_functions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Migrate existing unit_id data to profile_units
INSERT INTO public.profile_units (profile_id, unit_id, is_primary)
SELECT id, unit_id, true 
FROM public.profiles 
WHERE unit_id IS NOT NULL
ON CONFLICT (profile_id, unit_id) DO NOTHING;