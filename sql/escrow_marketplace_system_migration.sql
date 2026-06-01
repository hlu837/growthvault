-- =============================================
-- ESCROW MARKETPLACE SYSTEM MIGRATION
-- =============================================
-- Purpose: Comprehensive escrow, transaction state, and dispute management system
-- Date: May 19, 2026
-- This migration creates a robust escrow system with state tracking,
-- dispute resolution, and audit logging for marketplace transactions

-- =============================================
-- 1. ENUMS - Transaction States
-- =============================================

-- Escrow transaction status (main states)
CREATE TYPE public.escrow_status AS ENUM (
  'pending_payment',      -- Waiting for buyer to fund
  'funded',               -- Funds received, held in escrow
  'under_review',         -- Transaction in progress
  'ready_for_disbursement', -- Conditions met, awaiting confirmation
  'disbursed',            -- Funds released to seller
  'refunded',             -- Funds returned to buyer
  'disputed',             -- Dispute filed
  'cancelled'             -- Transaction cancelled
);

-- Escrow milestone/stage
CREATE TYPE public.escrow_stage AS ENUM (
  'funding',              -- Awaiting buyer payment
  'seller_confirmation',  -- Seller confirms receipt of funds
  'delivery',             -- Item in transit/delivery phase
  'delivery_confirmation',-- Buyer confirms delivery
  'completion',           -- Ready for disbursement
  'post_disbursement'     -- After funds released
);

-- Dispute status
CREATE TYPE public.dispute_status AS ENUM (
  'opened',               -- Dispute just created
  'evidence_pending',     -- Awaiting evidence from both parties
  'under_investigation',  -- Admin/mediator reviewing
  'seller_response_pending', -- Waiting for seller response
  'resolved',             -- Resolution decision made
  'closed',               -- Dispute closed
  'escalated'             -- Escalated to higher authority
);

-- Dispute resolution outcome
CREATE TYPE public.dispute_resolution AS ENUM (
  'refund_buyer',         -- Full refund to buyer
  'partial_refund',       -- Partial refund to buyer
  'release_to_seller',    -- Full release to seller
  'split_funds',          -- Split between parties
  'pending'               -- Still under review
);

-- Refund reason
CREATE TYPE public.refund_reason AS ENUM (
  'buyer_request',
  'seller_cancelled',
  'item_not_received',
  'item_damaged',
  'item_not_as_described',
  'fraudulent_transaction',
  'dispute_resolution',
  'admin_decision',
  'system_error'
);

-- =============================================
-- 2. ESCROW TRANSACTIONS TABLE (Enhanced)
-- =============================================

CREATE TABLE IF NOT EXISTS public.escrow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference Information
  escrow_reference TEXT UNIQUE NOT NULL DEFAULT 'ESC-' || LPAD(FLOOR(RANDOM() * 999999999)::TEXT, 9, '0'),
  marketplace_order_id UUID NOT NULL REFERENCES public.marketplace_orders(id) ON DELETE CASCADE,
  
  -- Party Information
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  
  -- Amount Information
  escrow_amount NUMERIC(15,2) NOT NULL CHECK (escrow_amount > 0),
  currency TEXT DEFAULT 'USD',
  platform_fee NUMERIC(15,2) DEFAULT 0,
  seller_payout_amount NUMERIC(15,2) NOT NULL,
  
  -- Wallet References
  buyer_source_wallet TEXT NOT NULL, -- Which wallet funds come from (e.g., 'savings', 'trading_principal')
  seller_payment_wallet TEXT DEFAULT 'sales_proceeds', -- Which wallet seller gets paid to
  
  -- Status Tracking
  escrow_status escrow_status DEFAULT 'pending_payment',
  escrow_stage escrow_stage DEFAULT 'funding',
  
  -- Timeline
  created_at TIMESTAMPTZ DEFAULT now(),
  funded_at TIMESTAMPTZ,
  seller_confirmed_at TIMESTAMPTZ,
  delivery_confirmed_at TIMESTAMPTZ,
  ready_for_disbursement_at TIMESTAMPTZ,
  disbursed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- Milestone Tracking
  payment_deadline TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  delivery_deadline TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
  
  -- Notes & Metadata
  order_notes TEXT,
  buyer_notes TEXT,
  seller_notes TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Soft Delete
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  
  -- Audit
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for escrow_transactions
CREATE INDEX idx_escrow_buyer ON public.escrow_transactions(buyer_id) WHERE is_deleted = false;
CREATE INDEX idx_escrow_seller ON public.escrow_transactions(seller_id) WHERE is_deleted = false;
CREATE INDEX idx_escrow_status ON public.escrow_transactions(escrow_status) WHERE is_deleted = false;
CREATE INDEX idx_escrow_stage ON public.escrow_transactions(escrow_stage) WHERE is_deleted = false;
CREATE INDEX idx_escrow_marketplace_order ON public.escrow_transactions(marketplace_order_id);
CREATE INDEX idx_escrow_reference ON public.escrow_transactions(escrow_reference) WHERE is_deleted = false;

