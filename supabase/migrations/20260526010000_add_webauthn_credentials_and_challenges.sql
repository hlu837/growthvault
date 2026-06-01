-- Add WebAuthn credential storage and challenge tracking

CREATE TABLE IF NOT EXISTS public.webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  sign_count BIGINT NOT NULL DEFAULT 0,
  transports TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own webauthn credentials" ON public.webauthn_credentials;
CREATE POLICY "Users can insert own webauthn credentials"
  ON public.webauthn_credentials FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can select own webauthn credentials" ON public.webauthn_credentials;
CREATE POLICY "Users can select own webauthn credentials"
  ON public.webauthn_credentials FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own webauthn credentials" ON public.webauthn_credentials;
CREATE POLICY "Users can update own webauthn credentials"
  ON public.webauthn_credentials FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge TEXT NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + interval '10 minutes')
);

ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own webauthn challenges" ON public.webauthn_challenges;
CREATE POLICY "Users can insert own webauthn challenges"
  ON public.webauthn_challenges FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can select own webauthn challenges" ON public.webauthn_challenges;
CREATE POLICY "Users can select own webauthn challenges"
  ON public.webauthn_challenges FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own webauthn challenges" ON public.webauthn_challenges;
CREATE POLICY "Users can delete own webauthn challenges"
  ON public.webauthn_challenges FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
