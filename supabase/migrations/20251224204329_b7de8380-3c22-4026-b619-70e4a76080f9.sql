-- Add is_active column to profiles table for user deactivation
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Add last_access column to track when user last logged in
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_access timestamp with time zone;

-- Create index for faster filtering by active status
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

-- Create function to update last_access on login
CREATE OR REPLACE FUNCTION public.update_last_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET last_access = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- Create trigger to update last_access when user signs in
DROP TRIGGER IF EXISTS on_auth_user_signin ON auth.users;
-- Note: We'll update last_access from client side on login since we can't attach triggers to auth.users safely