import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Upload, 
  Search, 
  User,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Clock,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import AdminLayout from "@/components/AdminLayout";
import DocumentPreview from "@/components/staff/DocumentPreview";
import RejectionModal from "@/components/staff/RejectionModal";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getTierDisplayName } from "@/lib/utils";

// Bank account management hooks
export const useUserBankAccounts = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user_bank_accounts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await (supabase as any)
        .rpc("get_user_bank_accounts");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
};

export const useManageBankAccount = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      p_action: "add" | "update" | "delete" | "set_default";
      p_account_id?: string;
      p_bank_name?: string;
      p_account_number?: string;
      p_account_type?: string;
      p_account_holder_name?: string;
    }) => {
      const { data, error } = await (supabase as any)
        .rpc("manage_bank_account", params);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_bank_accounts"] });
      toast({ title: "Bank account updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Bank account operation failed", description: error.message, variant: "destructive" });
    },
  });
};
import { cn } from "@/lib/utils";

interface DepositRequest {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  bank_reference: string | null;
  proof_url: string | null;
  created_at: string | null;
  profile?: {
    full_name: string | null;
    email: string | null;
    investment_tier: string | null;
  };
  bank_account?: {
    id: string;
    bank_name: string;
    account_number: string;
    account_type: string;
    account_holder_name: string;
    is_default: boolean;
  };
}