-- =============================================
-- 3. ESCROW TIMELINE / AUDIT LOG TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public.escrow_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_transaction_id UUID NOT NULL REFERENCES public.escrow_transactions(id) ON DELETE CASCADE,
  
  -- Event Information
  event_type TEXT NOT NULL,
  old_status escrow_status,
  new_status escrow_status,
  old_stage escrow_stage,
  new_stage escrow_stage,
  
  -- Actor Information
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type TEXT DEFAULT 'system', -- 'buyer', 'seller', 'admin', 'system'
  
  -- Event Details
  description TEXT,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_escrow_timeline_transaction ON public.escrow_timeline(escrow_transaction_id);
CREATE INDEX idx_escrow_timeline_event ON public.escrow_timeline(event_type);

-- =============================================
-- 4. DISPUTES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public.marketplace_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference
  dispute_reference TEXT UNIQUE NOT NULL DEFAULT 'DIS-' || LPAD(FLOOR(RANDOM() * 999999999)::TEXT, 9, '0'),
  escrow_transaction_id UUID NOT NULL REFERENCES public.escrow_transactions(id) ON DELETE CASCADE,
  
  -- Parties
  opened_by_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  assigned_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Dispute Details
  dispute_status dispute_status DEFAULT 'opened',
  dispute_category TEXT NOT NULL, -- 'item_not_received', 'item_damaged', 'not_as_described', 'fraud', 'other'
  complaint_title TEXT NOT NULL,
  complaint_description TEXT NOT NULL,
  
  -- Evidence
  evidence_urls TEXT[] DEFAULT '{}',
  
  -- Resolution
  resolution_decision dispute_resolution DEFAULT 'pending',
  resolution_notes TEXT,
  resolution_details JSONB DEFAULT '{}',
  
  -- Timeline
  opened_at TIMESTAMPTZ DEFAULT now(),
  seller_response_deadline TIMESTAMPTZ DEFAULT (now() + interval '5 days'),
  seller_response_at TIMESTAMPTZ,
  investigation_started_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  
  -- Escalation
  is_escalated BOOLEAN DEFAULT false,
  escalation_reason TEXT,
  escalation_to_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  metadata JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_dispute_escrow ON public.marketplace_disputes(escrow_transaction_id);
CREATE INDEX idx_dispute_status ON public.marketplace_disputes(dispute_status);
CREATE INDEX idx_dispute_opened_by ON public.marketplace_disputes(opened_by_id);
CREATE INDEX idx_dispute_assigned_admin ON public.marketplace_disputes(assigned_admin_id);
CREATE INDEX idx_dispute_reference ON public.marketplace_disputes(dispute_reference);

-- =============================================
-- 5. DISPUTE RESPONSES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public.dispute_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  dispute_id UUID NOT NULL REFERENCES public.marketplace_disputes(id) ON DELETE CASCADE,
  respondent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Response Content
  response_text TEXT NOT NULL,
  response_type TEXT DEFAULT 'seller_response', -- 'seller_response', 'buyer_counter', 'admin_note'
  
  -- Evidence
  evidence_urls TEXT[] DEFAULT '{}',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_dispute_responses_dispute ON public.dispute_responses(dispute_id);
CREATE INDEX idx_dispute_responses_respondent ON public.dispute_responses(respondent_id);

-- =============================================
-- 6. DISBURSEMENT LOG TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public.escrow_disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference
  disbursement_reference TEXT UNIQUE NOT NULL DEFAULT 'DISB-' || LPAD(FLOOR(RANDOM() * 999999999)::TEXT, 9, '0'),
  escrow_transaction_id UUID NOT NULL REFERENCES public.escrow_transactions(id) ON DELETE CASCADE,
  
  -- Disbursement Details
  disbursement_type TEXT NOT NULL, -- 'release_to_seller', 'refund_to_buyer', 'split'
  disbursement_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  
  -- Amounts
  amount_to_seller NUMERIC(15,2) DEFAULT 0,
  amount_to_buyer NUMERIC(15,2) DEFAULT 0,
  platform_fee NUMERIC(15,2) DEFAULT 0,
  
  -- Target Wallet
  seller_wallet_destination TEXT DEFAULT 'sales_proceeds',
  buyer_wallet_destination TEXT DEFAULT 'primary',
  
  -- Processing
  processed_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  processing_notes TEXT,
  
  -- Timeline
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Error Tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_disbursement_escrow ON public.escrow_disbursements(escrow_transaction_id);
CREATE INDEX idx_disbursement_status ON public.escrow_disbursements(disbursement_status);
CREATE INDEX idx_disbursement_reference ON public.escrow_disbursements(disbursement_reference);

