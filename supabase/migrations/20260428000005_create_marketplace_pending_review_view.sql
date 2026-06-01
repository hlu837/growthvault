-- Create a view for admin review of marketplace products that are pending review.
-- This includes listings that are explicitly pending or have a medium risk score between 31 and 60.

CREATE OR REPLACE VIEW public.v_marketplace_products_pending_review AS
SELECT
  id,
  title,
  description,
  category,
  price,
  currency,
  images,
  thumbnail_url,
  status,
  stock_quantity,
  specifications,
  location,
  featured,
  created_by,
  created_at,
  updated_at,
  COALESCE((specifications ->> 'risk_score')::INT, 0) AS risk_score
FROM public.marketplace_products
WHERE status = 'pending_verification'
   OR COALESCE((specifications ->> 'risk_score')::INT, 0) BETWEEN 31 AND 60;
