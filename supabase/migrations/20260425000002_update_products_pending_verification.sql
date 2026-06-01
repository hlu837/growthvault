-- Update existing products to pending_verification status if they don't have required documents
-- This should be run AFTER the main document validation trigger migration has been applied
-- and the enum value 'pending_verification' has been committed

UPDATE public.marketplace_products
SET status = 'pending_verification'
WHERE status = 'active'
  AND (
    (category = 'real_estate' AND NOT (
      specifications->'seller_documents' @> '[{"name": "c_of_o"}]' AND
      specifications->'seller_documents' @> '[{"name": "deed_of_assignment"}]'
    ))
    OR
    (category = 'automobile' AND NOT (
      specifications->'seller_documents' @> '[{"name": "proof_of_ownership"}]'
    ))
  );