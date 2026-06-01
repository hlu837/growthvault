-- Add terms versioning and user consent tracking for Section 16

CREATE TABLE IF NOT EXISTS public.terms_and_conditions_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  effective_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.terms_and_conditions_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view terms versions"
  ON public.terms_and_conditions_versions FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage terms versions"
  ON public.terms_and_conditions_versions FOR ALL
  TO authenticated
  USING (public.is_admin_or_staff(auth.uid()));

-- Add accepted_terms_version_id to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS accepted_terms_version_id UUID REFERENCES public.terms_and_conditions_versions(id) ON DELETE SET NULL;

-- Function to get latest terms version
CREATE OR REPLACE FUNCTION public.get_latest_terms_version()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.terms_and_conditions_versions
  ORDER BY effective_date DESC
  LIMIT 1;
$$;

-- Function to check if user needs to accept new terms
CREATE OR REPLACE FUNCTION public.user_needs_terms_acceptance(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT accepted_terms_version_id FROM public.profiles WHERE id = p_user_id),
    '00000000-0000-0000-0000-000000000000'::UUID
  ) != public.get_latest_terms_version();
$$;

-- Trigger to notify all active users when new terms version is added
CREATE OR REPLACE FUNCTION public.fn_notify_terms_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert notification for all active users
  INSERT INTO public.notifications (user_id, title, body, is_read)
  SELECT
    p.id,
    'Terms and Conditions Updated',
    'Please review and accept the updated terms and conditions to continue using the platform.',
    FALSE
  FROM public.profiles p
  WHERE p.account_status = 'active'
    AND p.is_frozen = FALSE;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS terms_update_notification_trigger ON public.terms_and_conditions_versions;
CREATE TRIGGER terms_update_notification_trigger
  AFTER INSERT ON public.terms_and_conditions_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_terms_update();
