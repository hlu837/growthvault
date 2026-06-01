import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export type LoanStatus =
  | "draft"
  | "pending"
  | "surety_pending"
  | "under_review"
  | "approved"
  | "disbursed"
  | "repaying"
  | "completed"
  | "defaulted"
  | "rejected";

export type SuretyStatus = "pending" | "accepted" | "rejected" | "called";

export interface Loan {
  id: string;
  user_id: string;
  amount_requested: number;
  amount_approved: number | null;
  interest_rate: number;
  interest_type: "annual" | "monthly";
  duration_months: number;
  purpose: string;
  member_name: string;
  member_number: string | null;
  residential_address: string | null;
  business_address: string | null;
  occupation: string | null;
  employer_name: string | null;
  monthly_income: number | null;
  risk_score: number;
  credit_limit: number;
  status: LoanStatus;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  disbursed_at: string | null;
  total_repaid: number;
  next_payment_date: string | null;
  monthly_installment: number | null;
  is_defaulted: boolean;
  default_declared_at: string | null;
  recovery_amount: number;
  created_at: string;
  updated_at: string;
}

export interface LoanSurety {
  id: string;
  loan_id: string;
  surety_user_id: string | null;
  surety_name: string;
  surety_member_number: string | null;
  surety_address: string | null;
  surety_occupation: string | null;
  surety_employer: string | null;
  surety_monthly_income: number | null;
  surety_phone: string | null;
  surety_email: string | null;
  guarantee_amount: number;
  relationship_to_borrower: string | null;
  status: SuretyStatus;
  accepted_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  declaration_agreed: boolean;
  declaration_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoanRepayment {
  id: string;
  loan_id: string;
  user_id: string;
  amount: number;
  payment_type: string;
  from_wallet_type: string;
  transaction_id: string | null;
  status: string;
  due_date: string | null;
  paid_at: string;
  created_at: string;
}

// Helper: typed query on tables not yet in generated types
const loansTable = () => (supabase as any).from("loans");
const suretiesTable = () => (supabase as any).from("loan_sureties");
const repaymentsTable = () => (supabase as any).from("loan_repayments");
const rpcCall = (fn: string, params: Record<string, unknown>) =>
  (supabase as any).rpc(fn, params);

// Fetch user's loans
export const useUserLoans = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["loans", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await loansTable()
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Loan[];
    },
    enabled: !!user,
  });
};

// Fetch all loans (admin/staff)
export const useAllLoans = () => {
  const { isAdmin, isStaff } = useAuth();

  return useQuery({
    queryKey: ["loans", "all"],
    queryFn: async () => {
      const { data, error } = await loansTable()
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Loan[];
    },
    enabled: isAdmin || isStaff,
  });
};

// Fetch sureties for a loan
export const useLoanSureties = (loanId: string | undefined) => {
  return useQuery({
    queryKey: ["loan_sureties", loanId],
    queryFn: async () => {
      if (!loanId) return [];
      const { data, error } = await suretiesTable()
        .select("*")
        .eq("loan_id", loanId);
      if (error) throw error;
      return data as LoanSurety[];
    },
    enabled: !!loanId,
  });
};

// Fetch surety requests for current user
export const useMySuretyRequests = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["surety_requests", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await suretiesTable()
        .select("*, loans(*)")
        .eq("surety_user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};

// Search for eligible surety candidates (KYC approved, not frozen)
export const useSuretyCandidates = (search: string) => {
  return useQuery({
    queryKey: ["surety_candidates", search],
    queryFn: async () => {
      const term = search.trim();
      if (!term) return [];

      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, email, referral_code, kyc_status, is_frozen, account_status")
        .or(
          `full_name.ilike.%${term}%,email.ilike.%${term}%,referral_code.ilike.%${term}%`
        )
        .eq("kyc_status", "approved")
        .eq("is_frozen", false)
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!search.trim(),
  });
};

// Fetch repayments for a loan
export const useLoanRepayments = (loanId: string | undefined) => {
  return useQuery({
    queryKey: ["loan_repayments", loanId],
    queryFn: async () => {
      if (!loanId) return [];
      const { data, error } = await repaymentsTable()
        .select("*")
        .eq("loan_id", loanId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LoanRepayment[];
    },
    enabled: !!loanId,
  });
};

// Apply for a loan
export const useApplyForLoan = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      p_amount: number;
      p_duration_months: number;
      p_purpose: string;
      p_member_name: string;
      p_residential_address?: string;
      p_business_address?: string;
      p_occupation?: string;
      p_employer_name?: string;
      p_monthly_income?: number;
      p_interest_type?: "annual" | "monthly";
      p_interest_rate?: number;
    }) => {
      const { data, error } = await rpcCall("apply_for_loan", params);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      toast({ title: "Loan application submitted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Loan application failed", description: error.message, variant: "destructive" });
    },
  });
};

