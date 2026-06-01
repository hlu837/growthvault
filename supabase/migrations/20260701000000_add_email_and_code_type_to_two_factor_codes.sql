-- Add email, code_type, and is_used columns to two_factor_codes
ALTER TABLE public.two_factor_codes
  ADD COLUMN IF NOT EXISTS email TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS code_type TEXT NOT NULL DEFAULT 'login',
  ADD COLUMN IF NOT EXISTS is_used BOOLEAN NOT NULL DEFAULT FALSE;

-- Keep existing `used` column for backward compatibility (optional).

-- Update Row Level Security policies to include the new columns where needed.
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
  WITH CHECK (user_id = auth.uid() AND is_used = TRUE);