const AdminDeposits = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<DepositRequest | null>(null);
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();

  // Fetch pending deposits with profiles and bank accounts
  const { data: deposits, isLoading } = useQuery({
    queryKey: ["admin-deposits-queue"],
    queryFn: async () => {
      const { data: depositsData, error: depositsError } = await supabase
        .from("deposits")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (depositsError) throw depositsError;

      // Fetch profiles and bank accounts for each deposit
      const userIds = [...new Set(depositsData.map(d => d.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, email, investment_tier")
        .in("id", userIds);

      const { data: bankAccountsData } = await (supabase as any)
        .rpc("get_user_bank_accounts")
        .then(accounts => accounts?.filter(acc => userIds.includes(acc.user_id)) || []);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      const bankAccountsMap = new Map(bankAccountsData?.map(acc => [acc.user_id, acc]) || []);

      return depositsData.map(deposit => ({
        ...deposit,
        profile: profilesMap.get(deposit.user_id),
        bank_account: bankAccountsMap.get(deposit.user_id)
      })) as DepositRequest[];
    },
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  // Auto-select first pending request
  useEffect(() => {
    if (deposits && deposits.length > 0 && !selectedRequest) {
      setSelectedRequest(deposits[0]);
    }
  }, [deposits, selectedRequest]);

  // Approve deposit mutation
  const approveDeposit = useMutation({
    mutationFn: async (depositId: string) => {
      const { data, error } = await supabase.rpc('approve_deposit_and_credit', {
        p_deposit_id: depositId
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-deposits-queue'] });
      toast.success('Deposit approved and credited');
      setSelectedRequest(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve deposit');
    }
  });

  // Reject deposit mutation
  const rejectDeposit = useMutation({
    mutationFn: async ({ depositId, reason }: { depositId: string; reason: string }) => {
      const { error } = await supabase
        .from("deposits")
        .update({ 
          status: "rejected",
          rejection_reason: reason,
          verified_at: new Date().toISOString()
        })
        .eq("id", depositId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-deposits-queue'] });
      toast.success('Deposit rejected');
      setSelectedRequest(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reject deposit');
    }
  });

  const filteredRequests = deposits?.filter((req) => {
    const matchesSearch = 
      req.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.profile?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.id?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  }) || [];

  const hasProof = selectedRequest?.proof_url && selectedRequest.proof_url.length > 0;

  const handleApprove = () => {
    if (!selectedRequest || !hasProof) return;
    approveDeposit.mutate(selectedRequest.id);
  };

  const handleReject = (reason: string) => {
    if (!selectedRequest) return;
    rejectDeposit.mutate({ depositId: selectedRequest.id, reason });
  };

  if (!isAdmin) {
    return (
      <AdminLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{t("admin.accessOnly")}</h1>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="h-[calc(100vh-8rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 font-mono">
              <Upload className="w-3 h-3" />
              {t("admin.deposits.header")}
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              {t("admin.deposits.title")}
            </h1>
          </div>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 font-mono">
            {filteredRequests.length} {t("admin.deposits.pending")}
          </Badge>
        </div>

        {/* Split Screen Layout */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
          {/* Left Panel - Queue */}
          <div className="flex flex-col bg-slate-950/50 border border-slate-800 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  placeholder={t("admin.deposits.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-red-400 animate-spin" />
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <Upload className="w-12 h-12 mb-4 opacity-30" />
                   <p>{t("admin.deposits.noPending")}</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {filteredRequests.map((request) => (
                    <button
                      key={request.id}
                      onClick={() => setSelectedRequest(request)}
                      className={cn(
                        "w-full p-4 text-left transition-all flex items-center gap-4",
                        selectedRequest?.id === request.id
                          ? "bg-red-500/10 border-l-2 border-l-red-500"
                          : "hover:bg-slate-900/50"
                      )}
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white truncate">
                            {request.profile?.full_name || "Unknown"}
                          </span>
                          {!request.proof_url && (
                            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">{request.profile?.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm font-mono text-amber-400">
                            ${Number(request.amount).toLocaleString()}
                          </span>
                          <Clock className="w-3 h-3 text-slate-600" />
                          <span className="text-[10px] text-slate-600 font-mono">
                            {request.created_at ? new Date(request.created_at).toLocaleDateString() : "N/A"}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className={cn(
                        "w-4 h-4 flex-shrink-0 transition-colors",
                        selectedRequest?.id === request.id ? "text-red-400" : "text-slate-600"
                      )} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Review Area */}
          <div className="flex flex-col gap-4 min-h-0">
            {selectedRequest ? (
              <>
                {/* Deposit Info */}
                <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                    {t("admin.deposits.depositDetails")}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-500 text-xs">{t("admin.deposits.depositor")}</Label>
                      <p className="text-white font-medium">{selectedRequest.profile?.full_name || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500 text-xs">{t("admin.deposits.amount")}</Label>
                      <p className="text-amber-400 font-mono font-bold text-lg">
                        {formatAmount(selectedRequest.amount)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-slate-500 text-xs">{t("admin.deposits.bankAccount")}</Label>
                      <p className="text-white font-medium">
                        {selectedRequest.bank_account ? (
                          <>
                            <div className="font-medium">{selectedRequest.bank_account.bank_name}</div>
                            <div className="text-sm text-slate-400">
                              {selectedRequest.bank_account.account_number} ({selectedRequest.bank_account.account_type})
                            </div>
                            <div className="text-xs text-slate-500">
                              Holder: {selectedRequest.bank_account.account_holder_name}
                            </div>
                          </>
                        ) : "N/A"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-slate-500 text-xs">{t("admin.deposits.bankReference")}</Label>
                      <p className="text-white font-mono">{selectedRequest.bank_reference || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500 text-xs">{t("admin.deposits.currentTier")}</Label>
                      <p className="text-white">{getTierDisplayName(selectedRequest.profile?.investment_tier)}</p>
                    </div>
                  </div>
                </div>

                {/* Proof Preview */}
                <div className="flex-1 min-h-0">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {t("admin.deposits.paymentProof")}
                  </h3>
                  <DocumentPreview 
                    filePath={selectedRequest.proof_url}
                    bucketName="deposit-proofs"
                    className="h-full"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                    onClick={() => setRejectionModalOpen(true)}
                    disabled={rejectDeposit.isPending}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    {t("admin.reject")}
                  </Button>
                  <Button
                    className={cn(
                      "flex-1",
                      hasProof 
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-slate-700 text-slate-400 cursor-not-allowed"
                    )}
                    onClick={handleApprove}
                    disabled={!hasProof || approveDeposit.isPending}
                  >
                    {approveDeposit.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    {hasProof ? t("admin.deposits.approveCredit") : t("admin.deposits.noProof")}
                  </Button>
                </div>

                {!hasProof && (
                  <p className="text-xs text-red-400 text-center">
                    {t("admin.deposits.noProofWarning")}
                  </p>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center bg-slate-950/50 border border-slate-800 rounded-lg">
                <Upload className="w-16 h-16 text-slate-700 mb-4" />
                <p className="text-slate-500">{t("admin.deposits.selectToReview")}</p>
              </div>
            )}
          </div>
        </div>

        {/* Rejection Modal */}
        <RejectionModal
          open={rejectionModalOpen}
          onClose={() => setRejectionModalOpen(false)}
          onConfirm={handleReject}
          title={t("admin.deposits.rejectTitle")}
          description={t("admin.deposits.rejectDesc")}
          type="deposit"
          isPending={rejectDeposit.isPending}
        />
      </div>
    </AdminLayout>
  );
};

export default AdminDeposits;
