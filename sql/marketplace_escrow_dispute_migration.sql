-- Add escrow and dispute columns to marketplace_orders table
-- Migration: Add escrow tracking and dispute mechanism

ALTER TABLE public.marketplace_orders
ADD COLUMN total_escrow_hold_amount NUMERIC(15,2) DEFAULT 0,
ADD COLUMN is_escrow_paused BOOLEAN DEFAULT false,
ADD COLUMN dispute_complaint_type TEXT,
ADD COLUMN dispute_description TEXT,
ADD COLUMN dispute_evidence_url TEXT,
ADD COLUMN dispute_opened_at TIMESTAMPTZ,
ADD COLUMN dispute_resolved_at TIMESTAMPTZ,
ADD COLUMN dispute_resolution_notes TEXT;

-- Update existing orders to have escrow amounts calculated
UPDATE public.marketplace_orders
SET total_escrow_hold_amount = total_amount - COALESCE(
  (notes::jsonb ->> 'commitment_fee')::numeric, 0
)
WHERE order_status = 'inspection' AND notes IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.marketplace_orders.total_escrow_hold_amount IS 'Amount held in escrow (total - commitment fee)';
COMMENT ON COLUMN public.marketplace_orders.is_escrow_paused IS 'Whether escrow release is paused due to dispute';
COMMENT ON COLUMN public.marketplace_orders.dispute_complaint_type IS 'Type of dispute complaint';
COMMENT ON COLUMN public.marketplace_orders.dispute_description IS 'Detailed description of the dispute';
COMMENT ON COLUMN public.marketplace_orders.dispute_evidence_url IS 'URL to evidence supporting the dispute';
COMMENT ON COLUMN public.marketplace_orders.dispute_opened_at IS 'When the dispute was opened';
COMMENT ON COLUMN public.marketplace_orders.dispute_resolved_at IS 'When the dispute was resolved';
COMMENT ON COLUMN public.marketplace_orders.dispute_resolution_notes IS 'Admin notes on dispute resolution';