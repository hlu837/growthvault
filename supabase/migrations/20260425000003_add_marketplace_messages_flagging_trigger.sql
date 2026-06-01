-- Add message flagging functionality to existing marketplace_messages table
-- Note: marketplace_messages table already exists from marketplace_schema.sql

-- Create function to detect contact info in marketplace messages
CREATE OR REPLACE FUNCTION public.fn_filter_contact_info()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  email_regex TEXT := '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}';
  phone_regex TEXT := '\+?\d[\d\s\-().]{6,}\d';
BEGIN
  IF NEW.content IS NOT NULL AND (
       NEW.content ~* email_regex
       OR NEW.content ~* phone_regex
     ) THEN
    NEW.is_flagged := true;

    UPDATE public.profiles
    SET risk_score = COALESCE(risk_score, 0) + 20
    WHERE id = NEW.sender_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to run the filter before inserting marketplace messages
DROP TRIGGER IF EXISTS marketplace_messages_filter_trigger ON public.marketplace_messages;

CREATE TRIGGER marketplace_messages_filter_trigger
  BEFORE INSERT ON public.marketplace_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_filter_contact_info();
