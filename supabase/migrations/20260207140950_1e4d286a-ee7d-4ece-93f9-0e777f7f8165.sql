
-- Create fraud_flags table to store automated risk detection results
CREATE TABLE public.fraud_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  risk_score INTEGER NOT NULL DEFAULT 0,
  flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'monitoring',
  auto_action_taken TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;

-- Only admins can view fraud flags
CREATE POLICY "Admins can view all fraud flags"
ON public.fraud_flags
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update fraud flags (for review actions)
CREATE POLICY "Admins can update fraud flags"
ON public.fraud_flags
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow insert via edge function (service role) or admin
CREATE POLICY "Admins can insert fraud flags"
ON public.fraud_flags
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow delete for admins (to clear resolved flags)
CREATE POLICY "Admins can delete fraud flags"
ON public.fraud_flags
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to auto-update updated_at
CREATE TRIGGER update_fraud_flags_updated_at
BEFORE UPDATE ON public.fraud_flags
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for quick lookups
CREATE INDEX idx_fraud_flags_user_id ON public.fraud_flags(user_id);
CREATE INDEX idx_fraud_flags_risk_score ON public.fraud_flags(risk_score DESC);
CREATE INDEX idx_fraud_flags_status ON public.fraud_flags(status);
