import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Client-side eligibility checks that complement the server-side RPC.
 * Enforces: 90-day account age, max 1 active loan, loan limit = 3x loans_saving balance,
 * surety can't guarantee >1 active loan, surety must be KYC verified with active deposits.
 */

export interface LoanEligibilityCheck {
  eligible: boolean;
  reasons: string[];
  accountAgeDays: number;
  activeLoanCount: number;
  loansSavingBalance: number;
  maxBorrowable: number;
}

export interface SuretyEligibilityCheck {
  eligible: boolean;
  reasons: string[];
  kycStatus: string;
  hasActiveDeposits: boolean;
  activeGuaranteeCount: number;
  totalSavings: number;
  canGuaranteeAmount: number;
}

// Check if current user is eligible to apply for a loan
export const useLoanEligibilityCheck = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["loan_eligibility_check", user?.id],
    queryFn: async (): Promise<LoanEligibilityCheck> => {
      if (!user) throw new Error("Not authenticated");

      const reasons: string[] = [];

      // 1. Check account age (minimum 90 days)
      const createdAt = new Date(user.created_at || Date.now());
      const accountAgeDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      if (accountAgeDays < 90) {
        reasons.push(`Account must be at least 90 days old (currently ${accountAgeDays} days)`);
      }

      // 2. Check KYC status
      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("kyc_status")
        .eq("id", user.id)
        .single();
      if (!profile || profile.kyc_status !== "approved") {
        reasons.push("KYC verification must be fully approved");
      }

      // 2b. Check minimum 3 active direct referrals
      const { data: referrals } = await supabase
        .from("referrals")
        .select("id")
        .eq("referrer_id", user.id)
        .neq("referred_id", user.id);
      const directReferralCount = referrals?.length || 0;
      if (directReferralCount < 3) {
        reasons.push(`Minimum 3 active direct referrals required (currently ${directReferralCount})`);
      }

      // 3. Check active loan count (max 1)
      const { data: activeLoans } = await (supabase as any)
        .from("loans")
        .select("id")
        .eq("user_id", user.id)
        .in("status", ["pending", "surety_pending", "under_review", "approved", "disbursed", "repaying"]);
      const activeLoanCount = activeLoans?.length || 0;
      if (activeLoanCount >= 1) {
        reasons.push("You already have an active loan (maximum 1 allowed)");
      }

      // 4. Check loans_saving balance (can borrow up to 3x)
      const { data: wallets } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", user.id)
        .eq("wallet_type", "loans_saving" as any);
      const loansSavingBalance = wallets?.[0]?.balance || 0;
      const maxBorrowable = loansSavingBalance * 3;

      return {
        eligible: reasons.length === 0,
        reasons,
        accountAgeDays,
        activeLoanCount,
        loansSavingBalance,
        maxBorrowable,
      };
    },
    enabled: !!user,
  });
};

// Check if a specific user is eligible to be a surety
export const useSuretyEligibilityCheck = (suretyUserId: string | undefined, loanAmount: number) => {
  return useQuery({
    queryKey: ["surety_eligibility", suretyUserId, loanAmount],
    queryFn: async (): Promise<SuretyEligibilityCheck> => {
      if (!suretyUserId) throw new Error("No surety user ID");

      const reasons: string[] = [];

      // 1. Check KYC status
      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("kyc_status")
        .eq("id", suretyUserId)
        .single();
      const kycStatus = profile?.kyc_status || "unverified";
      if (kycStatus !== "approved") {
        reasons.push("Surety must have fully approved KYC verification");
      }

      // 2. Check active deposits / savings
      const { data: wallets } = await supabase
        .from("wallets")
        .select("balance, wallet_type")
        .eq("user_id", suretyUserId);
      const totalSavings = (wallets || []).reduce((sum, w) => sum + (w.balance || 0), 0);
      const hasActiveDeposits = totalSavings > 0;
      if (!hasActiveDeposits) {
        reasons.push("Surety must have active deposits");
      }

      // 3. Check active guarantees (max 1)
      const { data: activeGuarantees } = await (supabase as any)
        .from("loan_sureties")
        .select("id, loan_id")
        .eq("surety_user_id", suretyUserId)
        .eq("status", "accepted");

      // For each accepted guarantee, check if the loan is still active
      let activeGuaranteeCount = 0;
      if (activeGuarantees?.length) {
        const loanIds = activeGuarantees.map((g: any) => g.loan_id);
        const { data: loans } = await (supabase as any)
          .from("loans")
          .select("id, status")
          .in("id", loanIds)
          .in("status", ["disbursed", "repaying"]);
        activeGuaranteeCount = loans?.length || 0;
      }
      if (activeGuaranteeCount >= 1) {
        reasons.push("Surety cannot guarantee more than 1 active loan");
      }

      // 4. Calculate max guarantee capacity
      const canGuaranteeAmount = totalSavings;

      return {
        eligible: reasons.length === 0,
        reasons,
        kycStatus,
        hasActiveDeposits,
        activeGuaranteeCount,
        totalSavings,
        canGuaranteeAmount,
      };
    },
    enabled: !!suretyUserId && loanAmount > 0,
  });
};
