-- ============================================================
-- LOAN FACILITY MIGRATION
-- Based on Loan Recommendation & Surety Form
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Create loan_status enum
CREATE TYPE public.loan_status AS ENUM (
  'draft',           -- Application started but not submitted
  'pending',         -- Submitted, awaiting surety
  'surety_pending',  -- Awaiting surety confirmation
  'under_review',    -- Staff/admin reviewing
  'approved',        -- Approved, awaiting disbursement
  'disbursed',       -- Funds released to borrower
  'repaying',        -- Active repayment in progress
  'completed',       -- Fully repaid
  'defaulted',       -- Borrower defaulted
  'rejected'         -- Application rejected
);

-- 2. Create surety_status enum
CREATE TYPE public.surety_status AS ENUM (
  'pending',     -- Awaiting surety's response
  'accepted',    -- Surety accepted responsibility
  'rejected',    -- Surety declined
  'called'       -- Surety called upon (borrower defaulted)
);

-- 2b. Create loan_interest_type enum
CREATE TYPE public.loan_interest_type AS ENUM (
  'annual',
  'monthly'
);

-- 3. Loans table - main loan applications
CREATE TABLE public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Loan details
  amount_requested numeric NOT NULL CHECK (amount_requested > 0),
  amount_approved numeric CHECK (amount_approved > 0),
  interest_rate numeric NOT NULL DEFAULT 5.0,  -- percentage
  duration_months integer NOT NULL CHECK (duration_months > 0),
  purpose text NOT NULL,
  
  -- From the form: member details captured at application time
  member_name text NOT NULL,
  member_number text,  -- internal member ID
  residential_address text,
  business_address text,
  occupation text,
  employer_name text,
  monthly_income numeric,
  
  -- Loan scoring / risk
  risk_score numeric DEFAULT 0,
  credit_limit numeric DEFAULT 0,
  
  -- Status tracking
  status public.loan_status NOT NULL DEFAULT 'draft',
  rejection_reason text,
  interest_type public.loan_interest_type NOT NULL DEFAULT 'annual',
  
  -- Approval workflow
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  disbursed_at timestamptz,
  
  -- Repayment tracking
  total_repaid numeric NOT NULL DEFAULT 0,
  next_payment_date date,
  monthly_installment numeric,
  
  -- Recovery
  is_defaulted boolean NOT NULL DEFAULT false,
  default_declared_at timestamptz,
  recovery_amount numeric DEFAULT 0,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Loan sureties (guarantors) - from the surety form
CREATE TABLE public.loan_sureties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  surety_user_id uuid REFERENCES auth.users(id),  -- if surety is a platform member
  
  -- Surety details from the form
  surety_name text NOT NULL,
  surety_member_number text,
  surety_address text,
  surety_occupation text,
  surety_employer text,
  surety_monthly_income numeric,
  surety_phone text,
  surety_email text,
  
  -- Guarantee details
  guarantee_amount numeric NOT NULL CHECK (guarantee_amount > 0),
  relationship_to_borrower text,
  
  -- Status
  status public.surety_status NOT NULL DEFAULT 'pending',
  accepted_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  
  -- Declaration (digital signature equivalent)
  declaration_agreed boolean NOT NULL DEFAULT false,
  declaration_date timestamptz,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Loan repayments
CREATE TABLE public.loan_repayments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  amount numeric NOT NULL CHECK (amount > 0),
  payment_type text NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'early', 'penalty', 'surety_recovery'
  
  -- Source tracking
  from_wallet_type public.wallet_type DEFAULT 'loan',
  transaction_id uuid REFERENCES public.transactions(id),
  
  status text NOT NULL DEFAULT 'completed',
  due_date date,
  paid_at timestamptz DEFAULT now(),
  
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Loan blacklist
CREATE TABLE public.loan_blacklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  reason text NOT NULL,
  blacklisted_by uuid REFERENCES auth.users(id),
  blacklisted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,  -- null = permanent
  is_active boolean NOT NULL DEFAULT true
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_loans_user_id ON public.loans(user_id);
CREATE INDEX idx_loans_status ON public.loans(status);
CREATE INDEX idx_loan_sureties_loan_id ON public.loan_sureties(loan_id);
CREATE INDEX idx_loan_sureties_surety_user_id ON public.loan_sureties(surety_user_id);
CREATE INDEX idx_loan_repayments_loan_id ON public.loan_repayments(loan_id);
CREATE INDEX idx_loan_repayments_user_id ON public.loan_repayments(user_id);
CREATE INDEX idx_loan_blacklist_user_id ON public.loan_blacklist(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_sureties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_blacklist ENABLE ROW LEVEL SECURITY;

-- LOANS policies
CREATE POLICY "Users can view own loans"
  ON public.loans FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin/staff can view all loans"
  ON public.loans FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Users can insert own loan applications"
  ON public.loans FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own draft loans"
  ON public.loans FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'draft')
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin/staff can update any loan"
  ON public.loans FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- LOAN SURETIES policies
