import { useState } from "react";
import { 
  Users, 
  Search, 
  User,
  Eye,
  AlertTriangle,
  Loader2,
  Shield,
  Ban
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import StaffLayout from "@/components/StaffLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  kyc_status: string | null;
  investment_tier: string | null;
  referral_code: string | null;
  is_frozen: boolean | null;
  created_at: string | null;
  wallets: { wallet_type: string; balance: number }[];
  totalBalance: number;
}

const StaffDirectory = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "frozen">("all");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const { isAdmin, isStaff } = useAuth();

  // Fetch users
  const { data: users, isLoading } = useQuery({
    queryKey: ["staff-directory"],
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
            .select("wallet_type, balance")
            .eq("user_id", profile.id);

          const totalBalance = wallets?.reduce((sum, w) => sum + (Number(w.balance) || 0), 0) || 0;

          return {
            ...profile,
            wallets: wallets || [],
            totalBalance,
          };
        })
      );

      return usersWithWallets as UserProfile[];
    },
    enabled: isAdmin || isStaff,
  });

  const filteredUsers = users?.filter((user) => {
    const matchesSearch = 
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = 
      filter === "all" || 
      (filter === "frozen" && user.is_frozen) ||
      (filter === "active" && !user.is_frozen);
    
    return matchesSearch && matchesFilter;
  }) || [];

  const stats = {
    total: users?.length || 0,
    active: users?.filter(u => !u.is_frozen).length || 0,
    frozen: users?.filter(u => u.is_frozen).length || 0,
  };

  if (!isAdmin && !isStaff) {
    return (
      <StaffLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <img src="/logo.png" alt="GWA Logo" className="w-16 h-16 mb-4 rounded-lg shadow-md" />
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
        </div>
      </StaffLayout>
    );
  }

  return (
    <StaffLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 font-mono">
              <Users className="w-3 h-3" />
              USER DIRECTORY
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              User Directory
            </h1>
          </div>
          <Badge variant="outline" className="bg-slate-800 text-slate-300 border-slate-700 font-mono">
            {stats.total} USERS
          </Badge>
        </div>

        {/* Notice */}
        <div className="p-4 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
          <p className="text-sm text-cyan-400 font-mono">
            <strong>READ-ONLY:</strong> You can view user information and balances, but cannot modify accounts or funds.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "p-4 rounded-lg border text-left transition-all",
              filter === "all" 
                ? "border-cyan-500/50 bg-cyan-500/10" 
                : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
            )}
          >
            <div className="text-2xl font-bold font-mono text-white">{stats.total}</div>
            <div className="text-xs text-slate-500">Total Users</div>
          </button>
          <button
            onClick={() => setFilter("active")}
            className={cn(
              "p-4 rounded-lg border text-left transition-all",
              filter === "active" 
                ? "border-emerald-500/50 bg-emerald-500/10" 
                : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
            )}
          >
            <div className="text-2xl font-bold font-mono text-emerald-400">{stats.active}</div>
            <div className="text-xs text-slate-500">Active</div>
          </button>
          <button
            onClick={() => setFilter("frozen")}
            className={cn(
              "p-4 rounded-lg border text-left transition-all",
              filter === "frozen" 
                ? "border-red-500/50 bg-red-500/10" 
                : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
            )}
          >
            <div className="text-2xl font-bold font-mono text-red-400">{stats.frozen}</div>
            <div className="text-xs text-slate-500">Frozen</div>
          </button>
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50 border-b border-slate-800">
                <tr>
                  <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                  <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">KYC</th>
                  <th className="text-left p-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Tier</th>
                  <th className="text-right p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Balance</th>
                  <th className="text-right p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center">
                      <Loader2 className="w-6 h-6 text-cyan-400 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center">
                      <Users className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                      <p className="text-slate-500">No users found</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center">
                            <User className="w-4 h-4 text-slate-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">
                                {user.full_name || "Unknown"}
                              </span>
                              {user.is_frozen && (
                                <Ban className="w-3 h-3 text-red-500" />
                              )}
                            </div>
                            <p className="text-xs text-slate-500 truncate max-w-[200px]">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "font-mono text-[10px]",
                            user.kyc_status === "approved" 
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : user.kyc_status === "pending"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-slate-800 text-slate-400 border-slate-700"
                          )}
                        >
                          {user.kyc_status?.toUpperCase() || "NONE"}
                        </Badge>
                      </td>
                      <td className="p-4 hidden sm:table-cell">
                        <span className="text-sm text-slate-400 capitalize">
                          {user.investment_tier}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className="font-bold font-mono text-white">
                          ${user.totalBalance.toLocaleString()}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10"
                          onClick={() => setSelectedUser(user)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* View User Dialog */}
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="max-w-2xl bg-slate-950 border-slate-800">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <User className="w-5 h-5 text-cyan-400" />
                User Details
              </DialogTitle>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-6 py-4">
                {/* Status Badges */}
                <div className="flex gap-2">
                  {selectedUser.is_frozen && (
                    <Badge className="bg-red-500/10 text-red-400 border-red-500/30">
                      <Ban className="w-3 h-3 mr-1" />
                      Frozen
                    </Badge>
                  )}
                  <Badge 
                    className={cn(
                      selectedUser.kyc_status === "approved" 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    )}
                  >
                    <Shield className="w-3 h-3 mr-1" />
                    KYC: {selectedUser.kyc_status?.toUpperCase()}
                  </Badge>
                </div>

                {/* User Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-500 text-xs">Full Name</Label>
                    <p className="text-white font-medium">{selectedUser.full_name || "Not set"}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">Email</Label>
                    <p className="text-white font-medium">{selectedUser.email}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">Investment Tier</Label>
                    <p className="text-white font-medium capitalize">{selectedUser.investment_tier}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-xs">Referral Code</Label>
                    <p className="text-cyan-400 font-mono">{selectedUser.referral_code}</p>
                  </div>
                </div>

                {/* Wallets */}
                <div>
                  <Label className="text-slate-500 text-xs mb-3 block">Wallet Balances</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {selectedUser.wallets?.map((wallet) => (
                      <div 
                        key={wallet.wallet_type} 
                        className="p-3 rounded-lg bg-slate-900 border border-slate-800"
                      >
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                          {wallet.wallet_type.replace("_", " ")}
                        </p>
                        <p className="font-bold font-mono text-white">
                          ${Number(wallet.balance).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-cyan-400">Total Balance</span>
                      <span className="text-xl font-bold font-mono text-white">
                        ${selectedUser.totalBalance.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </StaffLayout>
  );
};

export default StaffDirectory;