-- =============================================
-- 7. REFUND LOG TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public.escrow_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference
  refund_reference TEXT UNIQUE NOT NULL DEFAULT 'REF-' || LPAD(FLOOR(RANDOM() * 999999999)::TEXT, 9, '0'),
  escrow_transaction_id UUID NOT NULL REFERENCES public.escrow_transactions(id) ON DELETE CASCADE,
  
  -- Refund Details
  refund_reason refund_reason NOT NULL,
  refund_amount NUMERIC(15,2) NOT NULL CHECK (refund_amount > 0),
  refund_description TEXT,
  
  -- Status
  refund_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  
  -- Parties
  requested_by_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Processing
  processed_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  refund_method TEXT DEFAULT 'wallet', -- 'wallet', 'original_payment_method'
  
  -- Timeline
  created_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Error Tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_refund_escrow ON public.escrow_refunds(escrow_transaction_id);
CREATE INDEX idx_refund_status ON public.escrow_refunds(refund_status);
CREATE INDEX idx_refund_reason ON public.escrow_refunds(refund_reason);
CREATE INDEX idx_refund_requested_by ON public.escrow_refunds(requested_by_id);

-- =============================================
-- 8. RLS POLICIES - ESCROW TRANSACTIONS
-- =============================================

ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own escrow transactions
CREATE POLICY "Users can view their own escrow transactions"
  ON public.escrow_transactions FOR SELECT
  TO authenticated
  USING (
    (buyer_id = auth.uid() OR seller_id = auth.uid())
    AND is_deleted = false
  );

-- Admins can view all escrow transactions
CREATE POLICY "Admins can view all escrow transactions"
  ON public.escrow_transactions FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
  );

-- Users can create escrow transactions (via marketplace order)
CREATE POLICY "Users can create escrow transactions"
  ON public.escrow_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    buyer_id = auth.uid()
    AND (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
  );

-- Users can update their own transactions (with restrictions)
CREATE POLICY "Users can update own escrow transactions"
  ON public.escrow_transactions FOR UPDATE
  TO authenticated
  USING (
    (buyer_id = auth.uid() OR seller_id = auth.uid())
    AND is_deleted = false
  )
  WITH CHECK (
    (buyer_id = auth.uid() OR seller_id = auth.uid())
    AND is_deleted = false
  );

-- Admins can manage all escrow transactions
CREATE POLICY "Admins can manage all escrow transactions"
  ON public.escrow_transactions FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
  );

-- =============================================
-- 9. RLS POLICIES - DISPUTES
-- =============================================

ALTER TABLE public.marketplace_disputes ENABLE ROW LEVEL SECURITY;

-- Parties can view their dispute
CREATE POLICY "Parties can view their dispute"
  ON public.marketplace_disputes FOR SELECT
  TO authenticated
  USING (
    opened_by_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.escrow_transactions
      WHERE id = escrow_transaction_id
        AND (buyer_id = auth.uid() OR seller_id = auth.uid())
    )
  );

-- Admins can view all disputes
CREATE POLICY "Admins can view all disputes"
  ON public.marketplace_disputes FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
  );

-- Users can open disputes
CREATE POLICY "Users can open disputes"
  ON public.marketplace_disputes FOR INSERT
  TO authenticated
  WITH CHECK (
    opened_by_id = auth.uid()
    AND (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
  );

-- Admins can manage all disputes
CREATE POLICY "Admins can manage all disputes"
  ON public.marketplace_disputes FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
  );

-- =============================================
-- 10. RLS POLICIES - DISPUTE RESPONSES
-- =============================================

ALTER TABLE public.dispute_responses ENABLE ROW LEVEL SECURITY;

-- Parties can view responses
CREATE POLICY "Parties can view dispute responses"
  ON public.dispute_responses FOR SELECT
  TO authenticated
  USING (
    respondent_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.marketplace_disputes
      WHERE id = dispute_id
        AND opened_by_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.marketplace_disputes d
      JOIN public.escrow_transactions e ON d.escrow_transaction_id = e.id
      WHERE d.id = dispute_id
        AND (e.buyer_id = auth.uid() OR e.seller_id = auth.uid())
    )
  );

