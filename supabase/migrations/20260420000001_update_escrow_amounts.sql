-- Update existing orders to have escrow amounts calculated
UPDATE public.marketplace_orders
SET total_escrow_hold_amount = total_amount - COALESCE(
  (notes::jsonb ->> 'commitment_fee')::numeric, 0
)
WHERE order_status = 'inspection' AND notes IS NOT NULL;