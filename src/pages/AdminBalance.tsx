import { useState } from "react";
import { 
  Wallet,
  Search,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const WALLET_TYPES = [
  { value: "savings", label: "Savings" },
  { value: "mlm_capital", label: "MLM Capital" },
  { value: "trading_principal", label: "Investment Principal" },
  { value: "mlm_bonus", label: "MLM Bonus" },
  { value: "loan", label: "Loan" },
];

const AdminBalance = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [adjustmentDialog, setAdjustmentDialog] = useState(false);
  const [adjustmentData, setAdjustmentData] = useState({
    wallet_type: "savings",
    amount: "",
    reason: "",
  });
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  // Fetch users with wallets
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users-balance"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const usersWithWallets = await Promise.all(
        profiles.map(async (profile) => {
          const { data: wallets } = await supabase
            .from("wallets")
            .select("*")
            .eq("user_id", profile.id);

          const totalBalance = wallets?.reduce((sum, w) => sum + (Number(w.balance) || 0), 0) || 0;

          return {
            ...profile,
            wallets: wallets || [],
            totalBalance,
          };
        })
      );

      return usersWithWallets;
    },
    enabled: isAdmin,
  });

  // Manual balance adjustment
  const adjustBalance = useMutation({
    mutationFn: async ({ userId, wallet_type, amount, reason }: { 
      userId: string; 
      wallet_type: "savings" | "mlm_capital" | "trading_principal" | "mlm_bonus" | "loan"; 
      amount: number; 
      reason: string;
    }) => {
      const { data, error } = await supabase.rpc('admin_adjust_balance', {
        p_user_id: userId,
        p_wallet_type: wallet_type,
        p_amount: amount,
        p_reason: reason,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-balance"] });
      toast.success("Balance adjusted successfully");
      setAdjustmentDialog(false);
      setAdjustmentData({ wallet_type: "savings", amount: "", reason: "" });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to adjust balance");
    },
  });

  const filteredUsers = users?.filter((user) => {
    const matchesSearch = 
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  }) || [];

  if (!isAdmin) {
    return (
      <AdminLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Admin Access Only</h1>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 font-mono">
            <Wallet className="w-3 h-3" />
            MANUAL BALANCE EDIT
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            User Balance Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manually adjust user wallet balances. All changes are logged.
          </p>
        </div>

        {/* Warning */}
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-400">Admin Only Feature</p>
              <p className="text-slate-400">
                Balance adjustments create permanent transaction records. Only the owner can "create" money in the system.
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>

        {/* Users Table */}
        <div className="bg-slate-950/50 border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-900/50 border-b border-slate-800">
              <tr>
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase">User</th>
                <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase hidden md:table-cell">Wallets</th>
                <th className="text-right p-4 text-xs font-bold text-slate-500 uppercase">Total Balance</th>
                <th className="text-right p-4 text-xs font-bold text-slate-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center">
                    <Loader2 className="w-6 h-6 text-red-400 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-900/50">
                    <td className="p-4">
                      <div className="font-medium text-white">{user.full_name || "Unknown"}</div>
                      <div className="text-sm text-slate-500">{user.email}</div>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {user.wallets.map((wallet: any) => (
                          <Badge 
                            key={wallet.id} 
                            variant="outline" 
                            className="text-[10px] text-slate-400 border-slate-700"
                          >
                            {wallet.wallet_type}: ${Number(wallet.balance).toLocaleString()}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <span className="font-mono font-bold text-amber-400">
                        ${user.totalBalance.toLocaleString()}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                        onClick={() => {
                          setSelectedUser(user);
                          setAdjustmentDialog(true);
                        }}
                      >
                        <Wallet className="w-4 h-4 mr-1" />
                        Adjust
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Balance Adjustment Dialog */}
        <Dialog open={adjustmentDialog} onOpenChange={setAdjustmentDialog}>
          <DialogContent className="bg-slate-950 border-slate-800">
            <DialogHeader>
              <DialogTitle className="text-white">Adjust Balance</DialogTitle>
              <DialogDescription className="text-slate-400">
                Adjust {selectedUser?.full_name || selectedUser?.email}'s wallet balance.
                Use negative values to deduct funds.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Wallet</Label>
                <Select
                  value={adjustmentData.wallet_type}
                  onValueChange={(value) => setAdjustmentData(prev => ({ ...prev, wallet_type: value }))}
                >
                  <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    {WALLET_TYPES.map((wallet) => (
                      <SelectItem key={wallet.value} value={wallet.value} className="text-white">
                        {wallet.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Amount (use - for deduction)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 100 or -50"
                  value={adjustmentData.amount}
                  onChange={(e) => setAdjustmentData(prev => ({ ...prev, amount: e.target.value }))}
                  className="bg-slate-900 border-slate-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Reason (required)</Label>
                <Textarea
                  placeholder="Explain the reason for this adjustment..."
                  value={adjustmentData.reason}
                  onChange={(e) => setAdjustmentData(prev => ({ ...prev, reason: e.target.value }))}
                  className="bg-slate-900 border-slate-700 text-white"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setAdjustmentDialog(false)}
                className="border-slate-700 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                onClick={() => adjustBalance.mutate({
                  userId: selectedUser.id,
                  wallet_type: adjustmentData.wallet_type as any,
                  amount: Number(adjustmentData.amount),
                  reason: adjustmentData.reason,
                })}
                disabled={!adjustmentData.amount || !adjustmentData.reason || adjustBalance.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {adjustBalance.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Confirm Adjustment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminBalance;
