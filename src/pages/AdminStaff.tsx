import { useState } from "react";
import { 
  Users,
  Search,
  AlertTriangle,
  Loader2,
  Shield,
  UserPlus,
  UserMinus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminStaff = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all users with roles
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-staff-management"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const usersWithRoles = await Promise.all(
        profiles.map(async (profile) => {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", profile.id);

          return {
            ...profile,
            role: roles?.[0]?.role || "member",
          };
        })
      );

      return usersWithRoles;
    },
    enabled: isAdmin,
  });

  // Update role mutation
  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "staff" | "member" }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ role })
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-staff-management"] });
      toast.success("Role updated");
    },
    onError: () => {
      toast.error("Failed to update role");
    },
  });

  const staffMembers = users?.filter(u => u.role === "staff") || [];
  const regularMembers = users?.filter(u => u.role === "member") || [];

  const filteredStaff = staffMembers.filter((user) => {
    const matchesSearch = 
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const filteredMembers = regularMembers.filter((user) => {
    const matchesSearch = 
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

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
            <Users className="w-3 h-3" />
            STAFF MANAGEMENT
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Manage Staff Accounts
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Only admins can hire (create) or fire (delete) staff accounts.
          </p>
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

        {/* Current Staff */}
        <div className="bg-slate-950/50 border border-slate-800 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-300">Current Staff ({staffMembers.length})</h2>
            <Badge variant="outline" className="text-cyan-400 border-cyan-500/30">OPERATORS</Badge>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-red-400 animate-spin" />
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No staff members</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {filteredStaff.map((user) => (
                <div 
                  key={user.id}
                  className="p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <div className="font-medium text-white">{user.full_name || "Unknown"}</div>
                      <div className="text-sm text-slate-500">{user.email}</div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                    onClick={() => updateRole.mutate({ userId: user.id, role: "member" })}
                    disabled={updateRole.isPending}
                  >
                    <UserMinus className="w-4 h-4 mr-1" />
                    Remove Staff
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Regular Members - Can Promote */}
        <div className="bg-slate-950/50 border border-slate-800 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-300">Members ({regularMembers.length})</h2>
            <Badge variant="outline" className="text-slate-400 border-slate-700">USERS</Badge>
          </div>
          
          {filteredMembers.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No members found
            </div>
          ) : (
            <div className="divide-y divide-slate-800 max-h-96 overflow-y-auto">
              {filteredMembers.slice(0, 20).map((user) => (
                <div 
                  key={user.id}
                  className="p-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="font-medium text-white">{user.full_name || "Unknown"}</div>
                    <div className="text-sm text-slate-500">{user.email}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                    onClick={() => updateRole.mutate({ userId: user.id, role: "staff" })}
                    disabled={updateRole.isPending}
                  >
                    <UserPlus className="w-4 h-4 mr-1" />
                    Promote to Staff
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminStaff;