CREATE POLICY "Users can view sureties for own loans"
  ON public.loan_sureties FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.loans WHERE loans.id = loan_id AND loans.user_id = auth.uid())
    OR surety_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'staff')
  );

CREATE POLICY "Users can add sureties to own loans"
  ON public.loan_sureties FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.loans WHERE loans.id = loan_id AND loans.user_id = auth.uid())
  );

CREATE POLICY "Sureties can update their own surety record"
  ON public.loan_sureties FOR UPDATE TO authenticated
  USING (surety_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- LOAN REPAYMENTS policies
CREATE POLICY "Users can view own repayments"
  ON public.loan_repayments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin can insert repayments"
  ON public.loan_repayments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

-- LOAN BLACKLIST policies
CREATE POLICY "Admin/staff can view blacklist"
  ON public.loan_blacklist FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff') OR user_id = auth.uid());

CREATE POLICY "Admin can manage blacklist"
  ON public.loan_blacklist FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- RPC FUNCTIONS
-- ============================================================

-- Apply for a loan
CREATE OR REPLACE FUNCTION public.apply_for_loan(
  p_amount numeric,
  p_duration_months integer,
  p_purpose text,
  p_member_name text,
  p_residential_address text DEFAULT NULL,
  p_business_address text DEFAULT NULL,
  p_occupation text DEFAULT NULL,
  p_employer_name text DEFAULT NULL,
  p_monthly_income numeric DEFAULT NULL,
  p_interest_type public.loan_interest_type DEFAULT 'annual',
  p_interest_rate numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan_id uuid;
  v_is_blacklisted boolean;
  v_interest_rate numeric;
BEGIN
  -- Check blacklist
  SELECT is_active INTO v_is_blacklisted
  FROM loan_blacklist
  WHERE user_id = auth.uid() AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());
  
  IF v_is_blacklisted THEN
    RAISE EXCEPTION 'You are currently blacklisted from loan facilities';
  END IF;

  -- Check for existing active loans
  IF EXISTS (
    SELECT 1 FROM loans 
    WHERE user_id = auth.uid() 
    AND status IN ('pending', 'surety_pending', 'under_review', 'approved', 'disbursed', 'repaying')
  ) THEN
    RAISE EXCEPTION 'You already have an active loan application or outstanding loan';
  END IF;

  -- Determine base interest rate
  IF p_interest_rate IS NOT NULL THEN
    v_interest_rate := p_interest_rate;
  ELSE
    SELECT setting_value::numeric INTO v_interest_rate
    FROM system_settings WHERE setting_key = 'loan_interest_rate';
    IF v_interest_rate IS NULL THEN v_interest_rate := 5.0; END IF;
  END IF;

  -- Convert monthly input to annual percentage for storage and consistent calculations
  IF p_interest_type = 'monthly' THEN
    v_interest_rate := v_interest_rate * 12;
  END IF;

  -- Calculate monthly installment (simple interest)
  INSERT INTO loans (
    user_id, amount_requested, interest_rate, interest_type, duration_months, purpose,
    member_name, residential_address, business_address, occupation,
    employer_name, monthly_income, status,
    monthly_installment
  ) VALUES (
    auth.uid(), p_amount, v_interest_rate, p_interest_type, p_duration_months, p_purpose,
    p_member_name, p_residential_address, p_business_address, p_occupation,
    p_employer_name, p_monthly_income, 'pending',
    ROUND((p_amount + (p_amount * v_interest_rate / 100 * p_duration_months / 12)) / p_duration_months, 2)
  )
  RETURNING id INTO v_loan_id;

  RETURN v_loan_id;
END;
$$;

-- Approve a loan (admin only)
CREATE OR REPLACE FUNCTION public.approve_loan(
  p_loan_id uuid,
  p_approved_amount numeric DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan RECORD;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can approve loans';
  END IF;

  SELECT * INTO v_loan FROM loans WHERE id = p_loan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loan not found'; END IF;
  IF v_loan.status != 'under_review' THEN
    RAISE EXCEPTION 'Loan must be under review to approve';
  END IF;

  -- Check all sureties accepted
  IF EXISTS (
    SELECT 1 FROM loan_sureties WHERE loan_id = p_loan_id AND status != 'accepted'
  ) THEN
    RAISE EXCEPTION 'All sureties must accept before approval';
  END IF;

  UPDATE loans SET
    status = 'approved',
    amount_approved = COALESCE(p_approved_amount, amount_requested),
    approved_by = auth.uid(),
    approved_at = now(),
    updated_at = now()
  WHERE id = p_loan_id;

  RETURN true;
END;
$$;

-- Disburse loan (admin only) - credits loan wallet
CREATE OR REPLACE FUNCTION public.disburse_loan(p_loan_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan RECORD;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can disburse loans';
  END IF;

  SELECT * INTO v_loan FROM loans WHERE id = p_loan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loan not found'; END IF;
  IF v_loan.status != 'approved' THEN
    RAISE EXCEPTION 'Loan must be approved before disbursement';
  END IF;

  -- Credit the user's loan wallet
  UPDATE wallets SET
    balance = COALESCE(balance, 0) + v_loan.amount_approved,
    updated_at = now()
  WHERE user_id = v_loan.user_id AND wallet_type = 'loan';

  -- If no loan wallet exists, create one
  IF NOT FOUND THEN
    INSERT INTO wallets (user_id, wallet_type, balance)
    VALUES (v_loan.user_id, 'loan', v_loan.amount_approved);
  END IF;

  -- Record transaction
  INSERT INTO transactions (user_id, transaction_type, amount, description, status)
  VALUES (v_loan.user_id, 'loan'::transaction_type, v_loan.amount_approved, 'Loan disbursement - ' || v_loan.purpose, 'completed');

  -- Update loan status
  UPDATE loans SET
    status = 'disbursed',
    disbursed_at = now(),
    next_payment_date = (CURRENT_DATE + INTERVAL '1 month')::date,
    updated_at = now()
  WHERE id = p_loan_id;

  RETURN true;
END;
$$;

-- Make loan repayment
CREATE OR REPLACE FUNCTION public.make_loan_repayment(
  p_loan_id uuid,
  p_amount numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan RECORD;
  v_total_due numeric;
BEGIN
  SELECT * INTO v_loan FROM loans WHERE id = p_loan_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Loan not found'; END IF;
  IF v_loan.status NOT IN ('disbursed', 'repaying') THEN
    RAISE EXCEPTION 'Loan is not in repayment phase';
  END IF;

  -- Calculate total due (principal + interest)
  v_total_due := v_loan.amount_approved + (v_loan.amount_approved * v_loan.interest_rate / 100 * v_loan.duration_months / 12);

  -- Deduct from loan wallet
  UPDATE wallets SET
    balance = balance - p_amount,
    updated_at = now()
  WHERE user_id = auth.uid() AND wallet_type = 'loan' AND balance >= p_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient balance in loan wallet';
  END IF;

  -- Record repayment
  INSERT INTO loan_repayments (loan_id, user_id, amount, payment_type, due_date)
  VALUES (p_loan_id, auth.uid(), p_amount, 'scheduled', v_loan.next_payment_date);

  -- Update loan
  UPDATE loans SET
    total_repaid = total_repaid + p_amount,
    status = CASE 
      WHEN total_repaid + p_amount >= v_total_due THEN 'completed'::loan_status
      ELSE 'repaying'::loan_status
    END,
    next_payment_date = CASE
      WHEN total_repaid + p_amount >= v_total_due THEN NULL
      ELSE (next_payment_date + INTERVAL '1 month')::date
    END,
    updated_at = now()
  WHERE id = p_loan_id;

  RETURN true;
END;
$$;

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION public.update_loan_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER loans_updated_at
  BEFORE UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.update_loan_updated_at();

CREATE TRIGGER loan_sureties_updated_at
  BEFORE UPDATE ON public.loan_sureties
  FOR EACH ROW EXECUTE FUNCTION public.update_loan_updated_at();
