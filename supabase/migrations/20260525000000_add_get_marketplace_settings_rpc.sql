-- Add RPC to expose marketplace platform settings
CREATE OR REPLACE FUNCTION public.get_marketplace_settings()
RETURNS TABLE (
  setting_key TEXT,
  setting_value NUMERIC,
  description TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    setting_key,
    setting_value,
    description
  FROM public.platform_settings
  WHERE setting_key LIKE 'marketplace_%'
  ORDER BY setting_key;
$$;

GRANT EXECUTE ON FUNCTION public.get_marketplace_settings() TO authenticated;
