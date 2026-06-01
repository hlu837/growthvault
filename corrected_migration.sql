-- Complete SQL Migration Script for Sections 4, 5, and 6

-- Section 4: Security updates
-- Ensure marketplace_messages exists with moderation fields
CREATE TABLE IF NOT EXISTS public.marketplace_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_flagged BOOLEAN DEFAULT false,
  flagged_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.marketplace_messages
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false;

ALTER TABLE public.marketplace_messages
  ADD COLUMN IF NOT EXISTS flagged_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.marketplace_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON public.marketplace_messages(receiver_id);

-- Ensure profiles.risk_score exists with default 0
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0;

UPDATE public.profiles
SET risk_score = 0
WHERE risk_score IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN risk_score SET DEFAULT 0;

ALTER TABLE public.profiles
  ALTER COLUMN risk_score SET NOT NULL;

-- Section 5 & 6: Finance updates
-- Add missing order status value(s)
DO \$\$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = 'public.order_status'::regtype
      AND enumlabel = 'refund_pending'
  ) THEN
    ALTER TYPE public.order_status ADD VALUE 'refund_pending';
  END IF;
END
\$\$;

-- Create marketplace_refunds table
CREATE TABLE IF NOT EXISTS public.marketplace_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE RESTRICT,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  amount_refunded NUMERIC(15,2) NOT NULL CHECK (amount_refunded >= 0),
  reason_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_refunds_order_id ON public.marketplace_refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_refunds_admin_id ON public.marketplace_refunds(admin_id);

-- Safety function: refundable amount is derived only from marketplace_orders
CREATE OR REPLACE FUNCTION public.fn_calculate_refundable_amount(p_order_id UUID)
RETURNS NUMERIC(15,2)
LANGUAGE SQL
STABLE
AS \$\$
  SELECT COALESCE(total_escrow_hold_amount, 0)
  FROM public.marketplace_orders
  WHERE id = p_order_id;
\$\$;

-- Ensure platform_settings table exists and has commission rate floor constraint
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value NUMERIC NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add constraint if it doesn't exist
DO \$\$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'chk_platform_settings_commission_rate_min'
      AND n.nspname = 'public'
      AND t.relname = 'platform_settings'
  ) THEN
    ALTER TABLE public.platform_settings
      ADD CONSTRAINT chk_platform_settings_commission_rate_min
      CHECK (
        setting_key != 'marketplace_commission_rate'
        OR setting_value >= 10
      );
  END IF;
END
\$\$;
