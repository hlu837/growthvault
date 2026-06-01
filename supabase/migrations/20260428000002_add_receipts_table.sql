-- Migration: Add receipts table for marketplace payment receipts
-- Purpose: capture commitment payment receipts and store them for later download

CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL UNIQUE,
  order_id UUID NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receipt_type TEXT NOT NULL,
  receipt_title TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL,
  receipt_data JSONB NOT NULL,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_receipts_order_id ON public.receipts(order_id);
CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON public.receipts(user_id);
