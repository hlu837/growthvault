-- Fix system_settings table exposure
-- Drop the overly permissive policy that allows anyone to view settings
DROP POLICY IF EXISTS "Anyone can view settings" ON public.system_settings;

-- Create new restrictive policy - only admin and staff can view settings
CREATE POLICY "Admin and staff can view settings" 
  ON public.system_settings
  FOR SELECT 
  TO authenticated
  USING (is_admin_or_staff(auth.uid()));

-- Allow all authenticated users to read only bank configuration keys
CREATE POLICY "Authenticated can view bank settings"
  ON public.system_settings
  FOR SELECT
  TO authenticated
  USING (setting_key LIKE 'bank\_%');