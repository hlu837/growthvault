-- Create trigger to enforce wallet balance checks for marketplace orders
-- This runs before inserting a new marketplace order and blocks the insert if the buyer lacks sufficient balance.

CREATE OR REPLACE FUNCTION public.marketplace_order_wallet_balance_check()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  commitment_fee NUMERIC := 0;
  buyer_balance NUMERIC := 0;
  profile_balance_column_exists BOOLEAN := FALSE;
BEGIN
  IF NEW.notes IS NOT NULL THEN
    BEGIN
      commitment_fee := COALESCE((NEW.notes::json ->> 'commitment_fee')::numeric, 0);
    EXCEPTION WHEN others THEN
      commitment_fee := 0;
    END;
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'wallet_balance'
  )
  INTO profile_balance_column_exists;

  IF profile_balance_column_exists THEN
    EXECUTE 'SELECT COALESCE(MAX(wallet_balance), 0) FROM public.profiles WHERE id = $1'
      INTO buyer_balance
      USING NEW.user_id;
  ELSE
    SELECT COALESCE(SUM(balance), 0)
    INTO buyer_balance
    FROM public.wallets
    WHERE user_id = NEW.user_id;
  END IF;

  IF buyer_balance < commitment_fee THEN
    RAISE EXCEPTION 'Insufficient wallet balance for buyer %: required %, available %', NEW.user_id, commitment_fee, buyer_balance;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_order_wallet_balance_check_trigger ON public.marketplace_orders;

CREATE TRIGGER marketplace_order_wallet_balance_check_trigger
  BEFORE INSERT ON public.marketplace_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.marketplace_order_wallet_balance_check();
