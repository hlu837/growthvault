import { useState } from "react";
import {
  DollarSign,
  TrendingUp,
  Users,
  AlertTriangle,
  PiggyBank,
  ArrowUpRight,
  Coins,
  Shield,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const AdminRevenue = () => {
  const { isAdmin } = useAuth();

  // Fetch platform revenue data
  const { data: revenue, isLoading } = useQuery({
    queryKey: ["admin-platform-revenue"],
    queryFn: async () => {
      const [
        platformFees,
        marketplaceOrders,
        systemAccountRes,
        wallets,
        transactions,
        settingsRes,
      ] = await Promise.all([
        supabase.from("platform_fees").select("*").order("created_at", { ascending: false }),
        supabase.from("marketplace_orders").select("total_escrow_hold_amount"),
        supabase.from("profiles").select("id").eq("is_system_account", true).maybeSingle(),
        supabase.from("wallets").select("balance, wallet_type, user_id"),
        supabase.from("transactions").select("amount, transaction_type, description, created_at"),
        supabase.from("system_settings").select("setting_key, setting_value"),
      ]);

      const fees = platformFees.data || [];
      const orders = marketplaceOrders.data || [];

      // Collected commissions from platform fees
      const collectedCommissions = fees.reduce((sum, f) => sum + Number(f.amount || 0), 0);

      // Funds held in escrow
      const fundsInEscrow = orders.reduce(
        (sum, order) => sum + Number(order.total_escrow_hold_amount || 0),
        0
      );

      // Early withdrawal penalties
      const earlyWithdrawalPenalties = fees
        .filter((f) => f.fee_type === "early_withdrawal_penalty")
        .reduce((sum, f) => sum + Number(f.amount || 0), 0);

      const penaltyCount = fees.filter((f) => f.fee_type === "early_withdrawal_penalty").length;

      // Unallocated MLM commissions (commissions routed to system account)
      const systemAccountId = systemAccountRes.data?.id;
      let unallocatedMLM = 0;

      if (systemAccountId) {
        const systemMLMWallet = (wallets.data || []).find(
          (w: any) => w.user_id === systemAccountId && w.wallet_type === "mlm_bonus"
        );
        unallocatedMLM = Number(systemMLMWallet?.balance || 0);
      }

      // Admin cut from 50/50 split
      const adminSplitFees = fees
        .filter((f) => f.fee_type === "admin_split" || f.fee_type === "platform_cut")
        .reduce((sum, f) => sum + Number(f.amount || 0), 0);

      // Total investments to calculate the 50/50 allocation
      const totalInvestmentDeposits = (transactions.data || [])
        .filter((t: any) => t.transaction_type === "investment" || t.description?.includes("vault"))
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      const mlmPoolAllocation = totalInvestmentDeposits * 0.5;

      // Global multiplier from settings
      const settingsMap: Record<string, string> = {};
      (settingsRes.data || []).forEach((s) => {
        settingsMap[s.setting_key] = String(s.setting_value);
      });
      const globalMultiplier = Number(settingsMap.global_apy_multiplier || "1");

      // Total platform revenue
      const totalRevenue = earlyWithdrawalPenalties + unallocatedMLM + adminSplitFees;

      // Recent fees for activity log
      const recentFees = fees.slice(0, 10).map((f) => ({
        id: f.id,
        type: f.fee_type,
        amount: Number(f.amount || 0),
        description: f.description || f.fee_type?.replace(/_/g, " "),
        date: f.created_at,
      }));

      return {
        totalRevenue,
        collectedCommissions,
        fundsInEscrow,
        earlyWithdrawalPenalties,
        penaltyCount,
        unallocatedMLM,
        adminSplitFees,
        mlmPoolAllocation,
        totalInvestmentDeposits,
        globalMultiplier,
        recentFees,
      };
    },
    enabled: isAdmin,
    refetchInterval: 30000,
  });

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
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
              <Shield className="w-4 h-4" />
              Admin Panel
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Platform Revenue
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Track all platform income streams and allocations
            </p>
          </div>
          {revenue && (
            <Badge variant="outline" className="w-fit bg-red-950/50 text-red-400 border-red-800/50 font-mono text-lg px-4 py-2">
              ${revenue.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              <span className="text-xs ml-2 text-slate-500">TOTAL</span>
            </Badge>
          )}
        </div>

        {/* Revenue Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          {/* Unallocated MLM */}
          <Card className="bg-gradient-to-br from-purple-950/30 to-slate-900/50 border-purple-800/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-purple-400 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Unallocated MLM Commissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-10 w-32 bg-slate-800" />
              ) : (
                <>
                  <p className="text-3xl font-bold font-mono text-white">
                    ${(revenue?.unallocatedMLM || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    Commissions from users with no upline — routed to System Account
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Early Withdrawal Penalties */}
          <Card className="bg-gradient-to-br from-amber-950/30 to-slate-900/50 border-amber-800/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-amber-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Early Withdrawal Penalties
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-10 w-32 bg-slate-800" />
              ) : (
                <>
                  <p className="text-3xl font-bold font-mono text-white">
                    ${(revenue?.earlyWithdrawalPenalties || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    {revenue?.penaltyCount || 0} penalty events collected
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Admin Split Cut */}
          <Card className="bg-gradient-to-br from-red-950/30 to-slate-900/50 border-red-800/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-red-400 flex items-center gap-2">
                <Coins className="w-4 h-4" />
                Admin Cut (50/50 Split)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-10 w-32 bg-slate-800" />
              ) : (
                <>
                  <p className="text-3xl font-bold font-mono text-white">
                    ${(revenue?.adminSplitFees || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    Platform fees from the investment split
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-red-400" />
              Commission vs Escrow Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full bg-slate-700" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                  <p className="text-sm text-slate-400 mb-1">Collected Commissions</p>
                  <p className="text-3xl font-bold font-mono text-white">
                    ${(revenue?.collectedCommissions || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    Total amount recorded in platform_fees
                  </p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                  <p className="text-sm text-slate-400 mb-1">Funds in Escrow</p>
                  <p className="text-3xl font-bold font-mono text-white">
                    ${(revenue?.fundsInEscrow || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    Total marketplace order escrow held for sellers or refunds
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Allocation Breakdown */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-red-400" />
              Capital Allocation Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <div className="text-sm text-slate-400 mb-1">Total Investment Deposits</div>
                {isLoading ? (
                  <Skeleton className="h-8 w-28 bg-slate-700" />
                ) : (
                  <div className="text-2xl font-bold font-mono text-white">
                    ${(revenue?.totalInvestmentDeposits || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                )}
              </div>
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <div className="text-sm text-slate-400 mb-1">MLM Pool (50% Allocation)</div>
                {isLoading ? (
                  <Skeleton className="h-8 w-28 bg-slate-700" />
                ) : (
                  <div className="text-2xl font-bold font-mono text-white">
                    ${(revenue?.mlmPoolAllocation || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                )}
              </div>
            </div>

            {/* 50/50 Split Visual */}
            <div className="mt-6">
              <div className="text-sm text-slate-400 mb-3">Deposit Split Distribution</div>
              <div className="flex rounded-lg overflow-hidden h-8">
                <div className="bg-red-600/80 flex items-center justify-center text-xs font-mono text-white" style={{ width: "50%" }}>
                  50% → Investment Principal
                </div>
                <div className="bg-purple-600/80 flex items-center justify-center text-xs font-mono text-white" style={{ width: "50%" }}>
                  50% → MLM Commission Pool
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Global APY Multiplier Status */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-red-400" />
              Global Interest Rate Multiplier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                {isLoading ? (
                  <Skeleton className="h-12 w-20 bg-slate-700" />
                ) : (
                  <div className="text-4xl font-bold font-mono text-red-400">
                    {revenue?.globalMultiplier?.toFixed(2) || "1.00"}x
                  </div>
                )}
                <div className="text-xs text-slate-500 mt-1">Current Multiplier</div>
              </div>
              <div className="flex-1 text-sm text-slate-400">
                <p>All vault APY rates are multiplied by this factor.</p>
                <p className="mt-1 text-slate-500">
                  Adjust this in{" "}
                  <a href="/admin/settings" className="text-red-400 hover:underline">
                    System Configuration → Global Controls
                  </a>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Fee Activity */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-red-400" />
              Recent Fee Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full bg-slate-800" />
                ))}
              </div>
            ) : revenue?.recentFees && revenue.recentFees.length > 0 ? (
              <div className="space-y-2">
                {revenue.recentFees.map((fee) => (
                  <div
                    key={fee.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-900/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        fee.type === "early_withdrawal_penalty"
                          ? "bg-amber-500/20"
                          : fee.type === "admin_split" || fee.type === "platform_cut"
                          ? "bg-red-500/20"
                          : "bg-purple-500/20"
                      }`}>
                        <DollarSign className={`w-4 h-4 ${
                          fee.type === "early_withdrawal_penalty"
                            ? "text-amber-400"
                            : fee.type === "admin_split" || fee.type === "platform_cut"
                            ? "text-red-400"
                            : "text-purple-400"
                        }`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white capitalize">
                          {fee.description}
                        </p>
                        <p className="text-xs text-slate-500">
                          {fee.type?.replace(/_/g, " ")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-semibold text-red-400">
                        +${fee.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-slate-500">
                        {fee.date ? new Date(fee.date).toLocaleDateString() : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>No fee activity recorded yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminRevenue;
