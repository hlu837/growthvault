import { useState } from "react";
import { 
  Shield, 
  Users, 
  Search, 
  Eye,
  Edit,
  UserCheck,
  Ban,
  User,
  Pause,
  Play,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const StaffUserSupport = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "frozen">("all");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editDialog, setEditDialog] = useState(false);
  const [editData, setEditData] = useState({
    full_name: "",
    email: "",
  });
  
  const { isAdmin, isStaff } = useAuth();
  const queryClient = useQueryClient();

  // Fetch users
  const { data: users, isLoading } = useQuery({
    queryKey: ["staff-users"],
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

      return usersWithWallets;
    },
    enabled: isAdmin || isStaff,
  });

  // Update user profile (limited fields for staff)
  const updateProfile = useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: { full_name?: string } }) => {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      toast.success("Profile updated successfully");
      setEditDialog(false);
    },
    onError: () => {
      toast.error("Failed to update profile");
    },
  });

  // Temporary suspend/unsuspend user (staff capability)
  const updateAccountStatus = useMutation({
    mutationFn: async ({ userId, newStatus }: { userId: string; newStatus: string }) => {
      const { data, error } = await supabase.rpc('staff_update_account_status', {
        p_user_id: userId,
        p_new_status: newStatus as any,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      toast.success(
        variables.newStatus === 'suspended' 
          ? 'User temporarily suspended' 
          : 'User account reactivated'
      );
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update account status');
    },
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
            User Support
          </h1>
          <p className="text-muted-foreground mt-1">
            View user accounts and assist with profile updates.
          </p>
        </div>

        {/* Notice */}
        <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
          <p className="text-sm text-primary">
            <strong>Support Mode:</strong> You can view balances and update profile information, 
            but cannot modify balances or approve financial transactions.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => setFilter("all")}
            className={`p-4 rounded-md border text-left transition-all ${
              filter === "all" ? "border-foreground bg-secondary" : "border-border bg-card"
            }`}
          >
            <div className="text-2xl font-bold font-mono">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Users</div>
          </button>
          <button
            onClick={() => setFilter("active")}
            className={`p-4 rounded-md border text-left transition-all ${
              filter === "active" ? "border-accent bg-accent/10" : "border-border bg-card"
            }`}
          >
            <div className="text-2xl font-bold font-mono text-accent">{stats.active}</div>
            <div className="text-sm text-muted-foreground">Active</div>
          </button>
          <button
            onClick={() => setFilter("frozen")}
            className={`p-4 rounded-md border text-left transition-all ${
              filter === "frozen" ? "border-destructive bg-destructive/10" : "border-border bg-card"
            }`}
          >
            <div className="text-2xl font-bold font-mono text-destructive">{stats.frozen}</div>
            <div className="text-sm text-muted-foreground">Frozen</div>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>

        {/* Users List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-secondary/30 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground">No users found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredUsers.map((user) => (
              <Card key={user.id} className="hover:border-muted-foreground/50 transition-colors">
                <CardContent className="py-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                        <User className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{user.full_name || "Unknown"}</span>
                          {user.account_status === 'suspended' && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                              Suspended
                            </Badge>
                          )}
                          {user.account_status === 'blacklisted' && (
                            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                              Blacklisted
                            </Badge>
                          )}
                          {user.is_frozen && (
                            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                              Frozen
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Tier: <span className="capitalize">{user.investment_tier}</span> • 
                          KYC: <span className="capitalize">{user.kyc_status}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-lg font-bold font-mono">
                          ${user.totalBalance.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">Total Balance</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedUser(user);
                          }}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setEditData({
                              full_name: user.full_name || "",
                              email: user.email || "",
                            });
                            setEditDialog(true);
                          }}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        {/* Temporary Suspend / Reactivate */}
                        {user.account_status !== 'blacklisted' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className={
                              user.account_status === 'suspended'
                                ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                : "border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                            }
                            onClick={() => updateAccountStatus.mutate({
                              userId: user.id,
                              newStatus: user.account_status === 'suspended' ? 'active' : 'suspended',
                            })}
                            disabled={updateAccountStatus.isPending}
                          >
                            {updateAccountStatus.isPending ? (
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : user.account_status === 'suspended' ? (
                              <Play className="w-4 h-4 mr-1" />
                            ) : (
                              <Pause className="w-4 h-4 mr-1" />
                            )}
                            {user.account_status === 'suspended' ? 'Reactivate' : 'Suspend'}
                          </Button>
                        )}
                        {user.account_status === 'blacklisted' && (
                          <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Blacklisted
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* View User Dialog */}
        <Dialog open={!!selectedUser && !editDialog} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>User Details</DialogTitle>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Full Name</Label>
                    <p className="font-medium">{selectedUser.full_name || "Not set"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{selectedUser.email}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Investment Tier</Label>
                    <p className="font-medium capitalize">{selectedUser.investment_tier}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">KYC Status</Label>
                    <p className="font-medium capitalize">{selectedUser.kyc_status}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Referral Code</Label>
                    <p className="font-mono">{selectedUser.referral_code}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Account Status</Label>
                    <Badge 
                      variant="outline" 
                      className={selectedUser.is_frozen 
                        ? "bg-destructive/10 text-destructive" 
                        : "bg-accent/10 text-accent"
                      }
                    >
                      {selectedUser.is_frozen ? "Frozen" : "Active"}
                    </Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground mb-2 block">Wallet Balances</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {selectedUser.wallets?.map((wallet: any) => (
                      <div key={wallet.wallet_type} className="p-3 rounded-lg bg-secondary/30">
                        <p className="text-xs text-muted-foreground capitalize">
                          {wallet.wallet_type.replace("_", " ")}
                        </p>
                        <p className="font-mono font-medium">
                          ${Number(wallet.balance).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Profile Dialog */}
        <Dialog open={editDialog} onOpenChange={setEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User Profile</DialogTitle>
              <DialogDescription>
                Update basic profile information for support purposes.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={editData.full_name}
                  onChange={(e) => setEditData(prev => ({ ...prev, full_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={editData.email}
                  disabled
                  className="bg-secondary/50"
                />
                <p className="text-xs text-muted-foreground">
                  Email changes require user verification and cannot be modified here.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => updateProfile.mutate({
                  userId: selectedUser.id,
                  updates: { full_name: editData.full_name },
                })}
                disabled={updateProfile.isPending}
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default StaffUserSupport;