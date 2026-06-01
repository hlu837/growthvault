-- Add audit logging for admin actions around freezes, blacklists, and commission forfeits

CREATE TABLE IF NOT EXISTS public.admin_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  policy_section TEXT NOT NULL,
  details TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view admin action logs"
  ON public.admin_action_logs FOR SELECT
  USING (public.is_admin_or_staff(auth.uid()));

CREATE POLICY "Admins can insert admin action logs"
  ON public.admin_action_logs FOR INSERT
  WITH CHECK (public.is_admin_or_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_admin_id UUID,
  p_target_user_id UUID,
  p_action TEXT,
  p_policy_section TEXT,
  p_details TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.admin_action_logs (
    admin_id,
    target_user_id,
    action,
    policy_section,
    details,
    metadata
  ) VALUES (
    p_admin_id,
    p_target_user_id,
    p_action,
    p_policy_section,
    p_details,
    p_metadata
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_log_admin_profile_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
BEGIN
  IF NEW.is_frozen = TRUE
     AND (OLD IS NULL OR OLD.is_frozen IS DISTINCT FROM NEW.is_frozen) THEN
    INSERT INTO public.admin_action_logs (
      admin_id,
      target_user_id,
      action,
      policy_section,
      details
    ) VALUES (
      v_admin_id,
      NEW.id,
      'freeze_account',
      '15A.7',
      'Account frozen by admin action on profiles table'
    );
  END IF;

  IF NEW.account_status = 'blacklisted'
     AND (OLD IS NULL OR OLD.account_status IS DISTINCT FROM NEW.account_status) THEN
    INSERT INTO public.admin_action_logs (
      admin_id,
      target_user_id,
      action,
      policy_section,
      details
    ) VALUES (
      v_admin_id,
      NEW.id,
      'blacklist_user',
      '15A.7',
      'User blacklisted by admin action on profiles table'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_profile_action_log_trigger ON public.profiles;
CREATE TRIGGER admin_profile_action_log_trigger
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_log_admin_profile_action();

CREATE OR REPLACE FUNCTION public.fn_log_forfeited_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.fee_type = 'forfeited_fee' THEN
    INSERT INTO public.admin_action_logs (
      admin_id,
      target_user_id,
      action,
      policy_section,
      details,
      metadata
    ) VALUES (
      NEW.created_by,
      NEW.user_id,
      'forfeit_commission',
      '15A.3',
      'Forfeited commission from breach refund',
      jsonb_build_object(
        'fee_id', NEW.id,
        'order_id', NEW.order_id,
        'amount', NEW.amount
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS platform_fees_forfeited_commission_log_trigger ON public.platform_fees;
CREATE TRIGGER platform_fees_forfeited_commission_log_trigger
  AFTER INSERT ON public.platform_fees
  FOR EACH ROW
  WHEN (NEW.fee_type = 'forfeited_fee')
  EXECUTE FUNCTION public.fn_log_forfeited_commission();
