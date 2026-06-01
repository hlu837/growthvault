import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, User, DollarSign, MessageSquare, Scale, Clock, ExternalLink } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminDisputeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [resolutionNote, setResolutionNote] = useState("");

  const { data: dispute, isLoading } = useQuery({
    queryKey: ["admin-dispute-detail", id],
    queryFn: async () => {
      if (!id) throw new Error("No ID provided");

      const { data, error } = await supabase
        .from("marketplace_orders")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      // Fetch buyer and seller profiles
      const userIds = [data.buyer_id, data.seller_id].filter(Boolean);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      const profileMap = (profiles || []).reduce((acc: Record<string, any>, p) => ({ ...acc, [p.id]: p }), {});

      return {
        ...data,
        buyer: profileMap[data.buyer_id] || { full_name: "Unknown Buyer", email: "" },
        seller: profileMap[data.seller_id] || { full_name: "Unknown Seller", email: "" },
      };
    },
    enabled: !!id
  });

  const resolveDispute = useMutation({
    mutationFn: async (action: "refund_buyer" | "pay_seller") => {
      const rpcName = action === "refund_buyer" ? "admin_refund_escrow" : "admin_release_escrow";
      const { error } = await supabase.rpc(rpcName, { p_order_id: id });
      if (error) throw error;

      // Optionally save the resolution note
      if (resolutionNote) {
        await supabase
          .from("marketplace_orders")
          .update({ dispute_resolution_notes: resolutionNote, dispute_resolved_at: new Date().toISOString() })
          .eq("id", id);
      }
    },
    onSuccess: (_, action) => {
      toast.success(`Dispute resolved: ${action === "refund_buyer" ? "Buyer refunded" : "Seller paid"}`);
      queryClient.invalidateQueries({ queryKey: ["admin-disputes"] });
      navigate("/admin/disputes");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to resolve dispute");
    }
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="h-8 w-64 bg-slate-800 animate-pulse rounded" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-slate-900 animate-pulse rounded-lg" />
            <div className="h-64 bg-slate-900 animate-pulse rounded-lg" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!dispute) {
    return (
      <AdminLayout>
        <div className="text-center py-16">
          <Scale className="w-12 h-12 mx-auto text-slate-600 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Dispute Not Found</h2>
          <p className="text-slate-400 mb-6">The dispute you're looking for doesn't exist or is not in a disputed state.</p>
          <Button onClick={() => navigate("/admin/disputes")} variant="outline" className="border-slate-700 text-slate-300">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Disputes
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/disputes")} className="text-slate-400 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground">Dispute Review</h1>
              <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
                {dispute.order_status}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 font-mono text-sm">Order: {dispute.id}</p>
          </div>
        </div>

        {/* Parties Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Buyer Panel */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="border-b border-slate-800 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-blue-400" />
                Buyer (Complainant)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div>
                <p className="text-sm text-slate-400">Name</p>
                <p className="font-medium text-white">{dispute.buyer.full_name}</p>
                <p className="text-sm text-slate-500">{dispute.buyer.email}</p>
              </div>
              <Separator className="bg-slate-800" />
              <div>
                <p className="text-sm text-slate-400 mb-2 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Complaint Type
                </p>
                <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
                  {dispute.dispute_complaint_type || "Not specified"}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-2">Description</p>
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-slate-300 text-sm">
                  {dispute.dispute_description || "No description provided."}
                </div>
              </div>
              {dispute.dispute_evidence_url && (
                <div>
                  <p className="text-sm text-slate-400 mb-2">Evidence</p>
                  <a
                    href={dispute.dispute_evidence_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" /> View Evidence
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Seller Panel */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="border-b border-slate-800 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-green-400" />
                Seller (Respondent)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div>
                <p className="text-sm text-slate-400">Name</p>
                <p className="font-medium text-white">{dispute.seller.full_name}</p>
                <p className="text-sm text-slate-500">{dispute.seller.email}</p>
              </div>
              <Separator className="bg-slate-800" />
              <div>
                <p className="text-sm text-slate-400 mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Dispute Opened
                </p>
                <p className="text-slate-300">
                  {dispute.dispute_opened_at ? new Date(dispute.dispute_opened_at).toLocaleString() : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-2">Preferred Resolution</p>
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-slate-300 text-sm">
                  {(dispute as any).dispute_preferred_resolution || "Not specified"}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transaction Details + Decision Panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="border-b border-slate-800 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-400" />
                Transaction Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Escrow Hold:</span>
                <span className="text-green-400 font-bold">${Number(dispute.total_escrow_hold_amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Escrow Paused:</span>
                <Badge variant="outline" className={dispute.is_escrow_paused ? "bg-red-500/10 text-red-400 border-red-500/30" : "bg-green-500/10 text-green-400 border-green-500/30"}>
                  {dispute.is_escrow_paused ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Order Status:</span>
                <span className="text-white capitalize">{dispute.order_status?.replace(/_/g, " ")}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800 md:col-span-2">
            <CardHeader className="border-b border-slate-800 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Scale className="h-5 w-5 text-red-400" />
                Admin Decision Panel
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label className="text-slate-300 text-sm">Resolution Notes (optional)</Label>
                <Textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Enter your resolution notes before making a decision..."
                  className="mt-1 bg-slate-950 border-slate-800 text-slate-300 placeholder:text-slate-600"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => {
                    if (window.confirm("Refund the buyer and close this dispute?")) {
                      resolveDispute.mutate("refund_buyer");
                    }
                  }}
                  disabled={resolveDispute.isPending}
                >
                  Refund Buyer
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    if (window.confirm("Pay the seller and close this dispute?")) {
                      resolveDispute.mutate("pay_seller");
                    }
                  }}
                  disabled={resolveDispute.isPending}
                >
                  Pay Seller
                </Button>
                <Button
                  variant="outline"
                  className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                  onClick={() => toast.info("Split funds feature requires custom RPC implementation")}
                >
                  Split Funds
                </Button>
                <Button
                  variant="outline"
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                  onClick={() => toast.info("Request info feature coming soon")}
                >
                  Request Info
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                ⚠️ Decisions are final and will immediately trigger fund transfers from the escrow account.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDisputeDetail;
