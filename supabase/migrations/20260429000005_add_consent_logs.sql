-- Add consent log table for Section 18.3 digital signature requirements

CREATE TABLE IF NOT EXISTS public.consent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version_id UUID NOT NULL REFERENCES public.terms_and_conditions_versions(id) ON DELETE RESTRICT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.consent_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own consent logs" ON public.consent_logs;
DROP POLICY IF EXISTS "Users can select own consent logs" ON public.consent_logs;
DROP POLICY IF EXISTS "Admins can view all consent logs" ON public.consent_logs;
DROP POLICY IF EXISTS "No one can update consent logs" ON public.consent_logs;
DROP POLICY IF EXISTS "No one can delete consent logs" ON public.consent_logs;

CREATE POLICY "Users can insert own consent logs"
  ON public.consent_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can select own consent logs"
  ON public.consent_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all consent logs"
  ON public.consent_logs FOR SELECT
  TO authenticated
  USING (public.is_admin_or_staff(auth.uid()));

CREATE POLICY "No one can update consent logs"
  ON public.consent_logs FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No one can delete consent logs"
  ON public.consent_logs FOR DELETE
  TO authenticated
  USING (false);
