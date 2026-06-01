-- Migration: Add pending_delivery order status and dispute tracking fields
-- Purpose: support replacement flows with locked escrow and extended delivery handling

ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pending_delivery';

ALTER TABLE public.marketplace_orders
  ADD COLUMN IF NOT EXISTS dispute_preferred_resolution TEXT;

COMMENT ON COLUMN public.marketplace_orders.dispute_preferred_resolution IS 'Preferred dispute outcome selected by buyer at dispute creation';
