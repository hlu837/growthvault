-- Enable pg_net extension for async HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Add trigger to send 2FA email when code is created
CREATE OR REPLACE FUNCTION public.send_2fa_email_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Use pg_net for async HTTP call to Edge Function
  PERFORM extensions.http_post(
    'http://localhost:54321/functions/v1/send-2fa-email',
    jsonb_build_object('record', row_to_json(NEW))::text,
    'application/json'
  );
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the insert
  RAISE WARNING 'Error calling send-2fa-email function: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_send_2fa_email ON public.two_factor_codes;

-- Create trigger for new two_factor_codes
CREATE TRIGGER trigger_send_2fa_email
AFTER INSERT ON public.two_factor_codes
FOR EACH ROW
EXECUTE FUNCTION public.send_2fa_email_trigger();
