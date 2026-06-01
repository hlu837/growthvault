import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Lock, Unlock, RefreshCcw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const AdminEscrow = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const { data: escrowOrders = [], isLoading } = useQuery({
    queryKey: ["admin-escrow"],
    queryFn: async () => {
      // Fetch orders that are in a state involving escrow (e.g. pending_delivery, inspection)
      // or that have a non-zero escrow hold amount.
      const { data, error } = await supabase
        .from("marketplace_orders")
        .select(`
          id,
          total_escrow_hold_amount,
          order_status,
          created_at,
          buyer_id,
          seller_id,
          is_escrow_paused
        `)
        .gt("total_escrow_hold_amount", 0)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: isAdmin
  });

  const releaseEscrow = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase.rpc('admin_release_escrow', {
        p_order_id: orderId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Escrow funds released manually");
      queryClient.invalidateQueries({ queryKey: ["admin-escrow"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to release escrow");
    }
  });

  const refundEscrow = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase.rpc('admin_refund_escrow', {
        p_order_id: orderId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Escrow funds refunded to buyer");
      queryClient.invalidateQueries({ queryKey: ["admin-escrow"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to refund escrow");
    }
  });

  const filteredOrders = escrowOrders.filter(order => 
    order.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Escrow Management</h1>
          <p className="text-muted-foreground mt-2">Manage funds held in escrow for active transactions</p>
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 pb-4">
            <CardTitle className="text-xl font-bold text-white">Escrowed Funds</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by Order ID..."
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
                    <th className="px-4 py-3 font-medium">Amount Held</th>
                    <th className="px-4 py-3 font-medium">Order Status</th>
                    <th className="px-4 py-3 font-medium">Escrow Status</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-500">Loading escrow records...</td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-500">No active escrow funds found</td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-medium text-white font-mono text-xs">
                          {order.id.substring(0, 8)}...
                        </td>
                        <td className="px-4 py-3 font-medium text-green-400">
                          ${Number(order.total_escrow_hold_amount).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-slate-300 capitalize">
                          {order.order_status.replace('_', ' ')}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={
                            order.is_escrow_paused ? "bg-red-500/10 text-red-400 border-red-500/30" :
                            "bg-blue-500/10 text-blue-400 border-blue-500/30"
                          }>
                            {order.is_escrow_paused ? "Paused (Dispute)" : "Held"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                              onClick={() => {
                                if(window.confirm('Are you sure you want to release these funds to the seller?')) {
                                  releaseEscrow.mutate(order.id);
                                }
                              }}
                              disabled={releaseEscrow.isPending || order.order_status === 'completed'}
                            >
                              <Unlock className="w-4 h-4 mr-1" /> Release
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                              onClick={() => {
                                if(window.confirm('Are you sure you want to refund these funds to the buyer?')) {
                                  refundEscrow.mutate(order.id);
                                }
                              }}
                              disabled={refundEscrow.isPending || order.order_status === 'refunded'}
                            >
                              <RefreshCcw className="w-4 h-4 mr-1" /> Refund
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

export default AdminEscrow;
