-- Add missing enum values for marketplace escrow flow
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'inspection';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'disputed';

-- Add escrow and dispute columns to marketplace_orders table
-- Migration: Add escrow tracking and dispute mechanism

ALTER TABLE public.marketplace_orders
ADD COLUMN IF NOT EXISTS total_escrow_hold_amount NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_escrow_paused BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS dispute_complaint_type TEXT,
ADD COLUMN IF NOT EXISTS dispute_description TEXT,
ADD COLUMN IF NOT EXISTS dispute_evidence_url TEXT,
ADD COLUMN IF NOT EXISTS dispute_opened_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS dispute_resolution_notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.marketplace_orders.total_escrow_hold_amount IS 'Amount held in escrow (total - commitment fee)';
COMMENT ON COLUMN public.marketplace_orders.is_escrow_paused IS 'Whether escrow release is paused due to dispute';
COMMENT ON COLUMN public.marketplace_orders.dispute_complaint_type IS 'Type of dispute complaint';
COMMENT ON COLUMN public.marketplace_orders.dispute_description IS 'Detailed description of the dispute';
COMMENT ON COLUMN public.marketplace_orders.dispute_evidence_url IS 'URL to evidence supporting the dispute';
COMMENT ON COLUMN public.marketplace_orders.dispute_opened_at IS 'When the dispute was opened';
COMMENT ON COLUMN public.marketplace_orders.dispute_resolved_at IS 'When the dispute was resolved';
COMMENT ON COLUMN public.marketplace_orders.dispute_resolution_notes IS 'Admin notes on dispute resolution';