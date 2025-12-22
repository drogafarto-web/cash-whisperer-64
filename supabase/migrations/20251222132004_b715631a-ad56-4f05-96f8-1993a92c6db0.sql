-- Create imports table to track import history
CREATE TABLE public.imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid REFERENCES units(id),
  file_name text NOT NULL,
  period_start date,
  period_end date,
  total_records int NOT NULL DEFAULT 0,
  imported_records int NOT NULL DEFAULT 0,
  skipped_records int NOT NULL DEFAULT 0,
  imported_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;

-- Admins can view all imports
CREATE POLICY "Admins can view all imports" ON public.imports
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view imports from their unit
CREATE POLICY "Users can view unit imports" ON public.imports
  FOR SELECT USING (
    unit_id = get_user_unit(auth.uid()) OR 
    get_user_unit(auth.uid()) IS NULL
  );

-- Authenticated users can insert imports
CREATE POLICY "Users can insert imports" ON public.imports
  FOR INSERT WITH CHECK (auth.uid() = imported_by);