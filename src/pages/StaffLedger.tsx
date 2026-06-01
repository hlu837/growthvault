import { Shield, Users, Wallet, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const StaffLedger = () => {
  const { isAdmin, isStaff } = useAuth();

  // Fetch view-only ledger data
  const { data: ledgerData, isLoading } = useQuery({
    queryKey: ["staff-ledger"],
    queryFn: async () => {
      const [profiles, wallets, transactions] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, investment_tier, is_frozen"),
        supabase.from("wallets").select("user_id, wallet_type, balance"),
        supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(20),
      ]);

      // Group wallets by user
      const userBalances = profiles.data?.map((profile) => {
        const userWallets = wallets.data?.filter(w => w.user_id === profile.id) || [];
        const totalBalance = userWallets.reduce((sum, w) => sum + (Number(w.balance) || 0), 0);
        return {
          ...profile,
          totalBalance,
          wallets: userWallets,
        };
      }) || [];

      return {
        users: userBalances,
        recentTransactions: transactions.data || [],
        totalUsers: profiles.data?.length || 0,
        activeUsers: profiles.data?.filter(p => !p.is_frozen).length || 0,
      };
    },
    enabled: isAdmin || isStaff,
  });

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
            User Ledger
          </h1>
          <p className="text-muted-foreground mt-1">
            View-only access to user balances and transactions.
          </p>
        </div>

        {/* Notice */}
        <div className="p-4 rounded-lg border border-warning/30 bg-warning/5">
          <p className="text-sm text-warning">
            <strong>View Only:</strong> Staff members cannot modify balances or approve withdrawals.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold font-mono">{ledgerData?.totalUsers || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold font-mono">{ledgerData?.activeUsers || 0}</p>
                  <p className="text-sm text-muted-foreground">Active Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-secondary/30 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            {/* Users Table */}
            <Card>
              <CardHeader>
                <CardTitle>User Balances</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-border">
                      <tr>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">User</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Tier</th>
                        <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                        <th className="text-right p-3 text-sm font-medium text-muted-foreground">Total Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {ledgerData?.users.map((user: any) => (
                        <tr key={user.id} className="hover:bg-secondary/20">
                          <td className="p-3">
                            <div className="font-medium">{user.full_name || "Unknown"}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </td>
                          <td className="p-3 capitalize">{user.investment_tier}</td>
                          <td className="p-3">
                            <Badge 
                              variant="outline" 
                              className={user.is_frozen 
                                ? "bg-destructive/10 text-destructive" 
                                : "bg-accent/10 text-accent"
                              }
                            >
                              {user.is_frozen ? "Frozen" : "Active"}
                            </Badge>
                          </td>
                          <td className="p-3 text-right font-mono font-medium">
                            ${user.totalBalance.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {ledgerData?.recentTransactions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No transactions yet</p>
                  ) : (
                    ledgerData?.recentTransactions.map((tx: any) => (
                      <div 
                        key={tx.id} 
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/20"
                      >
                        <div>
                          <Badge variant="outline" className="capitalize text-xs">
                            {tx.transaction_type}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(tx.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="font-mono font-medium">
                          ${Number(tx.amount).toLocaleString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default StaffLedger;
