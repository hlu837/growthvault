-- Add platform settings for marketplace commission and inspection windows

CREATE TABLE public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value NUMERIC NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view platform settings"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can modify platform settings"
  ON public.platform_settings FOR INSERT, UPDATE, DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

ALTER TABLE public.platform_settings
  ADD CONSTRAINT chk_platform_settings_commission_rate_min
  CHECK (
    setting_key != 'marketplace_commission_rate'
    OR setting_value >= 10
  );

INSERT INTO public.platform_settings (setting_key, setting_value, description) VALUES
  ('marketplace_commission_rate', 10.00, 'Marketplace commitment fee percentage. Minimum allowed is 10%.'),
  ('marketplace_inspection_days_electronic', 1.00, 'Inspection window in days for electronic marketplace orders.'),
  ('marketplace_inspection_days_automobile', 3.00, 'Inspection window in days for automobile marketplace orders.'),
  ('marketplace_inspection_days_real_estate', 7.00, 'Inspection window in days for real estate marketplace orders.')
ON CONFLICT (setting_key) DO NOTHING;

CREATE TRIGGER update_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
