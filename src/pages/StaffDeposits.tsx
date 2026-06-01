import { useState, useCallback } from "react";
import { 
  Shield, 
  Upload, 
  Search, 
  CheckCircle, 
  XCircle, 
  Image,
  ExternalLink,
  Clock,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const StaffDeposits = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "verified" | "rejected">("pending");
  const [selectedDeposit, setSelectedDeposit] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [loadingProof, setLoadingProof] = useState<string | null>(null);
  const { isAdmin, isStaff } = useAuth();
  const queryClient = useQueryClient();

  // View proof using signed URL (for private storage bucket)
  const viewProof = useCallback(async (filePath: string) => {
    if (!filePath) {
      toast.error("No proof file available");
      return;
    }

    setLoadingProof(filePath);
    try {
      const { data, error } = await supabase.storage
        .from("deposit-proofs")
        .createSignedUrl(filePath, 7200); // 2 hours expiry

      if (error) throw error;

      window.open(data.signedUrl, '_blank');
    } catch (error: any) {
      console.error("Failed to generate signed URL:", error);
      toast.error("Failed to load proof document");
    } finally {
      setLoadingProof(null);
    }
  }, []);

  // Fetch deposits
  const { data: deposits, isLoading } = useQuery({
    queryKey: ["staff-deposits", filter],
    queryFn: async () => {
      let query = supabase
        .from("deposits")
        .select(`
          *,
          profiles:user_id (full_name, email)
        `)
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: isAdmin || isStaff,
  });

  // Verify deposit and credit user account using secure RPC
  const verifyDeposit = useMutation({
    mutationFn: async (depositId: string) => {
      const { data, error } = await supabase.rpc("approve_deposit_and_credit", {
        p_deposit_id: depositId,
        p_tier: "starter" // Default tier - could be made selectable in UI
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-deposits"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Deposit verified and funds credited to user account");
      setSelectedDeposit(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to verify deposit");
    },
  });

  // Reject deposit
  const rejectDeposit = useMutation({
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
      queryClient.invalidateQueries({ queryKey: ["staff-deposits"] });
      toast.success("Deposit rejected");
      setSelectedDeposit(null);
      setRejectReason("");
    },
    onError: () => {
      toast.error("Failed to reject deposit");
    },
  });

  const filteredDeposits = deposits?.filter((d: any) => {
    const matchesSearch = 
      d.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.bank_reference?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  }) || [];

  const stats = {
    pending: deposits?.filter((d: any) => d.status === "pending").length || 0,
    verified: deposits?.filter((d: any) => d.status === "verified").length || 0,
    rejected: deposits?.filter((d: any) => d.status === "rejected").length || 0,
  };

  if (!isAdmin && !isStaff) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <img src="/logo.png" alt="GWA Logo" className="w-16 h-16 mb-4 rounded-lg shadow-md" />
          <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Shield className="w-4 h-4" />
            Staff Panel
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Deposit Verification
          </h1>
          <p className="text-muted-foreground mt-1">
            Verify user deposit proofs and bank transfers.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => setFilter("pending")}
            className={`p-4 rounded-md border text-left transition-all ${
              filter === "pending" ? "border-warning bg-warning/10" : "border-border bg-card hover:border-muted-foreground/50"
            }`}
          >
            <div className="text-2xl font-bold font-mono text-warning">{stats.pending}</div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </button>
          <button
            onClick={() => setFilter("verified")}
            className={`p-4 rounded-md border text-left transition-all ${
              filter === "verified" ? "border-accent bg-accent/10" : "border-border bg-card hover:border-muted-foreground/50"
            }`}
          >
            <div className="text-2xl font-bold font-mono text-accent">{stats.verified}</div>
            <div className="text-sm text-muted-foreground">Verified</div>
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
            placeholder="Search by name, email, or reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>

        {/* Deposits List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-secondary/30 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filteredDeposits.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground">No deposits found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredDeposits.map((deposit: any) => (
              <Card key={deposit.id} className="hover:border-muted-foreground/50 transition-colors">
                <CardContent className="py-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{deposit.profiles?.full_name || "Unknown"}</span>
                        <Badge 
                          variant="outline" 
                          className={
                            deposit.status === "pending" 
                              ? "bg-warning/10 text-warning border-warning/30"
                              : deposit.status === "verified"
                              ? "bg-accent/10 text-accent border-accent/30"
                              : "bg-destructive/10 text-destructive border-destructive/30"
                          }
                        >
                          {deposit.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{deposit.profiles?.email}</p>
                      {deposit.bank_reference && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Ref: <code className="bg-secondary px-1 rounded">{deposit.bank_reference}</code>
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold font-mono">${Number(deposit.amount).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(deposit.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {deposit.proof_url && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => viewProof(deposit.proof_url)}
                          disabled={loadingProof === deposit.proof_url}
                        >
                          {loadingProof === deposit.proof_url ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Image className="w-4 h-4 mr-1" />
                          )}
                          View Proof
                        </Button>
                      )}
                      {deposit.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            className="bg-accent hover:bg-accent/90"
                            onClick={() => verifyDeposit.mutate(deposit.id)}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Verify
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive/30"
                            onClick={() => setSelectedDeposit(deposit)}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Reject Dialog */}
        <Dialog open={!!selectedDeposit} onOpenChange={() => setSelectedDeposit(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Deposit</DialogTitle>
              <DialogDescription>
                Please provide a reason for rejecting this deposit.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Textarea
                placeholder="Enter rejection reason..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setSelectedDeposit(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => rejectDeposit.mutate({ id: selectedDeposit.id, reason: rejectReason })}
                  disabled={!rejectReason.trim()}
                >
                  Confirm Rejection
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default StaffDeposits;
