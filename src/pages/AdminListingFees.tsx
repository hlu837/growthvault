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
  Tag
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
import { useCurrency } from "@/contexts/CurrencyContext";
import { cn } from "@/lib/utils";

interface ListingFeePayment {
  id: string;
  user_id: string;
  product_id: string;
  amount: number;
  status: string;
  bank_reference: string | null;
  proof_url: string | null;
  created_at: string | null;
  profile?: {
    full_name: string | null;
    email: string | null;
  };
  product?: {
    title: string | null;
    category: string | null;
  };
}

const AdminListingFees = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<ListingFeePayment | null>(null);
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { formatAmount } = useCurrency();

  // Fetch pending listing fee payments
  const { data: payments, isLoading } = useQuery({
    queryKey: ["admin-listing-fees"],
    queryFn: async () => {
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("listing_fee_payments")
        .select(`
          *,
          profile:profiles(full_name, email),
          product:marketplace_products(title, category)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (paymentsError) throw paymentsError;

      return paymentsData.map((d: any) => ({
        ...d,
        profile: d.profile || null,
        product: d.product || null
      })) as ListingFeePayment[];
    },
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  // Auto-select first pending request
  useEffect(() => {
    if (payments && payments.length > 0 && !selectedRequest) {
      setSelectedRequest(payments[0]);
    }
  }, [payments, selectedRequest]);

  // Approve payment mutation
  const approvePayment = useMutation({
    mutationFn: async (paymentId: string) => {
      const { data, error } = await supabase.rpc('approve_listing_fee_transfer', {
        p_payment_id: paymentId
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-listing-fees'] });
      queryClient.invalidateQueries({ queryKey: ['marketplaceProducts'] });
      toast.success('Listing fee approved and product activated');
      setSelectedRequest(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve payment');
    }
  });

  // Reject payment mutation
  const rejectPayment = useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: string; reason: string }) => {
      const { error } = await supabase
        .from("listing_fee_payments")
        .update({ 
          status: "rejected",
          rejection_reason: reason,
          verified_at: new Date().toISOString()
        })
        .eq("id", paymentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-listing-fees'] });
      toast.success('Payment rejected');
      setSelectedRequest(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reject payment');
    }
  });

  const filteredRequests = payments?.filter((req) => {
    const matchesSearch = 
      req.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.profile?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.product?.title?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  }) || [];

  const hasProof = selectedRequest?.proof_url && selectedRequest.proof_url.length > 0;

  const handleApprove = () => {
    if (!selectedRequest || !hasProof) return;
    approvePayment.mutate(selectedRequest.id);
  };

  const handleReject = (reason: string) => {
    if (!selectedRequest) return;
    rejectPayment.mutate({ paymentId: selectedRequest.id, reason });
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
      <div className="h-[calc(100vh-8rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 font-mono">
              <Tag className="w-3 h-3" />
              MARKETPLACE FEES
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Listing Fee Approvals
            </h1>
          </div>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 font-mono">
            {filteredRequests.length} PENDING
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
                  placeholder="Search by user or product..."
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
                  <Tag className="w-12 h-12 mb-4 opacity-30" />
                   <p>No pending listing fees</p>
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
                        <p className="text-xs text-slate-500 truncate">{request.product?.title || "Unknown Product"}</p>
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
                    Payment Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-500 text-xs">Seller</Label>
                      <p className="text-white font-medium">{selectedRequest.profile?.full_name || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500 text-xs">Fee Amount</Label>
                      <p className="text-amber-400 font-mono font-bold text-lg">
                        {formatAmount(selectedRequest.amount)}
                      </p>
                    </div>
                    <div>
                      <Label className="text-slate-500 text-xs">Product Name</Label>
                      <p className="text-white font-medium">
                        {selectedRequest.product?.title || "Unknown"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-slate-500 text-xs">Category</Label>
                      <p className="text-white">
                        <Badge variant="outline" className="mt-1 bg-slate-900 border-slate-700">
                          {selectedRequest.product?.category?.replace('_', ' ').toUpperCase() || "N/A"}
                        </Badge>
                      </p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-slate-500 text-xs">Bank Reference</Label>
                      <p className="text-white font-mono bg-slate-900 p-2 rounded border border-slate-800 inline-block mt-1">
                        {selectedRequest.bank_reference || "N/A"}
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
                    disabled={rejectPayment.isPending}
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
                    onClick={handleApprove}
                    disabled={!hasProof || approvePayment.isPending}
                  >
                    {approvePayment.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    {hasProof ? "Approve & Activate" : "No Proof Uploaded"}
                  </Button>
                </div>

                {!hasProof && (
                  <p className="text-xs text-red-400 text-center">
                    Warning: User did not upload a proof of payment.
                  </p>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center bg-slate-950/50 border border-slate-800 rounded-lg">
                <Upload className="w-16 h-16 text-slate-700 mb-4" />
                <p className="text-slate-500">Select a payment request to review</p>
              </div>
            )}
          </div>
        </div>

        {/* Rejection Modal */}
        <RejectionModal
          open={rejectionModalOpen}
          onClose={() => setRejectionModalOpen(false)}
          onConfirm={handleReject}
          title="Reject Listing Fee"
          description="Please provide a reason for rejecting this listing fee payment."
          type="deposit"
          isPending={rejectPayment.isPending}
        />
      </div>
    </AdminLayout>
  );
};

export default AdminListingFees;
