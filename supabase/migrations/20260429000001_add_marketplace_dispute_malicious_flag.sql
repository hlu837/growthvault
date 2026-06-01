-- Add malicious dispute flag and enforce penalties for malicious disputes

ALTER TABLE public.marketplace_orders
  ADD COLUMN IF NOT EXISTS is_malicious BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.marketplace_orders.is_malicious IS 'Marks a dispute as malicious and triggers account penalties';

CREATE OR REPLACE FUNCTION public.fn_handle_malicious_dispute()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_malicious = TRUE
     AND (OLD IS NULL OR OLD.is_malicious IS DISTINCT FROM NEW.is_malicious) THEN
    UPDATE public.profiles
    SET is_frozen = TRUE,
        risk_score = COALESCE(risk_score, 0) + 50,
        updated_at = NOW()
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_dispute_malicious_trigger ON public.marketplace_orders;
CREATE TRIGGER marketplace_dispute_malicious_trigger
  AFTER INSERT OR UPDATE ON public.marketplace_orders
  FOR EACH ROW
  WHEN (NEW.is_malicious = TRUE)
  EXECUTE FUNCTION public.fn_handle_malicious_dispute();
