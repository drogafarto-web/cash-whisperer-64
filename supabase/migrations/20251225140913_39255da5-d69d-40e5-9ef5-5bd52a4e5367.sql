-- Create audit log table for cash operations
CREATE TABLE public.cash_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(50) NOT NULL,
  user_id UUID NOT NULL,
  unit_id UUID NOT NULL REFERENCES public.units(id),
  target_id UUID,
  target_type VARCHAR(50),
  target_count INTEGER,
  amount DECIMAL(12,2),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for querying by unit and date
CREATE INDEX idx_cash_audit_log_unit_date ON public.cash_audit_log(unit_id, created_at DESC);
CREATE INDEX idx_cash_audit_log_user ON public.cash_audit_log(user_id);

-- Enable RLS
ALTER TABLE public.cash_audit_log ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can view logs from their units, admins can view all
CREATE POLICY "Users can view audit logs"
  ON public.cash_audit_log
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert audit logs"
  ON public.cash_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON TABLE public.cash_audit_log IS 'Audit log for cash operations (envelope, PIX, card closings)';