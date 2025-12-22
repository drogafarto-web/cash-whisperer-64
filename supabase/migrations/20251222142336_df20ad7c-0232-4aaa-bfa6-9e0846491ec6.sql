-- Create partners table
CREATE TABLE public.partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('CLIENTE', 'FORNECEDOR')),
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  default_category_id UUID REFERENCES public.categories(id),
  expected_amount NUMERIC DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add partner_id to transactions
ALTER TABLE public.transactions ADD COLUMN partner_id UUID REFERENCES public.partners(id);

-- Enable RLS
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage partners" 
ON public.partners 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "All authenticated can view active partners" 
ON public.partners 
FOR SELECT 
USING (active = true);

-- Trigger for updated_at
CREATE TRIGGER update_partners_updated_at
BEFORE UPDATE ON public.partners
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();