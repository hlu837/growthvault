-- Prevent price manipulation after commitment fee is paid (Section 14.4)
-- Price becomes read-only once an order exists with status != 'cancelled'

CREATE OR REPLACE FUNCTION public.fn_prevent_price_update_after_commitment()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  -- Only check if price is actually being changed
  IF OLD.price != NEW.price THEN
    -- Check if there are any active orders for this product
    IF EXISTS (
      SELECT 1 FROM public.marketplace_orders
      WHERE product_id = NEW.id
      AND order_status != 'cancelled'
    ) THEN
      RAISE EXCEPTION 'Price cannot be changed after commitment fee is paid';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_price_update_after_commitment_trigger ON public.marketplace_products;
CREATE TRIGGER prevent_price_update_after_commitment_trigger
  BEFORE UPDATE ON public.marketplace_products
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_price_update_after_commitment();