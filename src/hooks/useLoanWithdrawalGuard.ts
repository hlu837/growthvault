import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Checks whether the current user has an active or overdue loan,
 * or is an active surety, and should be blocked from withdrawals.
 */

export interface WithdrawalGuardResult {
  blocked: boolean;
  reasons: string[];
  hasActiveLoan: boolean;
  hasOverdueLoan: boolean;
  isActiveSurety: boolean;
  activeLoanIds: string[];
}

export const useLoanWithdrawalGuard = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["loan_withdrawal_guard", user?.id],
    queryFn: async (): Promise<WithdrawalGuardResult> => {
      if (!user) throw new Error("Not authenticated");

      const reasons: string[] = [];
      const activeLoanIds: string[] = [];
      let hasActiveLoan = false;
      let hasOverdueLoan = false;
      let isActiveSurety = false;

      // 1. Check borrower's active/overdue loans
      const { data: loans } = await (supabase as any)
        .from("loans")
        .select("id, status, next_payment_date, is_defaulted")
        .eq("user_id", user.id)
        .in("status", ["disbursed", "repaying", "defaulted"]);

      if (loans?.length) {
        hasActiveLoan = true;
        loans.forEach((l: any) => {
          activeLoanIds.push(l.id);
          if (l.is_defaulted || l.status === "defaulted") {
            hasOverdueLoan = true;
          } else if (l.next_payment_date) {
            const dueDate = new Date(l.next_payment_date);
            if (new Date() > dueDate) {
              hasOverdueLoan = true;
            }
          }
        });
      }

      if (hasOverdueLoan) {
        reasons.push("Withdrawals are frozen due to overdue loan repayments");
      } else if (hasActiveLoan) {
        reasons.push("Withdrawals are restricted while you have an active loan");
      }

      // 2. Check if user is an active surety with active loans
      const { data: sureties } = await (supabase as any)
        .from("loan_sureties")
        .select("id, loan_id, status")
        .eq("surety_user_id", user.id)
        .eq("status", "accepted");

      if (sureties?.length) {
        const suretiedLoanIds = sureties.map((s: any) => s.loan_id);
        const { data: suretiedLoans } = await (supabase as any)
          .from("loans")
          .select("id, status, is_defaulted")
          .in("id", suretiedLoanIds)
          .in("status", ["disbursed", "repaying", "defaulted"]);

        if (suretiedLoans?.length) {
          isActiveSurety = true;
          const hasDefaulted = suretiedLoans.some((l: any) => l.is_defaulted || l.status === "defaulted");
          if (hasDefaulted) {
            reasons.push("Withdrawals are frozen because a loan you guaranteed has defaulted");
          }
        }
      }

      return {
        blocked: reasons.length > 0,
        reasons,
        hasActiveLoan,
        hasOverdueLoan,
        isActiveSurety,
        activeLoanIds,
      };
    },
    enabled: !!user,
  });
};