-- Admins can view all responses
CREATE POLICY "Admins can view all dispute responses"
  ON public.dispute_responses FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
  );

-- =============================================
-- 11. HELPER FUNCTIONS
-- =============================================

-- Function to get escrow status summary for a user
CREATE OR REPLACE FUNCTION public.get_user_escrow_summary(p_user_id UUID)
RETURNS TABLE (
  active_escrows BIGINT,
  total_amount_held NUMERIC,
  disputed_count BIGINT,
  pending_refunds BIGINT,
  completed_transactions BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE escrow_status IN ('funded', 'under_review', 'ready_for_disbursement'))::BIGINT,
    COALESCE(SUM(escrow_amount) FILTER (WHERE escrow_status IN ('funded', 'under_review', 'ready_for_disbursement')), 0),
    COUNT(*) FILTER (WHERE escrow_status = 'disputed')::BIGINT,
    COALESCE((SELECT COUNT(*) FROM public.escrow_refunds WHERE escrow_transaction_id IN (
      SELECT id FROM public.escrow_transactions WHERE buyer_id = p_user_id
    ) AND refund_status = 'pending'), 0::BIGINT),
    COUNT(*) FILTER (WHERE escrow_status = 'disbursed')::BIGINT
  FROM public.escrow_transactions
  WHERE (buyer_id = p_user_id OR seller_id = p_user_id)
    AND is_deleted = false;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to transition escrow status with audit logging
CREATE OR REPLACE FUNCTION public.update_escrow_status(
  p_escrow_id UUID,
  p_new_status escrow_status,
  p_new_stage escrow_stage,
  p_actor_id UUID,
  p_actor_type TEXT DEFAULT 'admin'
)
RETURNS void AS $$
DECLARE
  v_old_status escrow_status;
  v_old_stage escrow_stage;
BEGIN
  -- Get old values
  SELECT escrow_status, escrow_stage INTO v_old_status, v_old_stage
  FROM public.escrow_transactions
  WHERE id = p_escrow_id;

  -- Update escrow transaction
  UPDATE public.escrow_transactions
  SET
    escrow_status = p_new_status,
    escrow_stage = p_new_stage,
    updated_at = now(),
    funded_at = CASE WHEN p_new_status = 'funded' THEN now() ELSE funded_at END,
    seller_confirmed_at = CASE WHEN p_new_stage = 'seller_confirmation' THEN now() ELSE seller_confirmed_at END,
    delivery_confirmed_at = CASE WHEN p_new_stage = 'delivery_confirmation' THEN now() ELSE delivery_confirmed_at END,
    ready_for_disbursement_at = CASE WHEN p_new_status = 'ready_for_disbursement' THEN now() ELSE ready_for_disbursement_at END,
    disbursed_at = CASE WHEN p_new_status = 'disbursed' THEN now() ELSE disbursed_at END,
    refunded_at = CASE WHEN p_new_status = 'refunded' THEN now() ELSE refunded_at END
  WHERE id = p_escrow_id;

  -- Log to timeline
  INSERT INTO public.escrow_timeline (
    escrow_transaction_id,
    event_type,
    old_status,
    new_status,
    old_stage,
    new_stage,
    actor_id,
    actor_type,
    description
  ) VALUES (
    p_escrow_id,
    'status_change',
    v_old_status,
    p_new_status,
    v_old_stage,
    p_new_stage,
    p_actor_id,
    p_actor_type,
    'Status changed from ' || v_old_status || ' to ' || p_new_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if escrow can be disbursed
CREATE OR REPLACE FUNCTION public.can_escrow_be_disbursed(p_escrow_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_status escrow_status;
  v_has_active_dispute BOOLEAN;
BEGIN
  SELECT escrow_status INTO v_status
  FROM public.escrow_transactions
  WHERE id = p_escrow_id;

  -- Check if there's active dispute
  SELECT EXISTS (
    SELECT 1 FROM public.marketplace_disputes
    WHERE escrow_transaction_id = p_escrow_id
      AND dispute_status NOT IN ('closed', 'resolved')
  ) INTO v_has_active_dispute;

  RETURN v_status = 'ready_for_disbursement' AND NOT v_has_active_dispute;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================
-- 12. GRANT PERMISSIONS
-- =============================================

GRANT SELECT, INSERT, UPDATE ON public.escrow_transactions TO authenticated;
GRANT SELECT, INSERT ON public.escrow_timeline TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.marketplace_disputes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.dispute_responses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.escrow_disbursements TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.escrow_refunds TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_user_escrow_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_escrow_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_escrow_be_disbursed TO authenticated;
