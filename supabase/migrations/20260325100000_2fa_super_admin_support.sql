-- Add support for super_admin role and two-factor authentication support

-- Update app_role enum to include super_admin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role' AND EXISTS (SELECT 1 FROM unnest(enum_range(NULL::public.app_role)) v WHERE v = 'super_admin')) THEN
        ALTER TYPE public.app_role ADD VALUE 'super_admin';
    END IF;
END$$;

-- Enable two-factor settings on profile
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS two_factor_method TEXT DEFAULT 'email';

-- Create two-factor codes table
CREATE TABLE IF NOT EXISTS public.two_factor_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'withdrawal',
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + interval '10 minutes')
);

ALTER TABLE public.two_factor_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own two-factor code" ON public.two_factor_codes;
CREATE POLICY "Users can insert own two-factor code"
  ON public.two_factor_codes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can select own two-factor code" ON public.two_factor_codes;
CREATE POLICY "Users can select own two-factor code"
  ON public.two_factor_codes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND expires_at > now());

DROP POLICY IF EXISTS "Users can update own two-factor code as used" ON public.two_factor_codes;
CREATE POLICY "Users can update own two-factor code as used"
  ON public.two_factor_codes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND used = TRUE);

-- Notifications table for platform announcements
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own notifications" ON public.notifications;
CREATE POLICY "Users can select own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Transaction tokens for step-up auth during withdrawal and other high-risk operations
CREATE TABLE IF NOT EXISTS public.transaction_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'withdrawal',
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes')
);

ALTER TABLE public.transaction_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create their own transaction tokens" ON public.transaction_tokens;
CREATE POLICY "Users can create their own transaction tokens"
  ON public.transaction_tokens FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read own transaction tokens" ON public.transaction_tokens;
CREATE POLICY "Users can read own transaction tokens"
  ON public.transaction_tokens FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can mark own transaction tokens used" ON public.transaction_tokens;
CREATE POLICY "Users can mark own transaction tokens used"
  ON public.transaction_tokens FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND used = TRUE);

-- Update helper function for super_admin role in policy checks
CREATE OR REPLACE FUNCTION public.is_admin_or_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin', 'staff')
  );
$$;

-- Transaction token validation helper for withdrawal and high-risk operations
CREATE OR REPLACE FUNCTION public.is_transaction_token_valid(_user_id UUID, _token UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.transaction_tokens
    WHERE user_id = _user_id
      AND token = _token
      AND type = 'withdrawal'
      AND used = FALSE
      AND expires_at > now()
  );
$$;

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS transaction_token UUID;

DROP POLICY IF EXISTS "Users can create withdrawals" ON public.withdrawals;
CREATE POLICY "Users can create withdrawals"
  ON public.withdrawals FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      (SELECT COALESCE(two_factor_enabled, FALSE) FROM public.profiles WHERE id = auth.uid()) = FALSE
      OR (
        transaction_token IS NOT NULL
        AND public.is_transaction_token_valid(user_id, transaction_token)
      )
    )
  );

-- Allow admins and super_admins to see all withdrawals and update
DROP POLICY IF EXISTS "Admins and super_admins can view all withdrawals" ON public.withdrawals;
CREATE POLICY "Admins and super_admins can view all withdrawals"
  ON public.withdrawals FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admins and super_admins can update withdrawals" ON public.withdrawals;
CREATE POLICY "Admins and super_admins can update withdrawals"
  ON public.withdrawals FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'super_admin'))
  WITH CHECK (user_id = auth.uid());

