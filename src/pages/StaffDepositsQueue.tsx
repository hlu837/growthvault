import { useState, useEffect } from "react";
import { 
  Upload, 
  Search, 
  User,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Clock,
  Loader2,
  DollarSign,
  Hash
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import StaffLayout from "@/components/StaffLayout";
import DocumentPreview from "@/components/staff/DocumentPreview";
import RejectionModal from "@/components/staff/RejectionModal";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DepositRequest {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  bank_reference: string | null;
  proof_url: string | null;
  created_at: string | null;
  profiles: {
    full_name: string | null;
    email: string | null;
  } | null;
}

const StaffDepositsQueue = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDeposit, setSelectedDeposit] = useState<DepositRequest | null>(null);
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const { isAdmin, isStaff } = useAuth();
  const queryClient = useQueryClient();

  // Fetch pending deposits
  const { data: deposits, isLoading } = useQuery({
    queryKey: ["staff-deposits-queue"],
    queryFn: async () => {
      // First fetch deposits
      const { data: depositsData, error: depositsError } = await supabase
        .from("deposits")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (depositsError) throw depositsError;

      // Then fetch profiles for each deposit
      const depositsWithProfiles = await Promise.all(
        depositsData.map(async (deposit) => {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", deposit.user_id)
            .maybeSingle();

          return {
            ...deposit,
            profiles: profileData,
          };
        })
      );

      return depositsWithProfiles as DepositRequest[];
    },
    enabled: isAdmin || isStaff,
    refetchInterval: 30000,
  });

  // Auto-select first pending deposit
  useEffect(() => {
    if (deposits && deposits.length > 0 && !selectedDeposit) {
      setSelectedDeposit(deposits[0]);
    }
  }, [deposits, selectedDeposit]);

  // Verify deposit mutation
  const verifyDepositMutation = useMutation({
    mutationFn: async (depositId: string) => {
      const { data, error } = await supabase.rpc("approve_deposit_and_credit", {
        p_deposit_id: depositId,
        p_tier: "starter"
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-deposits-queue"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Deposit verified and funds credited");
      setSelectedDeposit(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to verify deposit");
    },
  });

  // Reject deposit mutation
  const rejectDepositMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from("deposits")
        .update({ 
          status: "rejected", 
          rejection_reason: reason 
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-deposits-queue"] });
      toast.success("Deposit rejected");
      setSelectedDeposit(null);
    },
    onError: () => {
      toast.error("Failed to reject deposit");
    },
  });

  const filteredDeposits = deposits?.filter((d) => {
    const matchesSearch = 
      d.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.bank_reference?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  }) || [];

  const hasProof = selectedDeposit?.proof_url && selectedDeposit.proof_url.length > 0;

  const handleVerify = () => {
    if (!selectedDeposit || !hasProof) return;
    verifyDepositMutation.mutate(selectedDeposit.id);
  };

  const handleReject = (reason: string) => {
    if (!selectedDeposit) return;
    rejectDepositMutation.mutate({ id: selectedDeposit.id, reason });
  };

  if (!isAdmin && !isStaff) {
    return (
      <StaffLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <img src="/logo.png" alt="GWA Logo" className="w-16 h-16 mb-4 rounded-lg shadow-md" />
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
        </div>
      </StaffLayout>
    );
  }

  return (
    <StaffLayout>
      <div className="h-[calc(100vh-8rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 font-mono">
              <Upload className="w-3 h-3" />
              QUEUE: DEPOSIT APPROVALS
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Deposit Verification Queue
            </h1>
          </div>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 font-mono">
            {filteredDeposits.length} PENDING
          </Badge>
        </div>

        {/* Split Screen Layout */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
          {/* Left Panel - Task Queue */}
          <div className="flex flex-col bg-slate-950/50 border border-slate-800 rounded-lg overflow-hidden">
            {/* Search */}
            <div className="p-4 border-b border-slate-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  placeholder="Search by name, email, or reference..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Queue List */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                </div>
              ) : filteredDeposits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <Upload className="w-12 h-12 mb-4 opacity-30" />
                  <p>No pending deposits</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {filteredDeposits.map((deposit) => (
                    <button
                      key={deposit.id}
                      onClick={() => setSelectedDeposit(deposit)}
                      className={cn(
                        "w-full p-4 text-left transition-all flex items-center gap-4",
                        selectedDeposit?.id === deposit.id
                          ? "bg-cyan-500/10 border-l-2 border-l-cyan-500"
                          : "hover:bg-slate-900/50"
                      )}
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                        <DollarSign className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white truncate">
                            {deposit.profiles?.full_name || "Unknown User"}
                          </span>
                          {!deposit.proof_url && (
                            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                          {deposit.profiles?.email}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-sm font-bold text-emerald-400 font-mono">
                            ${Number(deposit.amount).toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-600 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {deposit.created_at 
                              ? new Date(deposit.created_at).toLocaleDateString()
                              : "Unknown"}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className={cn(
                        "w-4 h-4 flex-shrink-0 transition-colors",
                        selectedDeposit?.id === deposit.id ? "text-cyan-400" : "text-slate-600"
                      )} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Review Area */}
          <div className="flex flex-col gap-4 min-h-0">
            {selectedDeposit ? (
              <>
                {/* Deposit Details Card */}
                <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                    Deposit Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-500 text-xs">User</Label>
                      <p className="text-white font-medium">
                        {selectedDeposit.profiles?.full_name || "N/A"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {selectedDeposit.profiles?.email}
                      </p>
                    </div>
                    <div>
                      <Label className="text-slate-500 text-xs">Amount</Label>
                      <p className="text-2xl font-bold text-emerald-400 font-mono">
                        ${Number(selectedDeposit.amount).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <Label className="text-slate-500 text-xs">Bank Reference</Label>
                      <p className="text-white font-mono text-sm flex items-center gap-2">
                        <Hash className="w-3 h-3 text-slate-500" />
                        {selectedDeposit.bank_reference || "N/A"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-slate-500 text-xs">Submitted</Label>
                      <p className="text-white font-mono text-sm">
                        {selectedDeposit.created_at 
                          ? new Date(selectedDeposit.created_at).toLocaleString()
                          : "Unknown"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Proof Preview */}
                <div className="flex-1 min-h-0">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Payment Proof
                  </h3>
                  <DocumentPreview 
                    filePath={selectedDeposit.proof_url}
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
                    disabled={rejectDepositMutation.isPending}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    className={cn(
                      "flex-1",
                      hasProof 
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-slate-700 text-slate-400 cursor-not-allowed"
                    )}
                    onClick={handleVerify}
                    disabled={!hasProof || verifyDepositMutation.isPending}
                  >
                    {verifyDepositMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    {hasProof ? "Verify & Credit" : "No Proof"}
                  </Button>
                </div>

                {!hasProof && (
                  <p className="text-xs text-red-400 text-center">
                    Verification is disabled until payment proof is uploaded
                  </p>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center bg-slate-950/50 border border-slate-800 rounded-lg">
                <Upload className="w-16 h-16 text-slate-700 mb-4" />
                <p className="text-slate-500">Select a deposit to review</p>
              </div>
            )}
          </div>
        </div>

        {/* Rejection Modal */}
        <RejectionModal
          open={rejectionModalOpen}
          onClose={() => setRejectionModalOpen(false)}
          onConfirm={handleReject}
          title="Reject Deposit"
          description="Please select a reason for rejecting this deposit."
          type="deposit"
          isPending={rejectDepositMutation.isPending}
        />
      </div>
    </StaffLayout>
  );
};

export default StaffDepositsQueue;
