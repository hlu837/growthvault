import { useState } from "react";
import { 
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import AdminLayout from "@/components/AdminLayout";
import RejectionModal from "@/components/staff/RejectionModal";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const AdminWithdrawals = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any>(null);
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  // Fetch pending withdrawals
  const { data: withdrawals, isLoading } = useQuery({
    queryKey: ["admin-withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawals")
        .select(`
          *,
          profiles:user_id (full_name, email, kyc_status)
        `)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  // Approve withdrawal mutation
  const approveWithdrawal = useMutation({
    mutationFn: async (withdrawalId: string) => {
      const { data, error } = await supabase.rpc('approve_withdrawal', {
        p_withdrawal_id: withdrawalId
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] });
      toast.success('Withdrawal approved');
      setSelectedWithdrawal(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve withdrawal');
    }
  });

  // Reject withdrawal mutation
  const rejectWithdrawal = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await supabase.rpc('reject_withdrawal', {
        p_withdrawal_id: id,
        p_reason: reason
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-withdrawals'] });
      toast.success('Withdrawal rejected');
      setSelectedWithdrawal(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reject withdrawal');
    }
  });

  const pendingWithdrawals = withdrawals?.filter(w => w.status === 'pending') || [];
  const processedWithdrawals = withdrawals?.filter(w => w.status !== 'pending') || [];

  const filteredPending = pendingWithdrawals.filter((w: any) => {
    const matchesSearch = 
      w.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleReject = (reason: string) => {
    if (!selectedWithdrawal) return;
    rejectWithdrawal.mutate({ id: selectedWithdrawal.id, reason });
    setRejectionModalOpen(false);
  };

  if (!isAdmin) {
    return (
      <AdminLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Admin Access Only</h1>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 font-mono">
              <CreditCard className="w-3 h-3" />
              WITHDRAWAL APPROVAL
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Withdrawal Requests
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Only admins can approve or reject withdrawal requests
            </p>
          </div>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 font-mono">
            {filteredPending.length} PENDING
          </Badge>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>

        {/* Pending Withdrawals */}
        <div className="bg-slate-950/50 border border-slate-800 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-sm font-bold text-slate-300">Pending Approvals</h2>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-red-400 animate-spin" />
            </div>
          ) : filteredPending.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <CheckCircle className="w-12 h-12 mb-4 opacity-30" />
              <p>No pending withdrawals</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {filteredPending.map((withdrawal: any) => (
                <div 
                  key={withdrawal.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-900/50"
                >
                  <div className="flex-1">
                    <div className="font-medium text-white">
                      {withdrawal.profiles?.full_name || "Unknown User"}
                    </div>
                    <div className="text-sm text-slate-500">{withdrawal.profiles?.email}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-600 font-mono">
                        From: {withdrawal.wallet_type?.replace("_", " ")}
                      </span>
                      {withdrawal.profiles?.kyc_status !== 'approved' && (
                        <Badge variant="outline" className="text-red-400 border-red-500/30 text-[10px]">
                          KYC NOT VERIFIED
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold font-mono text-amber-400">
                      ${Number(withdrawal.amount).toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-600 flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3" />
                      {new Date(withdrawal.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => approveWithdrawal.mutate(withdrawal.id)}
                      disabled={approveWithdrawal.isPending}
                    >
                      {approveWithdrawal.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      onClick={() => {
                        setSelectedWithdrawal(withdrawal);
                        setRejectionModalOpen(true);
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Processed */}
        {processedWithdrawals.length > 0 && (
          <div className="bg-slate-950/50 border border-slate-800 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <h2 className="text-sm font-bold text-slate-300">Recently Processed</h2>
            </div>
            <div className="divide-y divide-slate-800 max-h-64 overflow-y-auto">
              {processedWithdrawals.slice(0, 10).map((withdrawal: any) => (
                <div 
                  key={withdrawal.id}
                  className="p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex-1">
                    <div className="font-medium text-slate-300">
                      {withdrawal.profiles?.full_name || "Unknown"}
                    </div>
                    <div className="text-sm text-slate-600">{withdrawal.profiles?.email}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-slate-400">
                      ${Number(withdrawal.amount).toLocaleString()}
                    </div>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      withdrawal.status === 'approved' 
                        ? "text-emerald-400 border-emerald-500/30" 
                        : "text-red-400 border-red-500/30"
                    )}
                  >
                    {withdrawal.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rejection Modal */}
        <RejectionModal
          open={rejectionModalOpen}
          onClose={() => setRejectionModalOpen(false)}
          onConfirm={handleReject}
          title="Reject Withdrawal"
          description="Please select a reason for rejecting this withdrawal request."
          type="deposit"
          isPending={rejectWithdrawal.isPending}
        />
      </div>
    </AdminLayout>
  );
};

export default AdminWithdrawals;
