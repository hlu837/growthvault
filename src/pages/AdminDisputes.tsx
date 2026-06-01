import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ShieldAlert, Eye, RefreshCcw, Check } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const AdminDisputes = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: disputes = [], isLoading } = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_orders")
        .select(`
          id,
          dispute_complaint_type,
          dispute_description,
          dispute_opened_at,
          order_status,
          buyer_id,
          seller_id
        `)
        .eq("order_status", "disputed")
        .order("dispute_opened_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles
      const userIds = [...new Set(data.flatMap(d => [d.buyer_id, d.seller_id]).filter(Boolean))];
      let profiles: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);
          
        if (profileData) {
          profiles = profileData.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
        }
      }

      return data.map(dispute => ({
        ...dispute,
        buyer: profiles[dispute.buyer_id]?.full_name || profiles[dispute.buyer_id]?.email || "Unknown Buyer",
        seller: profiles[dispute.seller_id]?.full_name || profiles[dispute.seller_id]?.email || "Unknown Seller",
      }));
    },
    enabled: isAdmin
  });

  const resolveDispute = useMutation({
    mutationFn: async ({ orderId, action }: { orderId: string, action: 'refund_buyer' | 'pay_seller' }) => {
      // In a real implementation this would call a specific RPC
      // For now we'll simulate it by calling the escrow RPCs which we assumed earlier
      const rpcName = action === 'refund_buyer' ? 'admin_refund_escrow' : 'admin_release_escrow';
      const { error } = await supabase.rpc(rpcName, { p_order_id: orderId });
      if (error) throw error;
    },
    onSuccess: (_, { action }) => {
      toast.success(`Dispute resolved: ${action === 'refund_buyer' ? 'Buyer Refunded' : 'Seller Paid'}`);
      queryClient.invalidateQueries({ queryKey: ["admin-disputes"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to resolve dispute");
    }
  });

  const filteredDisputes = disputes.filter(dispute => 
    dispute.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dispute.buyer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dispute.seller.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Disputes Panel</h1>
          <p className="text-muted-foreground mt-2">Manage and resolve active marketplace disputes</p>
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 pb-4">
            <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              Active Disputes
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search disputes..."
                  className="pl-8 w-64 bg-slate-950 border-slate-800 text-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="rounded-md border border-slate-800 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-950 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Order ID</th>
                    <th className="px-4 py-3 font-medium">Buyer</th>
                    <th className="px-4 py-3 font-medium">Seller</th>
                    <th className="px-4 py-3 font-medium">Reason</th>
                    <th className="px-4 py-3 font-medium">Opened</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500">Loading disputes...</td>
                    </tr>
                  ) : filteredDisputes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500">No active disputes found</td>
                    </tr>
                  ) : (
                    filteredDisputes.map((dispute) => (
                      <tr key={dispute.id} className="hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-medium text-white font-mono text-xs">
                          {dispute.id.substring(0, 8)}...
                        </td>
                        <td className="px-4 py-3 text-slate-300">{dispute.buyer}</td>
                        <td className="px-4 py-3 text-slate-300">{dispute.seller}</td>
                        <td className="px-4 py-3 text-slate-300">
                          <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
                            {dispute.dispute_complaint_type || "Other"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {dispute.dispute_opened_at ? new Date(dispute.dispute_opened_at).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                              onClick={() => navigate(`/admin/disputes/${dispute.id}`)}
                            >
                              <Eye className="w-4 h-4 mr-1" /> Review
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                              onClick={() => {
                                if(window.confirm('Are you sure you want to resolve this by refunding the buyer?')) {
                                  resolveDispute.mutate({ orderId: dispute.id, action: 'refund_buyer' });
                                }
                              }}
                              disabled={resolveDispute.isPending}
                            >
                              <RefreshCcw className="w-4 h-4 mr-1" /> Refund Buyer
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                              onClick={() => {
                                if(window.confirm('Are you sure you want to resolve this by paying the seller?')) {
                                  resolveDispute.mutate({ orderId: dispute.id, action: 'pay_seller' });
                                }
                              }}
                              disabled={resolveDispute.isPending}
                            >
                              <Check className="w-4 h-4 mr-1" /> Pay Seller
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDisputes;
