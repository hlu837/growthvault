import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const rpcCall = (fn: string, params: Record<string, unknown>) =>
  (supabase as any).rpc(fn, params);

export interface RiskScoreBreakdown {
  account_stability: { score: number; max: number; account_age_months: number; kyc_status: string };
  savings_strength: { score: number; max: number; total_savings: number; deposit_months_active: number };
  income_flow: { score: number; max: number; monthly_earnings: number; monthly_repayment: number; downline_count: number; active_downline: number };
  loan_history: { score: number; max: number; completed_loans: number; defaulted_loans: number; has_active_debt: boolean };
  surety_strength: { score: number; max: number; note: string };
  loan_behavior: { score: number; max: number; loan_to_savings_ratio: number; active_loan_count: number };
}

export interface RiskScoreResult {
  total_score: number;
  decision: "auto_approve" | "manual_review" | "extra_collateral" | "reject";
  breakdown: RiskScoreBreakdown;
  fraud_flags: string[];
  fraud_deductions: number;
  loan_amount: number;
  duration_months: number;
  monthly_repayment: number;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
  total_savings: number;
  max_loan_amount: number;
  has_active_loan: boolean;
  is_blacklisted: boolean;
}

export interface SuretyScoreResult {
  score: number;
  max: number;
  surety_savings: number;
  account_age_months: number;
  estimated_risk_score: number;
  active_guarantees: number;
  can_guarantee: boolean;
}

// Calculate risk score for a potential loan
export const useCalculateRiskScore = () => {
  return useMutation({
    mutationFn: async (params: {
      p_user_id: string;
      p_loan_amount: number;
      p_duration_months: number;
    }) => {
      const { data, error } = await rpcCall("calculate_loan_risk_score", params);
      if (error) throw error;
      return data as RiskScoreResult;
    },
  });
};

// Check loan eligibility before applying
export const useCheckEligibility = (loanAmount?: number) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["loan_eligibility", user?.id, loanAmount],
    queryFn: async () => {
      if (!user || !loanAmount) return null;
      const { data, error } = await rpcCall("check_loan_eligibility", {
        p_user_id: user.id,
        p_loan_amount: loanAmount,
      });
      if (error) throw error;
      return data as EligibilityResult;
    },
    enabled: !!user && !!loanAmount && loanAmount > 0,
  });
};

// Calculate surety score
export const useCalculateSuretyScore = () => {
  return useMutation({
    mutationFn: async (params: {
      p_surety_user_id: string;
      p_loan_amount: number;
    }) => {
      const { data, error } = await rpcCall("calculate_surety_score", params);
      if (error) throw error;
      return data as SuretyScoreResult;
    },
  });
};

// Decision label and color helpers
export const getRiskDecisionLabel = (decision: string) => {
  switch (decision) {
    case "auto_approve": return "Auto Approve";
    case "manual_review": return "Manual Review";
    case "extra_collateral": return "Extra Collateral Required";
    case "reject": return "Reject";
    default: return decision;
  }
};

export const getRiskDecisionColor = (decision: string) => {
  switch (decision) {
    case "auto_approve": return "text-green-600";
    case "manual_review": return "text-yellow-600";
    case "extra_collateral": return "text-orange-600";
    case "reject": return "text-red-600";
    default: return "text-muted-foreground";
  }
};

export const getRiskScoreColor = (score: number) => {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
};
