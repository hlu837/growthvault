-- ============================================================
-- LOAN RISK SCORING ENGINE
-- 6-Area Model (100 Points Total) + Fraud Detection
-- Run this in your Supabase SQL Editor AFTER the loan facility migration
-- ============================================================

-- ============================================================
-- 1. MAIN RISK SCORING FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculate_loan_risk_score(
  p_user_id uuid,
  p_loan_amount numeric,
  p_duration_months integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_account_age_months integer;
  v_score_account integer := 0;
  v_score_savings integer := 0;
  v_score_income integer := 0;
  v_score_loan_history integer := 0;
  v_score_surety integer := 0;
  v_score_behavior integer := 0;
  v_fraud_deductions integer := 0;
  v_total_score integer := 0;
  v_decision text;
  v_details jsonb;
  
  -- Savings & capital
  v_total_savings numeric := 0;
  v_deposit_count integer := 0;
  v_deposit_months integer := 0;
  
  -- Income
  v_monthly_earnings numeric := 0;
  v_monthly_repayment numeric;
  v_downline_count integer := 0;
  v_active_downline integer := 0;
  
  -- Loan history
  v_completed_loans integer := 0;
  v_late_loans integer := 0;
  v_defaulted_loans integer := 0;
  v_active_debt boolean := false;
  
  -- Behavior
  v_loan_to_savings_ratio numeric := 0;
  v_active_loan_count integer := 0;
  
  -- Fraud flags
  v_fraud_flags jsonb := '[]'::jsonb;
BEGIN
  -- ========================================
  -- FETCH PROFILE
  -- ========================================
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- ========================================
  -- 1. ACCOUNT STABILITY (20 Points)
  -- ========================================
  -- Account age
  v_account_age_months := EXTRACT(MONTH FROM age(now(), v_profile.created_at))
    + EXTRACT(YEAR FROM age(now(), v_profile.created_at)) * 12;

  IF v_account_age_months > 12 THEN
    v_score_account := v_score_account + 10;
  ELSIF v_account_age_months >= 6 THEN
    v_score_account := v_score_account + 7;
  ELSIF v_account_age_months >= 3 THEN
    v_score_account := v_score_account + 4;
  -- else 0
  END IF;

  -- KYC status
  IF v_profile.kyc_status = 'approved' THEN
    v_score_account := v_score_account + 10;
  ELSIF v_profile.kyc_status = 'submitted' THEN
    v_score_account := v_score_account + 5;
  -- else 0
  END IF;

  -- ========================================
  -- 2. SAVINGS & CAPITAL STRENGTH (20 Points)
  -- ========================================
  -- Total savings across all savings wallets
  SELECT COALESCE(SUM(balance), 0) INTO v_total_savings
  FROM wallets
  WHERE user_id = p_user_id
    AND wallet_type IN ('savings', 'prudent_saving', 'golden_saving', 'projects_saving', 'future_saving', 'loans_saving');

  -- Also include savings vaults
  SELECT COALESCE(SUM(balance), 0) + v_total_savings INTO v_total_savings
  FROM savings_vaults
  WHERE user_id = p_user_id;

  IF v_total_savings >= p_loan_amount * 2 THEN
    v_score_savings := v_score_savings + 10;
  ELSIF v_total_savings >= p_loan_amount THEN
    v_score_savings := v_score_savings + 7;
  ELSIF v_total_savings >= p_loan_amount * 0.5 THEN
    v_score_savings := v_score_savings + 3;
  -- else 0
  END IF;

  -- Deposit history (last 6 months)
  SELECT COUNT(DISTINCT DATE_TRUNC('month', created_at)) INTO v_deposit_months
  FROM deposits
  WHERE user_id = p_user_id
    AND status = 'approved'
    AND created_at > now() - INTERVAL '6 months';

  IF v_deposit_months >= 5 THEN
    v_score_savings := v_score_savings + 10;
  ELSIF v_deposit_months >= 2 THEN
    v_score_savings := v_score_savings + 5;
  -- else 0
  END IF;

  -- ========================================
  -- 3. INCOME & COMMISSION FLOW (20 Points)
  -- ========================================
  -- Monthly earnings from MLM bonus wallet
  SELECT COALESCE(balance, 0) INTO v_monthly_earnings
  FROM wallets
  WHERE user_id = p_user_id AND wallet_type = 'mlm_bonus';

  -- Calculate monthly repayment
  v_monthly_repayment := ROUND((p_loan_amount + (p_loan_amount * 5.0 / 100 * p_duration_months / 12)) / p_duration_months, 2);

  IF v_monthly_earnings >= v_monthly_repayment * 3 THEN
    v_score_income := v_score_income + 10;
  ELSIF v_monthly_earnings >= v_monthly_repayment * 1.5 THEN
    v_score_income := v_score_income + 6;
  -- else 0
  END IF;

  -- Downline activity
  SELECT COUNT(*) INTO v_downline_count
  FROM referrals
  WHERE referrer_id = p_user_id;

  -- Check active downline (those with recent transactions)
  SELECT COUNT(DISTINCT r.referred_id) INTO v_active_downline
  FROM referrals r
  JOIN transactions t ON t.user_id = r.referred_id
  WHERE r.referrer_id = p_user_id
    AND t.created_at > now() - INTERVAL '30 days';

  IF v_downline_count >= 10 AND v_active_downline >= 5 THEN
    v_score_income := v_score_income + 10;
  ELSIF v_downline_count >= 5 AND v_active_downline >= 2 THEN
    v_score_income := v_score_income + 5;
  -- else 0
  END IF;

  -- ========================================
  -- 4. LOAN HISTORY (15 Points)
  -- ========================================
  SELECT 
    COUNT(*) FILTER (WHERE status = 'completed') INTO v_completed_loans
  FROM loans WHERE user_id = p_user_id;

  SELECT COUNT(*) INTO v_defaulted_loans
  FROM loans WHERE user_id = p_user_id AND status = 'defaulted';

  -- Check for active debt
  SELECT EXISTS(
    SELECT 1 FROM loans 
    WHERE user_id = p_user_id 
    AND status IN ('disbursed', 'repaying')
  ) INTO v_active_debt;

  IF v_completed_loans > 0 AND v_defaulted_loans = 0 THEN
    v_score_loan_history := v_score_loan_history + 10;
  ELSIF v_completed_loans > 0 AND v_defaulted_loans = 0 THEN
    v_score_loan_history := v_score_loan_history + 5;
  -- defaulted = 0 points
  END IF;

  IF NOT v_active_debt THEN
    v_score_loan_history := v_score_loan_history + 5;
  END IF;

  -- ========================================
  -- 5. SURETY STRENGTH (15 Points)
  -- Scored when sureties are attached to the loan
  -- For pre-application scoring, use default of 0
  -- ========================================
  v_score_surety := 0; -- Will be recalculated after sureties are added

  -- ========================================
  -- 6. LOAN BEHAVIOR RISK (10 Points)
  -- ========================================
  -- Loan-to-savings ratio
  IF v_total_savings > 0 THEN
    v_loan_to_savings_ratio := p_loan_amount / v_total_savings;
  ELSE
    v_loan_to_savings_ratio := 999;
  END IF;

  IF v_loan_to_savings_ratio < 0.5 THEN
    v_score_behavior := v_score_behavior + 5;
  ELSIF v_loan_to_savings_ratio <= 0.8 THEN
    v_score_behavior := v_score_behavior + 3;
  -- else 0
  END IF;

  -- Active loan count
  SELECT COUNT(*) INTO v_active_loan_count
  FROM loans
  WHERE user_id = p_user_id
    AND status IN ('disbursed', 'repaying', 'approved', 'pending', 'surety_pending', 'under_review');

  IF v_active_loan_count <= 1 THEN
    v_score_behavior := v_score_behavior + 5;
  -- 2+ active = 0
  END IF;

  -- ========================================
  -- FRAUD DETECTION FLAGS (-10 each)
  -- ========================================
  
  -- Flag: Sudden large deposits before applying (3x normal in last 7 days)
  DECLARE
    v_recent_deposits numeric;
    v_avg_deposits numeric;
  BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_recent_deposits
    FROM deposits
    WHERE user_id = p_user_id AND status = 'approved'
      AND created_at > now() - INTERVAL '7 days';

    SELECT COALESCE(AVG(monthly_total), 0) INTO v_avg_deposits
    FROM (
      SELECT SUM(amount) as monthly_total
      FROM deposits
      WHERE user_id = p_user_id AND status = 'approved'
        AND created_at > now() - INTERVAL '6 months'
        AND created_at <= now() - INTERVAL '7 days'
      GROUP BY DATE_TRUNC('month', created_at)
    ) sub;

    IF v_avg_deposits > 0 AND v_recent_deposits > v_avg_deposits * 3 THEN
      v_fraud_flags := v_fraud_flags || '["sudden_large_deposits"]'::jsonb;
      v_fraud_deductions := v_fraud_deductions + 10;
    END IF;
  END;

  -- Flag: Account recently upgraded (tier changed in last 30 days)
  -- We check profile updated_at as a proxy
  IF v_profile.updated_at > now() - INTERVAL '30 days' AND v_account_age_months < 3 THEN
    v_fraud_flags := v_fraud_flags || '["recently_upgraded_new_account"]'::jsonb;
    v_fraud_deductions := v_fraud_deductions + 10;
  END IF;

  -- Flag: No deposit history at all
  SELECT COUNT(*) INTO v_deposit_count
  FROM deposits
  WHERE user_id = p_user_id AND status = 'approved';

  IF v_deposit_count = 0 THEN
    v_fraud_flags := v_fraud_flags || '["no_deposit_history"]'::jsonb;
    v_fraud_deductions := v_fraud_deductions + 10;
  END IF;

  -- Flag: Previous default
  IF v_defaulted_loans > 0 THEN
    v_fraud_flags := v_fraud_flags || '["previous_default"]'::jsonb;
    v_fraud_deductions := v_fraud_deductions + 10;
  END IF;

  -- ========================================
  -- CALCULATE TOTAL SCORE
  -- ========================================
  v_total_score := GREATEST(0, 
    v_score_account + v_score_savings + v_score_income + 
    v_score_loan_history + v_score_surety + v_score_behavior - v_fraud_deductions
  );

  -- ========================================
  -- DECISION ENGINE
  -- ========================================
  IF v_total_score >= 80 THEN
    v_decision := 'auto_approve';
  ELSIF v_total_score >= 60 THEN
    v_decision := 'manual_review';
  ELSIF v_total_score >= 40 THEN
    v_decision := 'extra_collateral';
  ELSE
    v_decision := 'reject';
  END IF;

  -- ========================================
  -- BUILD RESULT
  -- ========================================
  v_details := jsonb_build_object(
    'total_score', v_total_score,
    'decision', v_decision,
    'breakdown', jsonb_build_object(
      'account_stability', jsonb_build_object('score', v_score_account, 'max', 20, 'account_age_months', v_account_age_months, 'kyc_status', v_profile.kyc_status),
      'savings_strength', jsonb_build_object('score', v_score_savings, 'max', 20, 'total_savings', v_total_savings, 'deposit_months_active', v_deposit_months),
      'income_flow', jsonb_build_object('score', v_score_income, 'max', 20, 'monthly_earnings', v_monthly_earnings, 'monthly_repayment', v_monthly_repayment, 'downline_count', v_downline_count, 'active_downline', v_active_downline),
      'loan_history', jsonb_build_object('score', v_score_loan_history, 'max', 15, 'completed_loans', v_completed_loans, 'defaulted_loans', v_defaulted_loans, 'has_active_debt', v_active_debt),
      'surety_strength', jsonb_build_object('score', v_score_surety, 'max', 15, 'note', 'Calculated after sureties are attached'),
      'loan_behavior', jsonb_build_object('score', v_score_behavior, 'max', 10, 'loan_to_savings_ratio', ROUND(v_loan_to_savings_ratio::numeric, 2), 'active_loan_count', v_active_loan_count)
    ),
    'fraud_flags', v_fraud_flags,
    'fraud_deductions', v_fraud_deductions,
    'loan_amount', p_loan_amount,
    'duration_months', p_duration_months,
    'monthly_repayment', v_monthly_repayment
  );

  -- Store the risk score on the loan if one exists
  UPDATE loans
  SET risk_score = v_total_score, updated_at = now()
  WHERE id = (
    SELECT id FROM loans
    WHERE user_id = p_user_id AND status IN ('draft', 'pending')
    ORDER BY created_at DESC
    LIMIT 1
  );

  RETURN v_details;
END;
$$;

-- ============================================================
-- 2. SURETY RISK SCORING (called per surety)
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculate_surety_score(
  p_surety_user_id uuid,
  p_loan_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_surety_profile RECORD;
  v_surety_savings numeric := 0;
  v_surety_account_age integer := 0;
  v_surety_risk_score integer := 0;
  v_score integer := 0;
  v_active_guarantees integer := 0;
BEGIN
  SELECT * INTO v_surety_profile FROM profiles WHERE id = p_surety_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('score', 0, 'error', 'Surety profile not found');
  END IF;

  -- Surety savings strength (5 points)
  SELECT COALESCE(SUM(balance), 0) INTO v_surety_savings
  FROM wallets
  WHERE user_id = p_surety_user_id
    AND wallet_type IN ('savings', 'prudent_saving', 'golden_saving', 'projects_saving', 'future_saving', 'loans_saving');

  IF v_surety_savings >= p_loan_amount THEN
    v_score := v_score + 5;
  END IF;

  -- Surety account age (5 points)
  v_surety_account_age := EXTRACT(MONTH FROM age(now(), v_surety_profile.created_at))
    + EXTRACT(YEAR FROM age(now(), v_surety_profile.created_at)) * 12;

  IF v_surety_account_age > 6 THEN
    v_score := v_score + 5;
  END IF;

  -- Surety's own risk score > 70 (5 points)
  -- Use a simplified check based on their savings and account age
  v_surety_risk_score := 0;
  IF v_surety_account_age > 6 THEN v_surety_risk_score := v_surety_risk_score + 20; END IF;
  IF v_surety_savings > 100 THEN v_surety_risk_score := v_surety_risk_score + 20; END IF;
  IF v_surety_profile.kyc_status = 'approved' THEN v_surety_risk_score := v_surety_risk_score + 20; END IF;

  IF v_surety_risk_score > 50 THEN
    v_score := v_score + 5;
  END IF;

  -- Check active guarantees (max 2 rule)
  SELECT COUNT(*) INTO v_active_guarantees
  FROM loan_sureties ls
  JOIN loans l ON l.id = ls.loan_id
  WHERE ls.surety_user_id = p_surety_user_id
    AND ls.status = 'accepted'
    AND l.status IN ('disbursed', 'repaying', 'approved');

  RETURN jsonb_build_object(
    'score', v_score,
    'max', 15,
    'surety_savings', v_surety_savings,
    'account_age_months', v_surety_account_age,
    'estimated_risk_score', v_surety_risk_score,
    'active_guarantees', v_active_guarantees,
    'can_guarantee', v_active_guarantees < 2
  );
END;
$$;

-- ============================================================
-- 3. ADVANCED PROTECTION RULES (enforcement function)
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_loan_eligibility(
  p_user_id uuid,
  p_loan_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_savings numeric := 0;
  v_max_loan_ratio numeric := 0.5; -- Loan cannot exceed 50% of savings
  v_is_blacklisted boolean := false;
  v_has_active_loan boolean := false;
  v_eligible boolean := true;
  v_reasons jsonb := '[]'::jsonb;
BEGIN
  -- Get max loan ratio from settings
  SELECT setting_value INTO v_max_loan_ratio
  FROM system_settings WHERE setting_key = 'max_loan_to_savings_ratio';
  IF v_max_loan_ratio IS NULL THEN v_max_loan_ratio := 50; END IF;
  v_max_loan_ratio := v_max_loan_ratio / 100.0;

  -- Check savings
  SELECT COALESCE(SUM(balance), 0) INTO v_total_savings
  FROM wallets
  WHERE user_id = p_user_id
    AND wallet_type IN ('savings', 'prudent_saving', 'golden_saving', 'projects_saving', 'future_saving', 'loans_saving');

  -- Rule: Loan cannot exceed X% of savings vault
  IF p_loan_amount > v_total_savings * v_max_loan_ratio THEN
    v_eligible := false;
    v_reasons := v_reasons || to_jsonb(format('Loan amount exceeds %s%% of your savings ($%s)', (v_max_loan_ratio * 100)::integer, ROUND(v_total_savings, 2)));
  END IF;

  -- Rule: No active loan
  SELECT EXISTS(
    SELECT 1 FROM loans
    WHERE user_id = p_user_id
      AND status IN ('pending', 'surety_pending', 'under_review', 'approved', 'disbursed', 'repaying')
  ) INTO v_has_active_loan;

  IF v_has_active_loan THEN
    v_eligible := false;
    v_reasons := v_reasons || '"You already have an active loan"'::jsonb;
  END IF;

  -- Rule: Not blacklisted
  SELECT EXISTS(
    SELECT 1 FROM loan_blacklist
    WHERE user_id = p_user_id AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO v_is_blacklisted;

  IF v_is_blacklisted THEN
    v_eligible := false;
    v_reasons := v_reasons || '"You are currently blacklisted from loan facilities"'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'eligible', v_eligible,
    'reasons', v_reasons,
    'total_savings', v_total_savings,
    'max_loan_amount', ROUND(v_total_savings * v_max_loan_ratio, 2),
    'has_active_loan', v_has_active_loan,
    'is_blacklisted', v_is_blacklisted
  );
END;
$$;

-- ============================================================
-- 4. LOAN SYSTEM SETTINGS (insert defaults)
-- ============================================================
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
  ('loan_interest_rate', 5, 'Default loan interest rate (%)'),
  ('max_loan_per_user', 5000, 'Maximum loan amount per user'),
  ('max_loan_to_savings_ratio', 50, 'Max loan as % of savings'),
  ('max_surety_guarantees', 2, 'Max active loans a surety can guarantee'),
  ('loan_grace_period_days', 7, 'Grace period after due date (days)'),
  ('loan_penalty_rate', 2, 'Late payment penalty rate (%)'),
  ('loan_auto_deduction_enabled', 1, 'Enable auto-deduction from wallets (1=yes, 0=no)'),
  ('loan_reserve_ratio_target', 150, 'Target reserve ratio % (150 = 1.5x)')
ON CONFLICT (setting_key) DO NOTHING;
