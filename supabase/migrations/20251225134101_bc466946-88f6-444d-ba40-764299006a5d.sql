-- Create lis_users table for LIS operators reference
CREATE TABLE public.lis_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lis_id INTEGER,
  login VARCHAR(100) NOT NULL UNIQUE,
  nome VARCHAR(255) NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lis_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "All authenticated can view lis_users"
ON public.lis_users FOR SELECT
USING (true);

CREATE POLICY "Admins can manage lis_users"
ON public.lis_users FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_lis_users_updated_at
BEFORE UPDATE ON public.lis_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert 12 active LIS operators
INSERT INTO public.lis_users (lis_id, login, nome, active) VALUES
(1, '-', 'Administrador', true),
(2, 'DEBORAH', 'DEBORAH OLIVEIRA', true),
(3, 'RENATA', 'RENATA', true),
(4, 'BRUNO', 'BRUNO', true),
(6, 'IARA', 'IARA REIS', true),
(7, 'NÉLIA', 'NÉLIA', true),
(8, 'LABCLIN', 'LABCLIN', true),
(9, 'vaniamor', 'Vania do Carmo Moreira', true),
(12, 'DANIELE', 'DANIELE', true),
(14, 'LARA', 'LARA', true),
(15, 'Sabrina', 'SABRINA SILVEIRÂNIA', true),
(16, 'Emani', 'Emani', true);