-- Fix inverted exchange rates
UPDATE public.exchange_rates SET rate = 0.92 WHERE base_currency = 'USD' AND target_currency = 'EUR';
UPDATE public.exchange_rates SET rate = 0.79 WHERE base_currency = 'USD' AND target_currency = 'GBP';
UPDATE public.exchange_rates SET rate = 1.36 WHERE base_currency = 'USD' AND target_currency = 'CAD';
UPDATE public.exchange_rates SET rate = 1600.00 WHERE base_currency = 'USD' AND target_currency = 'NGN';
UPDATE public.exchange_rates SET rate = 15.50 WHERE base_currency = 'USD' AND target_currency = 'GHS';
UPDATE public.exchange_rates SET rate = 153.00 WHERE base_currency = 'USD' AND target_currency = 'KES';
UPDATE public.exchange_rates SET rate = 18.50 WHERE base_currency = 'USD' AND target_currency = 'ZAR';

-- Also fix system_settings if they were used
UPDATE public.system_settings SET setting_value = 0.92 WHERE setting_key = 'eur_rate';
UPDATE public.system_settings SET setting_value = 0.79 WHERE setting_key = 'gbp_rate';
UPDATE public.system_settings SET setting_value = 1.36 WHERE setting_key = 'cad_rate';
UPDATE public.system_settings SET setting_value = 1600.00 WHERE setting_key = 'ngn_rate';
UPDATE public.system_settings SET setting_value = 15.50 WHERE setting_key = 'ghs_rate';
UPDATE public.system_settings SET setting_value = 153.00 WHERE setting_key = 'kes_rate';
UPDATE public.system_settings SET setting_value = 18.50 WHERE setting_key = 'zar_rate';
