import { useState } from "react";
import {
  Shield,
  AlertTriangle,
  RefreshCw,
  Eye,
  Ban,
  UserX,
  UserCheck,
  Search,
  Activity,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FraudFlag {
  indicator: string;
  score: number;
  details: string;
}

const INDICATOR_LABELS: Record<string, { label: string; icon: string }> = {
  referral_burst: { label: "Referral Burst (24h)", icon: "⚡" },
  extreme_referral_burst: { label: "Extreme Burst (1h)", icon: "🔴" },
  inactive_referrals: { label: "Inactive Referrals", icon: "👻" },
  shared_bank_details: { label: "Shared Bank Details", icon: "🏦" },
  high_referral_low_activity: { label: "High Refs, Low Activity", icon: "📉" },
  loan_gaming: { label: "Loan Gaming", icon: "🎰" },
  new_account_rapid_referrals: { label: "New Account Burst", icon: "🆕" },
};

const getRiskLevel = (score: number) => {
  if (score >= 70) return { label: "CRITICAL", color: "bg-red-500/20 text-red-400 border-red-500/40" };
  if (score >= 50) return { label: "HIGH", color: "bg-orange-500/20 text-orange-400 border-orange-500/40" };
  if (score >= 30) return { label: "MEDIUM", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40" };
  return { label: "LOW", color: "bg-blue-500/20 text-blue-400 border-blue-500/40" };
};

const AdminFraud = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [reviewDialog, setReviewDialog] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  // Fetch fraud flags with user profiles
  const { data: fraudFlags, isLoading } = useQuery({
    queryKey: ["fraud-flags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fraud_flags")
        .select("*")
        .order("risk_score", { ascending: false });

      if (error) throw error;

      // Fetch associated profiles
      const userIds = data.map((f: any) => f.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, account_status, kyc_status")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      return data.map((flag: any) => ({
        ...flag,
        profile: profileMap.get(flag.user_id) || null,
        flags: flag.flags as FraudFlag[],
      }));
    },
    enabled: isAdmin,
  });

  // Fetch flagged messages with sender profiles
  const { data: flaggedMessages, isLoading: messagesLoading } = useQuery({
    queryKey: ["flagged-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_messages")
        .select(`
          *,
          sender:profiles!sender_id (id, full_name, email, account_status, risk_score)
        `)
        .eq("is_flagged", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Run fraud scan
  const runScan = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("detect-fraud", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["fraud-flags"] });
      toast.success(
        `Scan complete: ${data.scanned} users scanned, ${data.flagged} flagged, ${data.auto_suspended} auto-suspended`
      );
    },
    onError: (error: any) => {
      toast.error(error.message || "Scan failed");
    },
  });

  // Update account status
  const updateStatus = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: "active" | "suspended" | "blacklisted" | "under_review" }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ account_status: status })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fraud-flags"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Account status updated");
    },
  });

  // Mark as reviewed
  const markReviewed = useMutation({
    mutationFn: async ({ flagId, notes }: { flagId: string; notes: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("fraud_flags")
        .update({
          status: "reviewed",
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes,
        })
        .eq("id", flagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fraud-flags"] });
      toast.success("Flag marked as reviewed");
      setReviewDialog(false);
      setReviewNotes("");
    },
  });

  // Dismiss flag
  const dismissFlag = useMutation({
    mutationFn: async (flagId: string) => {
      const { error } = await supabase.from("fraud_flags").delete().eq("id", flagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fraud-flags"] });
      toast.success("Flag dismissed");
    },
  });

  const filtered = fraudFlags?.filter((f: any) => {
    const name = f.profile?.full_name || "";
    const email = f.profile?.email || "";
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }) || [];

  const stats = {
    total: fraudFlags?.length || 0,
    critical: fraudFlags?.filter((f: any) => f.risk_score >= 70).length || 0,
    high: fraudFlags?.filter((f: any) => f.risk_score >= 50 && f.risk_score < 70).length || 0,
    monitoring: fraudFlags?.filter((f: any) => f.risk_score < 50).length || 0,
  };

  if (!isAdmin) {
    return (
      <AdminLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <Shield className="w-8 h-8 text-destructive mb-4" />
          <h1 className="text-2xl font-bold text-white">Admin Access Only</h1>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 font-mono">
              <Activity className="w-3 h-3" />
              FRAUD DETECTION ENGINE
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Risk Monitor
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Automated fraud scoring. Accounts ≥70 are auto-suspended, ≥50 are flagged for review.
            </p>
          </div>
          <Button
            onClick={() => runScan.mutate()}
            disabled={runScan.isPending}
            className="bg-red-600 hover:bg-red-700 gap-2"
          >
            {runScan.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {runScan.isPending ? "Scanning..." : "Run Fraud Scan"}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/50">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-2xl font-bold font-mono text-white">{stats.total}</p>
                <p className="text-xs text-slate-400">Total Flagged</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-lg border border-red-900/50 bg-red-950/20">
            <div className="flex items-center gap-3">
              <Ban className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-2xl font-bold font-mono text-red-400">{stats.critical}</p>
                <p className="text-xs text-slate-400">Critical (70+)</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-lg border border-orange-900/50 bg-orange-950/20">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              <div>
                <p className="text-2xl font-bold font-mono text-orange-400">{stats.high}</p>
                <p className="text-xs text-slate-400">High (50-69)</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-lg border border-blue-900/50 bg-blue-950/20">
            <div className="flex items-center gap-3">
              <Eye className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-2xl font-bold font-mono text-blue-400">{stats.monitoring}</p>
                <p className="text-xs text-slate-400">Monitoring</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search flagged accounts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-800 text-white placeholder:text-slate-500"
          />
        </div>

        {/* Flagged Accounts */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-slate-900/50 animate-pulse rounded-lg border border-slate-800" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 rounded-lg border border-slate-800 bg-slate-900/50">
            <Shield className="w-12 h-12 text-emerald-500/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">All Clear</h3>
            <p className="text-slate-500 text-sm">
              No fraud flags detected. Run a scan to check for suspicious activity.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((flag: any) => {
              const risk = getRiskLevel(flag.risk_score);
              return (
                <div
                  key={flag.id}
                  className="rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden"
                >
                  {/* Header */}
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center">
                        <span className="text-lg font-bold font-mono text-white">
                          {flag.risk_score}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">
                            {flag.profile?.full_name || "Unknown User"}
                          </span>
                          <Badge variant="outline" className={risk.color}>
                            {risk.label}
                          </Badge>
                          {flag.auto_action_taken && (
                            <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
                              {flag.auto_action_taken === "auto_suspended" ? "AUTO-SUSPENDED" : "AUTO-FLAGGED"}
                            </Badge>
                          )}
                          {flag.status === "reviewed" && (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                              REVIEWED
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm text-slate-500">
                          {flag.profile?.email} · Status: {flag.profile?.account_status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {flag.profile?.account_status === "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                          onClick={() => updateStatus.mutate({ userId: flag.user_id, status: "suspended" })}
                        >
                          <Ban className="w-3 h-3 mr-1" />
                          Suspend
                        </Button>
                      )}
                      {flag.profile?.account_status !== "blacklisted" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                          onClick={() => updateStatus.mutate({ userId: flag.user_id, status: "blacklisted" })}
                        >
                          <UserX className="w-3 h-3 mr-1" />
                          Blacklist
                        </Button>
                      )}
                      {flag.profile?.account_status !== "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                          onClick={() => updateStatus.mutate({ userId: flag.user_id, status: "active" })}
                        >
                          <UserCheck className="w-3 h-3 mr-1" />
                          Reactivate
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-slate-700 text-slate-400 hover:text-white"
                        onClick={() => {
                          setSelectedFlag(flag);
                          setReviewDialog(true);
                        }}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Review
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-slate-500 hover:text-slate-300"
                        onClick={() => dismissFlag.mutate(flag.id)}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>

                  {/* Flags Detail */}
                  <div className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {(flag.flags as FraudFlag[]).map((f: FraudFlag, i: number) => {
                        const meta = INDICATOR_LABELS[f.indicator] || { label: f.indicator, icon: "⚠️" };
                        return (
                          <div
                            key={i}
                            className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-slate-300">
                                {meta.icon} {meta.label}
                              </span>
                              <span className="text-xs font-mono text-red-400">+{f.score}</span>
                            </div>
                            <p className="text-xs text-slate-500">{f.details}</p>
                          </div>
                        );
                      })}
                    </div>
                    {flag.review_notes && (
                      <div className="mt-3 p-3 rounded bg-slate-800/30 border border-slate-700/30">
                        <p className="text-xs text-slate-400">
                          <span className="font-medium text-slate-300">Review Notes:</span>{" "}
                          {flag.review_notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Flagged Messages */}
        <div className="mt-8">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Flagged Messages
          </h2>

          {messagesLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 bg-slate-900/50 animate-pulse rounded-lg border border-slate-800" />
              ))}
            </div>
          ) : !flaggedMessages || flaggedMessages.length === 0 ? (
            <div className="text-center py-8 rounded-lg border border-slate-800 bg-slate-900/50">
              <Shield className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No flagged messages found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {flaggedMessages.map((message: any) => (
                <div
                  key={message.id}
                  className="rounded-lg border border-slate-800 bg-slate-900/50 p-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-white">
                          {message.sender?.full_name || "Unknown Sender"}
                        </span>
                        <span className="text-sm text-slate-500">
                          Risk Score: {message.sender?.risk_score || 0}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 bg-slate-800/50 p-2 rounded border border-slate-700/50">
                        {message.content}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(message.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {message.sender?.account_status === "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                          onClick={() => updateStatus.mutate({ userId: message.sender_id, status: "suspended" })}
                          disabled={updateStatus.isPending}
                        >
                          <Ban className="w-3 h-3 mr-1" />
                          Suspend User
                        </Button>
                      )}
                      {message.sender?.account_status === "suspended" && (
                        <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
                          Suspended
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Review Dialog */}
        <Dialog open={reviewDialog} onOpenChange={setReviewDialog}>
          <DialogContent className="bg-slate-900 border-slate-800">
            <DialogHeader>
              <DialogTitle className="text-white">Review Flag</DialogTitle>
              <DialogDescription className="text-slate-400">
                Add notes about your review of {selectedFlag?.profile?.full_name || "this user"}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {selectedFlag && (
                <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">
                      Risk Score: {selectedFlag.risk_score}
                    </span>
                    <Badge
                      variant="outline"
                      className={getRiskLevel(selectedFlag.risk_score).color}
                    >
                      {getRiskLevel(selectedFlag.risk_score).label}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {(selectedFlag.flags as FraudFlag[]).map((f: FraudFlag, i: number) => (
                      <p key={i} className="text-xs text-slate-400">
                        • {INDICATOR_LABELS[f.indicator]?.icon || "⚠️"} {f.details} (+{f.score})
                      </p>
                    ))}
                  </div>
                </div>
              )}
              <Textarea
                placeholder="Enter your review notes..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white min-h-[100px]"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setReviewDialog(false)}
                className="border-slate-700 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  selectedFlag &&
                  markReviewed.mutate({ flagId: selectedFlag.id, notes: reviewNotes })
                }
                disabled={!reviewNotes.trim() || markReviewed.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {markReviewed.isPending ? "Saving..." : "Mark Reviewed"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Risk Score Guide */}
        <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
          <h3 className="text-sm font-bold text-slate-300 mb-3">Risk Scoring Guide</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="space-y-2">
              <p className="text-slate-400 font-medium">Indicators & Scores</p>
              <p className="text-slate-500">⚡ Referral Burst (24h): <span className="text-red-400">+20</span></p>
              <p className="text-slate-500">🔴 Extreme Burst (1h): <span className="text-red-400">+30</span></p>
              <p className="text-slate-500">👻 Inactive Referrals: <span className="text-red-400">+15</span></p>
              <p className="text-slate-500">🏦 Shared Bank Details: <span className="text-red-400">+25</span></p>
              <p className="text-slate-500">📉 High Refs, Low Activity: <span className="text-red-400">+20</span></p>
              <p className="text-slate-500">🎰 Loan Gaming: <span className="text-red-400">+25</span></p>
              <p className="text-slate-500">🆕 New Account Burst: <span className="text-red-400">+15</span></p>
            </div>
            <div className="space-y-2">
              <p className="text-slate-400 font-medium">Action Thresholds</p>
              <p className="text-blue-400">0–29 → Monitor</p>
              <p className="text-yellow-400">30–49 → Medium Risk</p>
              <p className="text-orange-400">50–69 → High Risk → Auto Under Review</p>
              <p className="text-red-400">70+ → Critical → Auto Suspended</p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminFraud;
