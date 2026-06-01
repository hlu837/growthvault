import { useState, useEffect, useCallback } from "react";
import { 
  FileCheck, 
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
import StaffLayout from "@/components/StaffLayout";
import KYCDocumentGallery from "@/components/staff/KYCDocumentGallery";
import RejectionModal from "@/components/staff/RejectionModal";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface KYCRequest {
  id: string;
  full_name: string | null;
  email: string | null;
  kyc_status: string;
  id_type: string | null;
  id_number: string | null;
  kyc_document_url: string | null;
  passport_url: string | null;
  selfie_url: string | null;
  kyc_submitted_at: string | null;
  created_at: string | null;
  investment_tier: string | null;
  referral_code: string | null;
}

const StaffKYCQueue = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<KYCRequest | null>(null);
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const { isAdmin, isStaff } = useAuth();
  const queryClient = useQueryClient();

  // Fetch pending KYC requests
  const { data: kycRequests, isLoading } = useQuery({
    queryKey: ["staff-kyc-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("kyc_status", "pending")
        .order("kyc_submitted_at", { ascending: true });

      if (error) throw error;
      return data as KYCRequest[];
    },
    enabled: isAdmin || isStaff,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Auto-select first pending request
  useEffect(() => {
    if (kycRequests && kycRequests.length > 0 && !selectedRequest) {
      setSelectedRequest(kycRequests[0]);
    }
  }, [kycRequests, selectedRequest]);

  // Approve KYC mutation
  const approveKycMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.rpc('approve_kyc', {
        p_user_id: userId,
        p_new_status: 'approved'
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-kyc-queue'] });
      toast.success('KYC approved successfully');
      setSelectedRequest(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve KYC');
    }
  });

  // Reject KYC mutation
  const rejectKycMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const { data, error } = await supabase.rpc('approve_kyc', {
        p_user_id: userId,
        p_new_status: 'rejected',
        p_reason: reason
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-kyc-queue'] });
      toast.success('KYC rejected');
      setSelectedRequest(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reject KYC');
    }
  });

  const filteredRequests = kycRequests?.filter((req) => {
    const matchesSearch = 
      req.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.id?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  }) || [];

  // Check if all required documents are uploaded
  const hasAllDocuments = selectedRequest?.kyc_document_url && 
    selectedRequest?.passport_url && 
    selectedRequest?.selfie_url;

  // Only admins can do final KYC approval
  const canApprove = isAdmin && hasAllDocuments;

  const handleApprove = () => {
    if (!selectedRequest || !canApprove) return;
    approveKycMutation.mutate(selectedRequest.id);
  };

  const handleReject = (reason: string) => {
    if (!selectedRequest) return;
    rejectKycMutation.mutate({ userId: selectedRequest.id, reason });
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
              <FileCheck className="w-3 h-3" />
              QUEUE: KYC VERIFICATIONS
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Identity Verification Queue
            </h1>
          </div>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 font-mono">
            {filteredRequests.length} PENDING
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
                  placeholder="Search by name, email, or ID..."
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
              ) : filteredRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <FileCheck className="w-12 h-12 mb-4 opacity-30" />
                  <p>No pending verifications</p>
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
                          ? "bg-cyan-500/10 border-l-2 border-l-cyan-500"
                          : "hover:bg-slate-900/50"
                      )}
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white truncate">
                            {request.full_name || "Unknown User"}
                          </span>
                          {!request.kyc_document_url && (
                            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">{request.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-3 h-3 text-slate-600" />
                          <span className="text-[10px] text-slate-600 font-mono">
                            {request.kyc_submitted_at 
                              ? new Date(request.kyc_submitted_at).toLocaleDateString()
                              : "Not submitted"}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className={cn(
                        "w-4 h-4 flex-shrink-0 transition-colors",
                        selectedRequest?.id === request.id ? "text-cyan-400" : "text-slate-600"
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
                {/* User Profile Card */}
                <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                    User Profile Data
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-500 text-xs">Full Name</Label>
                      <p className="text-white font-medium">{selectedRequest.full_name || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500 text-xs">Email</Label>
                      <p className="text-white font-medium truncate">{selectedRequest.email || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500 text-xs">ID Type</Label>
                      <p className="text-white font-medium capitalize">{selectedRequest.id_type || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-slate-500 text-xs">ID Number</Label>
                      <p className="text-white font-mono">{selectedRequest.id_number || "N/A"}</p>
                    </div>
                  </div>
                </div>

                {/* Document Gallery - All 3 Documents */}
                <KYCDocumentGallery 
                  idDocumentUrl={selectedRequest.kyc_document_url}
                  passportUrl={selectedRequest.passport_url}
                  selfieUrl={selectedRequest.selfie_url}
                  className="flex-1 min-h-0"
                />

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                    onClick={() => setRejectionModalOpen(true)}
                    disabled={rejectKycMutation.isPending}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                  {isAdmin && (
                    <Button
                      className={cn(
                        "flex-1",
                        canApprove 
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "bg-slate-700 text-slate-400 cursor-not-allowed"
                      )}
                      onClick={handleApprove}
                      disabled={!canApprove || approveKycMutation.isPending}
                    >
                      {approveKycMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      {hasAllDocuments ? "Approve" : "Missing Documents"}
                    </Button>
                  )}
                </div>

                {!isAdmin && (
                  <p className="text-xs text-amber-400 text-center">
                    Staff can reject submissions. Final approval requires admin access.
                  </p>
                )}

                {isAdmin && !hasAllDocuments && (
                  <p className="text-xs text-red-400 text-center">
                    Approval requires all 3 documents: ID, Passport Photo, and Selfie
                  </p>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center bg-slate-950/50 border border-slate-800 rounded-lg">
                <FileCheck className="w-16 h-16 text-slate-700 mb-4" />
                <p className="text-slate-500">Select a request to review</p>
              </div>
            )}
          </div>
        </div>

        {/* Rejection Modal */}
        <RejectionModal
          open={rejectionModalOpen}
          onClose={() => setRejectionModalOpen(false)}
          onConfirm={handleReject}
          title="Reject KYC Verification"
          description="Please select a reason for rejecting this identity verification request."
          type="kyc"
          isPending={rejectKycMutation.isPending}
        />
      </div>
    </StaffLayout>
  );
};

export default StaffKYCQueue;
