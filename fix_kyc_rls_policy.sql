-- Fix KYC Security Block for Marketplace Products
-- This updates the RLS policy to require KYC approval for high-value categories (real_estate, automobile)

-- Drop existing policy
DROP POLICY IF EXISTS "Active users can insert marketplace products" ON public.marketplace_products;

-- Create updated policy with KYC verification
CREATE POLICY "Active users can insert marketplace products"
  ON public.marketplace_products
  FOR INSERT
  WITH CHECK (
    (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
    AND (
      category NOT IN ('real_estate', 'automobile')
      OR (SELECT kyc_status FROM public.profiles WHERE id = auth.uid()) = 'approved'
    )
  );

-- Also update the UPDATE policy to maintain consistency
DROP POLICY IF EXISTS "Active users can update marketplace products" ON public.marketplace_products;

CREATE POLICY "Active users can update marketplace products"
  ON public.marketplace_products
  FOR UPDATE
  USING (
    (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
    AND (
      category NOT IN ('real_estate', 'automobile')
      OR (SELECT kyc_status FROM public.profiles WHERE id = auth.uid()) = 'approved'
    )
  )
  WITH CHECK (
    (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
    AND (
      category NOT IN ('real_estate', 'automobile')
      OR (SELECT kyc_status FROM public.profiles WHERE id = auth.uid()) = 'approved'
    )
  );
