import { useState } from "react";
import { 
  Shield, 
  Users, 
  Search, 
  UserCheck, 
  MoreVertical,
  Ban,
  Wallet,
  ArrowUpDown,
  Network,
  Eye,
  UserX,
  AlertTriangle,
  Clock,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
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
import ReferralTreeModal from "@/components/admin/ReferralTreeModal";
import KYCDocumentGallery from "@/components/staff/KYCDocumentGallery";
import type { Database } from "@/integrations/supabase/types";

type AccountStatus = Database["public"]["Enums"]["account_status"];

const WALLET_TYPES = [
  { value: "savings", label: "Savings" },
  { value: "mlm_capital", label: "MLM Capital" },
  { value: "trading_principal", label: "Trading Principal" },
  { value: "mlm_bonus", label: "MLM Bonus" },
  { value: "loan", label: "Loan" },
];

const INVESTMENT_TIERS = [
  "starter", "golden", "premium", "business", "platinum", "achiever"
];

const ACCOUNT_STATUSES: { value: AccountStatus; label: string; color: string }[] = [
  { value: "active", label: "Active", color: "bg-accent/10 text-accent border-accent/30" },
  { value: "suspended", label: "Suspended", color: "bg-warning/10 text-warning border-warning/30" },
  { value: "blacklisted", label: "Blacklisted", color: "bg-destructive/10 text-destructive border-destructive/30" },
  { value: "under_review", label: "Under Review", color: "bg-primary/10 text-primary border-primary/30" },
];

const getStatusConfig = (status: AccountStatus) => {
  return ACCOUNT_STATUSES.find(s => s.value === status) || ACCOUNT_STATUSES[0];
};

const AdminUsers = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [adjustmentDialog, setAdjustmentDialog] = useState(false);
  const [kycDialogOpen, setKycDialogOpen] = useState(false);
  const [kycTargetUser, setKycTargetUser] = useState<any>(null);
  const [adjustmentData, setAdjustmentData] = useState({
    wallet_type: "savings",
    amount: "",
    reason: "",
  });
  const [tierDialog, setTierDialog] = useState(false);
  const [newTier, setNewTier] = useState<string>("");
  const [referralTreeOpen, setReferralTreeOpen] = useState(false);
  
  const { isAdmin, isSuperAdmin, user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all users with their wallets
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
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

          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.id);

          const { data: referralCount } = await supabase
            .from("referrals")
            .select("id", { count: "exact" })
            .eq("referrer_id", profile.id);

          const totalBalance = wallets?.reduce((sum, w) => sum + (Number(w.balance) || 0), 0) || 0;

          return {
            ...profile,
            wallets: wallets || [],
            totalBalance,
            role: roles?.[0]?.role || "member",
            referralCount: referralCount?.length || 0,
          };
        })
      );

      return usersWithWallets;
    },
    enabled: isAdmin,
  });

  // Update account status
  const updateStatus = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: AccountStatus }) => {
      const { error } = await supabase.rpc("staff_update_account_status", {
        p_user_id: userId,
        p_new_status: status,
      });

      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(`Account status updated to ${status}`);
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to update account status");
    },
  });

  // Update user role
  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "super_admin" | "admin" | "staff" | "member" }) => {
      const { error } = await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role }, { onConflict: "user_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User role updated");
    },
    onError: () => {
      toast.error("Failed to update role");
    },
  });

  // Update user tier
  const updateTier = useMutation({
    mutationFn: async ({ userId, tier }: { userId: string; tier: "starter" | "golden" | "premium" | "business" | "platinum" | "achiever" }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ investment_tier: tier })
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Investment tier updated");
      setTierDialog(false);
    },
    onError: () => {
      toast.error("Failed to update tier");
    },
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
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Balance adjusted successfully");
      setAdjustmentDialog(false);
      setAdjustmentData({ wallet_type: "savings", amount: "", reason: "" });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to adjust balance");
    },
  });

  // Toggle system account
  const toggleSystemAccount = useMutation({
    mutationFn: async ({ userId, isSystem }: { userId: string; isSystem: boolean }) => {
      // If marking as system, first unmark any existing system account
      if (isSystem) {
        await supabase
          .from("profiles")
          .update({ is_system_account: false })
          .eq("is_system_account", true);
      }
      const { error } = await supabase
        .from("profiles")
        .update({ is_system_account: isSystem })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: (_, { isSystem }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(isSystem ? "System referral account designated" : "System account removed");
    },
    onError: () => {
      toast.error("Failed to update system account");
    },
  });

  const filteredUsers = users?.filter((user) => {
    const matchesSearch = 
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.referral_code?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || user.account_status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  // Calculate stats
  const statusCounts = {
    active: users?.filter(u => u.account_status === "active" || !u.account_status)?.length || 0,
    suspended: users?.filter(u => u.account_status === "suspended")?.length || 0,
    blacklisted: users?.filter(u => u.account_status === "blacklisted")?.length || 0,
    under_review: users?.filter(u => u.account_status === "under_review")?.length || 0,
  };

  const twoFactorCount = users?.filter(u => u.two_factor_enabled).length || 0;
  const totalUsers = users?.length || 0;

  if (!isAdmin) {
    return (
      <AdminLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2 text-white">Admin Access Only</h1>
          <p className="text-slate-400 text-center max-w-md">
            This page is restricted to administrators only.
          </p>
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
            <h1 className="text-2xl font-bold tracking-tight text-white">
              User Management
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Manage accounts, roles, tiers, statuses, and view referral networks.
            </p>
          </div>
        </div>

        {/* Status Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => setStatusFilter("active")}
            className={`p-4 rounded-lg border transition-colors text-left ${
              statusFilter === "active" 
                ? "border-accent bg-accent/10" 
                : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center gap-3">
              <UserCheck className="w-5 h-5 text-accent" />
              <div>
                <p className="text-2xl font-bold font-mono text-white">{statusCounts.active}</p>
                <p className="text-xs text-slate-400">Active</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => setStatusFilter("suspended")}
            className={`p-4 rounded-lg border transition-colors text-left ${
              statusFilter === "suspended" 
                ? "border-warning bg-warning/10" 
                : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-warning" />
              <div>
                <p className="text-2xl font-bold font-mono text-white">{statusCounts.suspended}</p>
                <p className="text-xs text-slate-400">Suspended</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => setStatusFilter("blacklisted")}
            className={`p-4 rounded-lg border transition-colors text-left ${
              statusFilter === "blacklisted" 
                ? "border-destructive bg-destructive/10" 
                : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center gap-3">
              <UserX className="w-5 h-5 text-destructive" />
              <div>
                <p className="text-2xl font-bold font-mono text-white">{statusCounts.blacklisted}</p>
                <p className="text-xs text-slate-400">Blacklisted</p>
              </div>
            </div>
          </button>
          <button
            onClick={() => setStatusFilter("under_review")}
            className={`p-4 rounded-lg border transition-colors text-left ${
              statusFilter === "under_review" 
                ? "border-primary bg-primary/10" 
                : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold font-mono text-white">{statusCounts.under_review}</p>
                <p className="text-xs text-slate-400">Under Review</p>
              </div>
            </div>
          </button>
          <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/50 text-white">
            <div className="text-xs text-slate-500 uppercase">2FA Enabled</div>
            <div className="text-2xl font-bold">{twoFactorCount}</div>
            <div className="text-xs text-slate-400">of {totalUsers} users</div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search by name, email, or referral code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-900 border-slate-800 text-white placeholder:text-slate-500"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-slate-900 border-slate-800 text-white">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {ACCOUNT_STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Users Table */}
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900 border-b border-slate-800">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">User ID</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">User</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400 hidden md:table-cell">Role</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400 hidden sm:table-cell">Tier</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Balance</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Joined</th>
                  <th className="text-right p-4 text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="p-4">
                        <div className="h-12 bg-slate-800/50 animate-pulse rounded" />
                      </td>
                    </tr>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center">
                      <Users className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                      <p className="text-slate-500">No users found</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const statusConfig = getStatusConfig(user.account_status || "active");
                    return (
                      <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 text-xs font-mono text-slate-500">
                          {user.id.substring(0, 8)}...
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">{user.full_name || "Unknown"}</span>
                            {user.is_system_account && (
                              <Badge variant="outline" className="bg-cyan-950/50 text-cyan-400 border-cyan-800/50 text-[10px]">
                                <Bot className="w-3 h-3 mr-1" />
                                SYSTEM
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-slate-500">{user.email}</div>
                        </td>
                        <td className="p-4 hidden md:table-cell">
                          <Badge 
                            variant="outline" 
                            className={
                              user.role === "admin" 
                                ? "bg-red-950/50 text-red-400 border-red-800/50" 
                                : user.role === "staff"
                                ? "bg-cyan-950/50 text-cyan-400 border-cyan-800/50"
                                : user.role === "seller"
                                ? "bg-indigo-950/50 text-indigo-400 border-indigo-800/50"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                            }
                          >
                            {user.role}
                          </Badge>
                        </td>
                        <td className="p-4 hidden sm:table-cell text-sm capitalize text-slate-300">
                          {user.investment_tier}
                        </td>
                        <td className="p-4">
                          <span className="font-mono font-medium text-white">
                            ${user.totalBalance.toLocaleString()}
                          </span>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline" className={statusConfig.color}>
                            {statusConfig.label}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm text-slate-400">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {(user.account_status === "active" || !user.account_status) ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-warning border-warning/30 hover:bg-warning/10"
                                onClick={() => updateStatus.mutate({ userId: user.id, status: "suspended" })}
                                disabled={updateStatus.isPending}
                              >
                                Suspend
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-accent border-accent/30 hover:bg-accent/10"
                                onClick={() => updateStatus.mutate({ userId: user.id, status: "active" })}
                                disabled={updateStatus.isPending}
                              >
                                Reactivate
                              </Button>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800">
                              {/* View Referral Tree */}
                              <DropdownMenuItem 
                                onClick={() => {
                                  setKycTargetUser(user);
                                  setKycDialogOpen(true);
                                }}
                                className="text-slate-300 focus:text-white focus:bg-slate-800"
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View KYC Documents
                              </DropdownMenuItem>

                              <DropdownMenuItem 
                                onClick={() => {
                                  setSelectedUser(user);
                                  setReferralTreeOpen(true);
                                }}
                                className="text-slate-300 focus:text-white focus:bg-slate-800"
                              >
                                <Network className="w-4 h-4 mr-2" />
                                View Referral Tree
                              </DropdownMenuItem>

                              {/* Balance Adjustment */}
                              <DropdownMenuItem 
                                onClick={() => {
                                  setSelectedUser(user);
                                  setAdjustmentDialog(true);
                                }}
                                className="text-slate-300 focus:text-white focus:bg-slate-800"
                              >
                                <Wallet className="w-4 h-4 mr-2" />
                                Adjust Balance
                              </DropdownMenuItem>
                              
                              {/* Tier Change */}
                              <DropdownMenuItem 
                                onClick={() => {
                                  setSelectedUser(user);
                                  setNewTier(user.investment_tier);
                                  setTierDialog(true);
                                }}
                                className="text-slate-300 focus:text-white focus:bg-slate-800"
                              >
                                <ArrowUpDown className="w-4 h-4 mr-2" />
                                Change Tier
                              </DropdownMenuItem>

                              <DropdownMenuSeparator className="bg-slate-800" />

                              {/* Account Status Sub-menu */}
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="text-slate-300 focus:text-white focus:bg-slate-800">
                                  <Eye className="w-4 h-4 mr-2" />
                                  Change Status
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="bg-slate-900 border-slate-800">
                                  {ACCOUNT_STATUSES.map((status) => (
                                    <DropdownMenuItem
                                      key={status.value}
                                      onClick={() => updateStatus.mutate({ userId: user.id, status: status.value })}
                                      disabled={user.account_status === status.value}
                                      className="text-slate-300 focus:text-white focus:bg-slate-800"
                                    >
                                      {status.value === "active" && <UserCheck className="w-4 h-4 mr-2 text-accent" />}
                                      {status.value === "suspended" && <Clock className="w-4 h-4 mr-2 text-warning" />}
                                      {status.value === "blacklisted" && <UserX className="w-4 h-4 mr-2 text-destructive" />}
                                      {status.value === "under_review" && <AlertTriangle className="w-4 h-4 mr-2 text-primary" />}
                                      {status.label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>

                              <DropdownMenuSeparator className="bg-slate-800" />

                              {/* Quick Status Actions */}
                              {user.account_status === "active" || !user.account_status ? (
                                <DropdownMenuItem 
                                  onClick={() => updateStatus.mutate({ userId: user.id, status: "suspended" })}
                                  className="text-warning focus:text-warning focus:bg-warning/10"
                                >
                                  <Ban className="w-4 h-4 mr-2" />
                                  Suspend Account
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem 
                                  onClick={() => updateStatus.mutate({ userId: user.id, status: "active" })}
                                  className="text-accent focus:text-accent focus:bg-accent/10"
                                >
                                  <UserCheck className="w-4 h-4 mr-2" />
                                  Reactivate Account
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuSeparator className="bg-slate-800" />

                              {/* Role Management */}
                              {isSuperAdmin && user.role !== "super_admin" && currentUser?.id !== user.id && (
                                <DropdownMenuItem
                                  onClick={() => updateRole.mutate({ userId: user.id, role: "super_admin" })}
                                  className="text-cyan-400 focus:text-cyan-300 focus:bg-cyan-500/10"
                                >
                                  <Shield className="w-4 h-4 mr-2" />
                                  Make Super Admin
                                </DropdownMenuItem>
                              )}
                              {user.role === "super_admin" && currentUser?.id !== user.id && (
                                <DropdownMenuItem
                                  onClick={() => updateRole.mutate({ userId: user.id, role: "admin" })}
                                  className="text-slate-300 focus:text-white focus:bg-slate-800"
                                >
                                  <Users className="w-4 h-4 mr-2" />
                                  Demote from Super Admin
                                </DropdownMenuItem>
                              )}
                              {user.role === "member" && (
                                <DropdownMenuItem 
                                  onClick={() => updateRole.mutate({ userId: user.id, role: "staff" })}
                                  className="text-slate-300 focus:text-white focus:bg-slate-800"
                                >
                                  <Shield className="w-4 h-4 mr-2" />
                                  Make Staff
                                </DropdownMenuItem>
                              )}
                              {isSuperAdmin && (user.role === "member" || user.role === "staff") && (
                                <DropdownMenuItem 
                                  onClick={() => updateRole.mutate({ userId: user.id, role: "admin" })}
                                  className="text-emerald-400 focus:text-emerald-300 focus:bg-emerald-500/10"
                                >
                                  <Network className="w-4 h-4 mr-2" />
                                  Make Admin
                                </DropdownMenuItem>
                              )}
                              {user.role === "staff" && (
                                <DropdownMenuItem 
                                  onClick={() => updateRole.mutate({ userId: user.id, role: "member" })}
                                  className="text-slate-300 focus:text-white focus:bg-slate-800"
                                >
                                  <Users className="w-4 h-4 mr-2" />
                                  Remove Staff Role
                                </DropdownMenuItem>
                              )}
                              {isSuperAdmin && user.role === "admin" && (
                                <DropdownMenuItem 
                                  onClick={() => updateRole.mutate({ userId: user.id, role: "staff" })}
                                  className="text-slate-300 focus:text-white focus:bg-slate-800"
                                >
                                  <Users className="w-4 h-4 mr-2" />
                                  Demote to Staff
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuSeparator className="bg-slate-800" />

                              {/* System Account Toggle */}
                              {!user.is_system_account ? (
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (confirm("Designate this account as the System Referral Account? This will replace any existing system account. The account will act as a neutral upline and cannot earn commissions or withdraw.")) {
                                      toggleSystemAccount.mutate({ userId: user.id, isSystem: true });
                                    }
                                  }}
                                  className="text-cyan-400 focus:text-cyan-300 focus:bg-cyan-500/10"
                                >
                                  <Bot className="w-4 h-4 mr-2" />
                                  Set as System Referral
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => toggleSystemAccount.mutate({ userId: user.id, isSystem: false })}
                                  className="text-slate-300 focus:text-white focus:bg-slate-800"
                                >
                                  <Bot className="w-4 h-4 mr-2" />
                                  Remove System Account
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Balance Adjustment Dialog */}
        <Dialog open={adjustmentDialog} onOpenChange={setAdjustmentDialog}>
          <DialogContent className="bg-slate-900 border-slate-800">
            <DialogHeader>
              <DialogTitle className="text-white">Adjust User Balance</DialogTitle>
              <DialogDescription className="text-slate-400">
                Manually adjust {selectedUser?.full_name || selectedUser?.email}'s wallet balance.
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
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    {WALLET_TYPES.map((wallet) => (
                      <SelectItem key={wallet.value} value={wallet.value}>
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
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Reason (required)</Label>
                <Textarea
                  placeholder="Explain the reason for this adjustment..."
                  value={adjustmentData.reason}
                  onChange={(e) => setAdjustmentData(prev => ({ ...prev, reason: e.target.value }))}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdjustmentDialog(false)} className="border-slate-700 text-slate-300">
                Cancel
              </Button>
              <Button
                onClick={() => adjustBalance.mutate({
                  userId: selectedUser.id,
                  wallet_type: adjustmentData.wallet_type as "savings" | "mlm_capital" | "trading_principal" | "mlm_bonus" | "loan",
                  amount: parseFloat(adjustmentData.amount),
                  reason: adjustmentData.reason,
                })}
                disabled={!adjustmentData.amount || !adjustmentData.reason || adjustBalance.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {adjustBalance.isPending ? "Processing..." : "Apply Adjustment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Tier Change Dialog */}
        <Dialog open={tierDialog} onOpenChange={setTierDialog}>
          <DialogContent className="bg-slate-900 border-slate-800">
            <DialogHeader>
              <DialogTitle className="text-white">Change Investment Tier</DialogTitle>
              <DialogDescription className="text-slate-400">
                Update {selectedUser?.full_name || selectedUser?.email}'s investment tier.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-slate-300">New Tier</Label>
                <Select value={newTier} onValueChange={setNewTier}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    {INVESTMENT_TIERS.map((tier) => (
                      <SelectItem key={tier} value={tier} className="capitalize">
                        {tier}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTierDialog(false)} className="border-slate-700 text-slate-300">
                Cancel
              </Button>
              <Button
                onClick={() => updateTier.mutate({
                  userId: selectedUser.id,
                  tier: newTier as "starter" | "golden" | "premium" | "business" | "platinum" | "achiever",
                })}
                disabled={updateTier.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {updateTier.isPending ? "Updating..." : "Update Tier"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* KYC Document Dialog */}
        <Dialog open={kycDialogOpen} onOpenChange={(open) => {
          setKycDialogOpen(open);
          if (!open) setKycTargetUser(null);
        }}>
          <DialogContent className="bg-slate-900 border-slate-800 max-w-3xl">
            <DialogHeader>
              <DialogTitle className="text-white">KYC Documents for {kycTargetUser?.full_name || kycTargetUser?.email || 'User'}</DialogTitle>
              <DialogDescription className="text-slate-400">
                KYC status: {kycTargetUser?.kyc_status || 'pending'}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <KYCDocumentGallery
                idDocumentUrl={kycTargetUser?.kyc_document_url}
                passportUrl={kycTargetUser?.passport_url}
                selfieUrl={kycTargetUser?.selfie_url}
                className="border border-slate-700 rounded-lg"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setKycDialogOpen(false)} className="border-slate-700 text-slate-300">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Referral Tree Modal */}
        {selectedUser && (
          <ReferralTreeModal
            open={referralTreeOpen}
            onOpenChange={setReferralTreeOpen}
            userId={selectedUser.id}
            userName={selectedUser.full_name || selectedUser.email || "User"}
          />
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminUsers;
