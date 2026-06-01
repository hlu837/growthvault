-- Migration: Align PayPal transaction status constraint with normalized PayPal statuses
-- Date: 2026-05-23

ALTER TABLE public.paypal_transactions
  DROP CONSTRAINT IF EXISTS paypal_transactions_status_check;

ALTER TABLE public.paypal_transactions
  ADD CONSTRAINT paypal_transactions_status_check
  CHECK (status IN (
    'pending',
    'approved',
    'completed',
    'denied',
    'refunded',
    'expired',
    'cancelled',
    'failed'
  ));
