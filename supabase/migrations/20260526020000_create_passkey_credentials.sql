CREATE TABLE IF NOT EXISTS public.passkey_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.passkey_credentials ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can insert their own passkeys"
  ON public.passkey_credentials FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can select their own passkeys"
  ON public.passkey_credentials FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own passkeys"
  ON public.passkey_credentials FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
