import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, FileText, ArrowRightCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const AdminTransactions = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const { isAdmin } = useAuth();

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["admin-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_orders")
        .select(`
          id,
          total_price,
          order_status,
          created_at,
          buyer_id,
          product_id,
          seller_id
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // We need to fetch profiles manually since relations might not be fully typed or defined perfectly
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

      return data.map(order => ({
        ...order,
        buyer: profiles[order.buyer_id]?.full_name || profiles[order.buyer_id]?.email || "Unknown Buyer",
        seller: profiles[order.seller_id]?.full_name || profiles[order.seller_id]?.email || "Unknown Seller",
      }));
    },
    enabled: isAdmin
  });

  const filteredTransactions = transactions.filter(trx => 
    trx.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trx.buyer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trx.seller.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Transactions Panel</h1>
            <p className="text-muted-foreground mt-2">Manage marketplace transactions and commissions</p>
          </div>
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800 pb-4">
            <CardTitle className="text-xl font-bold text-white">Recent Transactions</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search transactions..."
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
                    <th className="px-4 py-3 font-medium">Transaction ID</th>
                    <th className="px-4 py-3 font-medium">Buyer</th>
                    <th className="px-4 py-3 font-medium">Seller</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500">Loading transactions...</td>
                    </tr>
                  ) : filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500">No transactions found</td>
                    </tr>
                  ) : (
                    filteredTransactions.map((trx) => (
                      <tr key={trx.id} className="hover:bg-slate-800/50">
                        <td className="px-4 py-3 font-medium text-white flex items-center gap-2 font-mono text-xs">
                          <FileText className="h-4 w-4 text-slate-500" />
                          {trx.id.substring(0, 8)}...
                        </td>
                        <td className="px-4 py-3 text-slate-300">{trx.buyer}</td>
                        <td className="px-4 py-3 text-slate-300">{trx.seller}</td>
                        <td className="px-4 py-3 font-medium text-green-400">${Number(trx.total_price).toLocaleString()}</td>
                        <td className="px-4 py-3 text-slate-400">{new Date(trx.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={
                            trx.order_status === "completed" ? "bg-green-500/10 text-green-400 border-green-500/30" : 
                            trx.order_status === "cancelled" || trx.order_status === "refunded" ? "bg-red-500/10 text-red-400 border-red-500/30" : 
                            "bg-blue-500/10 text-blue-400 border-blue-500/30"
                          }>
                            {trx.order_status.replace('_', ' ')}
                          </Badge>
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

export default AdminTransactions;