// Approve loan (admin)
export const useApproveLoan = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: { p_loan_id: string; p_approved_amount?: number }) => {
      const { data, error } = await rpcCall("approve_loan", params);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      toast({ title: "Loan approved" });
    },
    onError: (error: Error) => {
      toast({ title: "Approval failed", description: error.message, variant: "destructive" });
    },
  });
};

// Disburse loan (admin)
export const useDisburseLoan = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (loanId: string) => {
      const { data, error } = await rpcCall("disburse_loan", { p_loan_id: loanId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      toast({ title: "Loan disbursed successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Disbursement failed", description: error.message, variant: "destructive" });
    },
  });
};

// Make repayment
export const useMakeLoanRepayment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: { p_loan_id: string; p_amount: number }) => {
      const { data, error } = await rpcCall("make_loan_repayment", params);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan_repayments"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      toast({ title: "Payment successful" });
    },
    onError: (error: Error) => {
      toast({ title: "Payment failed", description: error.message, variant: "destructive" });
    },
  });
};

// Loan requests hooks
export const useLoanRequests = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["loan_requests", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("loan_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};

export const useRecommendedSureties = (loanRequestId: string | undefined) => {
  return useQuery({
    queryKey: ["recommended_sureties", loanRequestId],
    queryFn: async () => {
      if (!loanRequestId) return [];
      const { data, error } = await (supabase as any)
        .rpc("get_recommended_sureties", { p_loan_request_id: loanRequestId });
      if (error) throw error;
      return data;
    },
    enabled: !!loanRequestId,
  });
};

export const useRequestSurety = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      p_loan_request_id: string;
      p_surety_user_id: string;
      p_guarantee_amount: number;
      p_relationship?: string;
    }) => {
      const { data, error } = await (supabase as any)
        .rpc("request_loan_surety", params);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recommended_sureties"] });
      queryClient.invalidateQueries({ queryKey: ["surety_requests"] });
      toast({ title: "Surety request sent successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Surety request failed", description: error.message, variant: "destructive" });
    },
  });
};

export const useRespondToSuretyRequest = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      p_surety_request_id: string;
      p_response: "accepted" | "rejected";
      p_rejection_reason?: string;
    }) => {
      const { data, error } = await (supabase as any)
        .rpc("respond_to_surety_request", params);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["surety_requests"] });
      queryClient.invalidateQueries({ queryKey: ["recommended_sureties"] });
      toast({ title: "Response submitted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Response failed", description: error.message, variant: "destructive" });
    },
  });
};

// Add surety to a loan
export const useAddSurety = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (surety: {
      loan_id: string;
      surety_user_id?: string;
      surety_name: string;
      surety_member_number?: string;
      surety_address?: string;
      surety_occupation?: string;
      surety_employer?: string;
      surety_monthly_income?: number;
      surety_phone?: string;
      surety_email?: string;
      guarantee_amount: number;
      relationship_to_borrower?: string;
    }) => {
      const { data, error } = await suretiesTable()
        .insert(surety)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan_sureties"] });
      toast({ title: "Surety added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add surety", description: error.message, variant: "destructive" });
    },
  });
};

// Respond to surety request (accept/reject)
export const useRespondToSurety = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      surety_id: string;
      accept: boolean;
      rejection_reason?: string;
    }) => {
      const update: Record<string, unknown> = {
        status: params.accept ? "accepted" : "rejected",
        ...(params.accept
          ? { accepted_at: new Date().toISOString(), declaration_agreed: true, declaration_date: new Date().toISOString() }
          : { rejected_at: new Date().toISOString(), rejection_reason: params.rejection_reason }),
      };

      const { error } = await suretiesTable()
        .update(update)
        .eq("id", params.surety_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loan_sureties"] });
      queryClient.invalidateQueries({ queryKey: ["surety_requests"] });
      toast({ title: "Surety response recorded" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to respond", description: error.message, variant: "destructive" });
    },
  });
};
