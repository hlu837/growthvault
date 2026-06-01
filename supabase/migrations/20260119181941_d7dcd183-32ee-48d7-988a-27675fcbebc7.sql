-- Add preferred_currency column to profiles
ALTER TABLE public.profiles
ADD COLUMN preferred_currency TEXT NOT NULL DEFAULT 'USD';

-- Create exchange_rates table for dynamic rates
CREATE TABLE public.exchange_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  target_currency TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(base_currency, target_currency)
);

-- Enable RLS
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- Everyone can read exchange rates
CREATE POLICY "Anyone can view exchange rates" ON public.exchange_rates
  FOR SELECT USING (true);

-- Only admins can manage rates
CREATE POLICY "Admins can manage exchange rates" ON public.exchange_rates
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert initial exchange rates (USD as base)
INSERT INTO public.exchange_rates (base_currency, target_currency, rate) VALUES
  ('USD', 'USD', 1.00),
  ('USD', 'NGN', 1600.00),
  ('USD', 'GBP', 0.79),
  ('USD', 'EUR', 0.92),
  ('USD', 'CAD', 1.36),
  ('USD', 'GHS', 15.50),
  ('USD', 'KES', 153.00),
  ('USD', 'ZAR', 18.50);