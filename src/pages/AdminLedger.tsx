import { Shield, DollarSign, ArrowUpRight, ArrowDownRight, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const AdminLedger = () => {
  const { isAdmin } = useAuth();

  // Fetch complete ledger data
  const { data: ledgerData, isLoading } = useQuery({
    queryKey: ["admin-ledger"],
    queryFn: async () => {
      const [wallets, transactions, withdrawals, deposits] = await Promise.all([
        supabase.from("wallets").select("*"),
        supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("withdrawals").select("*"),
        supabase.from("deposits").select("*"),
      ]);

      // Calculate wallet totals by type
      const walletTotals: Record<string, number> = {};
      wallets.data?.forEach((w) => {
        walletTotals[w.wallet_type] = (walletTotals[w.wallet_type] || 0) + (Number(w.balance) || 0);
      });

      // Calculate transaction totals by type
      const transactionTotals: Record<string, number> = {};
      transactions.data?.forEach((t) => {
        transactionTotals[t.transaction_type] = (transactionTotals[t.transaction_type] || 0) + (Number(t.amount) || 0);
      });

      // Calculate withdrawal stats
      const withdrawalStats = {
        pending: withdrawals.data?.filter(w => w.status === "pending").reduce((sum, w) => sum + Number(w.amount), 0) || 0,
        approved: withdrawals.data?.filter(w => w.status === "approved").reduce((sum, w) => sum + Number(w.amount), 0) || 0,
        processed: withdrawals.data?.filter(w => w.status === "processed").reduce((sum, w) => sum + Number(w.amount), 0) || 0,
      };

      // Calculate deposit stats
      const depositStats = {
        pending: deposits.data?.filter(d => d.status === "pending").reduce((sum, d) => sum + Number(d.amount), 0) || 0,
        verified: deposits.data?.filter(d => d.status === "verified").reduce((sum, d) => sum + Number(d.amount), 0) || 0,
      };

      return {
        walletTotals,
        transactionTotals,
        withdrawalStats,
        depositStats,
        recentTransactions: transactions.data || [],
        totalPlatformBalance: Object.values(walletTotals).reduce((sum, v) => sum + v, 0),
      };
    },
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Admin Access Only</h1>
          <p className="text-muted-foreground text-center max-w-md">
            This page is restricted to administrators only.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const walletLabels: Record<string, string> = {
    savings: "Savings",
    mlm_capital: "MLM Capital",
    trading_principal: "Investment Principal",
    mlm_bonus: "MLM Bonus",
    loan: "Loan",
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Shield className="w-4 h-4" />
            Admin Panel
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Platform Ledger
          </h1>
          <p className="text-muted-foreground mt-1">
            Complete financial overview of the platform.
          </p>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-32 bg-secondary/30 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            {/* Total Platform Balance */}
            <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Platform Balance</p>
                    <p className="text-4xl font-bold font-mono mt-2">
                      ${(ledgerData?.totalPlatformBalance || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <DollarSign className="w-8 h-8 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Wallet Breakdown */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Wallet Breakdown</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(ledgerData?.walletTotals || {}).map(([type, amount]) => (
                  <Card key={type}>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                          <Wallet className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">{walletLabels[type] || type}</p>
                          <p className="text-xl font-bold font-mono">${amount.toLocaleString()}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Transaction & Flow Summary */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Deposits */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowDownRight className="w-5 h-5 text-accent" />
                    Deposits
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Pending Verification</span>
                    <span className="font-mono font-medium text-warning">
                      ${(ledgerData?.depositStats.pending || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Verified</span>
                    <span className="font-mono font-medium text-accent">
                      ${(ledgerData?.depositStats.verified || 0).toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Withdrawals */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowUpRight className="w-5 h-5 text-destructive" />
                    Withdrawals
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Pending Approval</span>
                    <span className="font-mono font-medium text-warning">
                      ${(ledgerData?.withdrawalStats.pending || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Approved</span>
                    <span className="font-mono font-medium text-accent">
                      ${(ledgerData?.withdrawalStats.approved || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Processed</span>
                    <span className="font-mono font-medium">
                      ${(ledgerData?.withdrawalStats.processed || 0).toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

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
                    ledgerData?.recentTransactions.slice(0, 10).map((tx: any) => (
                      <div 
                        key={tx.id} 
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/20"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize text-xs">
                              {tx.transaction_type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(tx.created_at).toLocaleString()}
                            </span>
                          </div>
                          {tx.description && (
                            <p className="text-sm text-muted-foreground mt-1">{tx.description}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-medium">${Number(tx.amount).toLocaleString()}</p>
                          {tx.amount_mlm && (
                            <p className="text-xs text-muted-foreground">
                              MLM: ${Number(tx.amount_mlm).toLocaleString()}
                            </p>
                          )}
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

export default AdminLedger;
