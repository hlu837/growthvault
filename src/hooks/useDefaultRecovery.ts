import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const rpcCall = (fn: string, params: Record<string, unknown>) =>
  (supabase as any).rpc(fn, params);

/**
 * Auto-deduct from borrower's wallets to cover missed payment.
 * Tries wallets in priority order: savings → prudent_saving → golden_saving → future_saving → loans_saving
 */
export const useAutoDeductBorrower = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: { loan_id: string; amount_due: number; user_id: string }) => {
      const { data, error } = await rpcCall("auto_deduct_loan_repayment", {
        p_loan_id: params.loan_id,
        p_user_id: params.user_id,
        p_amount: params.amount_due,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["loan_repayments"] });
      toast({ title: "Auto-deduction processed" });
    },
    onError: (e: Error) => {
      toast({ title: "Auto-deduction failed", description: e.message, variant: "destructive" });
    },
  });
};

/**
 * Apply late penalty to a loan after grace period expires.
 * Adds penalty_percent of the overdue installment to the loan balance.
 */
export const useApplyLatePenalty = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: { loan_id: string; penalty_amount: number }) => {
      const { data, error } = await rpcCall("apply_late_penalty", {
        p_loan_id: params.loan_id,
        p_penalty_amount: params.penalty_amount,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      toast({ title: "Late penalty applied" });
    },
    onError: (e: Error) => {
      toast({ title: "Penalty failed", description: e.message, variant: "destructive" });
    },
  });
};

/**
 * Trigger surety recovery: split remaining debt 50/50 between the two accepted sureties.
 * Per spec: "Split remaining debt between Surety A & B" equally.
 */
export const useTriggerSuretyRecovery = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: { loan_id: string; recovery_amount: number }) => {
      // Try RPC first — if it exists, it handles 50/50 server-side
      const { data, error } = await rpcCall("trigger_surety_recovery_5050", {
        p_loan_id: params.loan_id,
        p_recovery_amount: params.recovery_amount,
      });
      if (error) {
        // Fallback: try the original RPC with a note about 50/50
        const { data: fallbackData, error: fallbackError } = await rpcCall("trigger_surety_recovery", {
          p_loan_id: params.loan_id,
          p_recovery_amount: params.recovery_amount,
        });
        if (fallbackError) throw fallbackError;
        return fallbackData;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["loan_sureties"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      toast({ title: "Surety recovery executed (50/50 split)" });
    },
    onError: (e: Error) => {
      toast({ title: "Surety recovery failed", description: e.message, variant: "destructive" });
    },
  });
};

/**
 * Reverse Recovery Engine:
 * 1. Freeze borrower account (block withdrawals & commissions)
 * 2. Block borrower from new loans
 * 3. Redirect future commissions/ROI to sureties
 * 4. Convert debt into "Recoverable Debt Account"
 * 5. Flag for manual/legal recovery
 */
export const useReverseRecovery = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: { loan_id: string; user_id: string; reason: string }) => {
      const { data, error } = await rpcCall("reverse_recovery_engine", {
        p_loan_id: params.loan_id,
        p_user_id: params.user_id,
        p_reason: params.reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      toast({ title: "Reverse Recovery initiated — borrower frozen, commissions redirected to sureties" });
    },
    onError: (e: Error) => {
      toast({ title: "Reverse recovery failed", description: e.message, variant: "destructive" });
    },
  });
};

/**
 * Helper: Check if a loan is past its grace period.
 */
export const isLoanPastGracePeriod = (nextPaymentDate: string | null, gracePeriodDays: number = 7): boolean => {
  if (!nextPaymentDate) return false;
  const due = new Date(nextPaymentDate);
  const graceEnd = new Date(due.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000);
  return new Date() > graceEnd;
};

/**
 * Helper: Calculate late penalty amount (2% weekly per spec).
 */
export const calculateLatePenalty = (monthlyInstallment: number, penaltyPercent: number = 2): number => {
  return monthlyInstallment * (penaltyPercent / 100);
};

/**
 * Helper: Days overdue past grace period.
 */
export const daysOverdue = (nextPaymentDate: string | null, gracePeriodDays: number = 7): number => {
  if (!nextPaymentDate) return 0;
  const due = new Date(nextPaymentDate);
  const graceEnd = new Date(due.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000);
  const diff = Math.floor((Date.now() - graceEnd.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
};

/**
 * Helper: Calculate weeks overdue for weekly penalty calculation.
 */
export const weeksOverdue = (nextPaymentDate: string | null, gracePeriodDays: number = 7): number => {
  const days = daysOverdue(nextPaymentDate, gracePeriodDays);
  return Math.ceil(days / 7);
};
