-- Add VIN and serial number fields to marketplace_products table
ALTER TABLE public.marketplace_products
  ADD COLUMN IF NOT EXISTS vin_number TEXT;

ALTER TABLE public.marketplace_products
  ADD COLUMN IF NOT EXISTS serial_number TEXT;

-- Add indexes for searchable fields
CREATE INDEX IF NOT EXISTS idx_products_vin_number ON public.marketplace_products(vin_number) WHERE vin_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_serial_number ON public.marketplace_products(serial_number) WHERE serial_number IS NOT NULL;