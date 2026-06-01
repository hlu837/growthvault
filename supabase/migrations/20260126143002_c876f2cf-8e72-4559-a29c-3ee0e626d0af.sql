-- Add explicit DENY policies to wallets table for defense-in-depth
-- This ensures all wallet modifications MUST go through SECURITY DEFINER RPCs

-- Deny direct wallet updates (force use of RPC functions like process_wallet_transfer, approve_withdrawal, etc.)
CREATE POLICY "Deny direct wallet updates" ON public.wallets
  FOR UPDATE TO authenticated
  USING (false);

-- Deny direct wallet inserts (wallets are created by handle_new_user trigger and RPCs only)
CREATE POLICY "Deny direct wallet inserts" ON public.wallets
  FOR INSERT TO authenticated
  WITH CHECK (false);

-- Deny direct wallet deletes (wallets should never be deleted directly)
CREATE POLICY "Deny direct wallet deletes" ON public.wallets
  FOR DELETE TO authenticated
  USING (false);