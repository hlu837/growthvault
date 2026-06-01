import { useState } from "react";
import { Shield, FileText, Users, Search, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import DashboardLayout from "@/components/DashboardLayout";
import KYCDocumentGallery from "@/components/staff/KYCDocumentGallery";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminKYC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "recommended_approve" | "recommended_reject" | "approved" | "rejected">("all");
  const [selectedKycRequest, setSelectedKycRequest] = useState<any | null>(null);
  const { role, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  // Fetch only recommended + completed KYC items (admin sees staff recommendations)
  const { data: kycRequests, isLoading } = useQuery({
    queryKey: ["admin-kyc"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .in("kyc_status", ["recommended_approve", "recommended_reject", "approved", "rejected"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
    refetchInterval: 30000,
  });

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
      queryClient.invalidateQueries({ queryKey: ['admin-kyc'] });
      toast.success('KYC approved successfully');
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
      queryClient.invalidateQueries({ queryKey: ['admin-kyc'] });
      toast.success('KYC rejected');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reject KYC');
    }
  });

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <img src="/logo.png" alt="GWA Logo" className="w-16 h-16 mb-4 rounded-lg shadow-md" />
          <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground">Admin access required.</p>
        </div>
      </DashboardLayout>
    );
  }

  const filteredRequests = kycRequests?.filter((req) => {
    const matchesSearch = 
      req.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filter === "all" || req.kyc_status === filter;
    
    return matchesSearch && matchesFilter;
  }) || [];

  const stats = {
    recommendApprove: kycRequests?.filter(r => r.kyc_status === "recommended_approve").length || 0,
    recommendReject: kycRequests?.filter(r => r.kyc_status === "recommended_reject").length || 0,
    approved: kycRequests?.filter(r => r.kyc_status === "approved").length || 0,
    rejected: kycRequests?.filter(r => r.kyc_status === "rejected").length || 0,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "recommended_approve":
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1">
            <ThumbsUp className="w-3 h-3" />
            Staff: Approve
          </Badge>
        );
      case "recommended_reject":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 gap-1">
            <ThumbsDown className="w-3 h-3" />
            Staff: Reject
          </Badge>
        );
      case "approved":
        return <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">Approved</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const needsAction = (status: string) => 
    status === "recommended_approve" || status === "recommended_reject";

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Shield className="w-4 h-4" />
              Admin Panel
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              KYC Verification
            </h1>
            <p className="text-muted-foreground mt-1">
              Review staff recommendations and make final decisions.
            </p>
          </div>
          <Badge variant="outline" className="gap-1">
            <Users className="w-3 h-3" />
            {role ? role.charAt(0).toUpperCase() + role.slice(1) : "Admin"}
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => setFilter("recommended_approve")}
            className={`p-4 rounded-md border text-left transition-all ${
              filter === "recommended_approve" ? "border-emerald-500 bg-emerald-500/10" : "border-border bg-card hover:border-muted-foreground/50"
            }`}
          >
            <div className="text-2xl font-bold font-mono text-emerald-400">{stats.recommendApprove}</div>
            <div className="text-sm text-muted-foreground">Recommend Approve</div>
          </button>
          <button
            onClick={() => setFilter("recommended_reject")}
            className={`p-4 rounded-md border text-left transition-all ${
              filter === "recommended_reject" ? "border-red-500 bg-red-500/10" : "border-border bg-card hover:border-muted-foreground/50"
            }`}
          >
            <div className="text-2xl font-bold font-mono text-red-400">{stats.recommendReject}</div>
            <div className="text-sm text-muted-foreground">Recommend Reject</div>
          </button>
          <button
            onClick={() => setFilter("approved")}
            className={`p-4 rounded-md border text-left transition-all ${
              filter === "approved" ? "border-accent bg-accent/10" : "border-border bg-card hover:border-muted-foreground/50"
            }`}
          >
            <div className="text-2xl font-bold font-mono text-accent">{stats.approved}</div>
            <div className="text-sm text-muted-foreground">Approved</div>
          </button>
          <button
            onClick={() => setFilter("rejected")}
            className={`p-4 rounded-md border text-left transition-all ${
              filter === "rejected" ? "border-destructive bg-destructive/10" : "border-border bg-card hover:border-muted-foreground/50"
            }`}
          >
            <div className="text-2xl font-bold font-mono text-destructive">{stats.rejected}</div>
            <div className="text-sm text-muted-foreground">Rejected</div>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>

        {/* KYC Table */}
        <div className="rounded-md border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/50 border-b border-border">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Member</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground hidden md:table-cell">Referral Code</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground hidden sm:table-cell">Tier</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Staff Recommendation</th>
                  <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="p-4">
                        <div className="h-12 bg-secondary/30 animate-pulse rounded" />
                      </td>
                    </tr>
                  ))
                ) : filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center">
                      <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                      <p className="text-muted-foreground">No recommendations from staff yet</p>
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="p-4">
                        <div className="font-medium">{request.full_name || "Unknown"}</div>
                        <div className="text-sm text-muted-foreground">{request.email}</div>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <code className="text-xs font-mono bg-secondary px-2 py-1 rounded">
                          {request.referral_code}
                        </code>
                      </td>
                      <td className="p-4 hidden sm:table-cell text-sm capitalize">
                        {request.investment_tier}
                      </td>
                      <td className="p-4">
                        {getStatusBadge(request.kyc_status || "pending")}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-white"
                            onClick={() => setSelectedKycRequest(request)}
                          >
                            View Docs
                          </Button>
                          {needsAction(request.kyc_status) && (
                            <>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-accent border-accent/30 hover:bg-accent/10"
                                onClick={() => approveKycMutation.mutate(request.id)}
                                disabled={approveKycMutation.isPending}
                              >
                                Approve
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={() => rejectKycMutation.mutate({ userId: request.id, reason: "Rejected by admin" })}
                                disabled={rejectKycMutation.isPending}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {!needsAction(request.kyc_status) && (
                            <span className="text-xs text-muted-foreground">Completed</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <Dialog open={Boolean(selectedKycRequest)} onOpenChange={(open) => { if (!open) setSelectedKycRequest(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              KYC Documents for {selectedKycRequest?.full_name || "User"}
            </DialogTitle>
            <DialogDescription>
              {selectedKycRequest?.email}
            </DialogDescription>
          </DialogHeader>

          {selectedKycRequest ? (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">ID Type</p>
                  <p className="text-sm font-medium">{selectedKycRequest.id_type || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">ID Number</p>
                  <p className="text-sm font-medium">{selectedKycRequest.id_number || "N/A"}</p>
                </div>
              </div>
              <KYCDocumentGallery
                idDocumentUrl={selectedKycRequest.kyc_document_url}
                passportUrl={selectedKycRequest.passport_url}
                selfieUrl={selectedKycRequest.selfie_url}
                className="rounded-xl border border-border"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminKYC;
