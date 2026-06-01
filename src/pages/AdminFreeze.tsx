import { useState } from "react";
import { useTranslation } from "react-i18next";
import { 
  Power,
  AlertTriangle,
  RefreshCw,
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminFreeze = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [platformFrozen, setPlatformFrozen] = useState(false);
  const { t } = useTranslation();

  // Fetch freeze status
  const { isLoading } = useQuery({
    queryKey: ["freeze-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .eq("setting_key", "platform_withdrawals_frozen")
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      setPlatformFrozen(data?.setting_value === 1);
      return data;
    },
    enabled: isAdmin,
  });

  // Toggle freeze mutation
  const toggleFreeze = useMutation({
    mutationFn: async (freeze: boolean) => {
      const { error } = await supabase.rpc('update_system_setting', {
        p_setting_key: 'platform_withdrawals_frozen',
        p_new_value: freeze ? 1 : 0,
        p_reason: freeze ? 'Emergency freeze activated' : 'Platform unfrozen'
      });

      if (error) throw error;
    },
    onSuccess: (_, freeze) => {
      queryClient.invalidateQueries({ queryKey: ["freeze-status"] });
      toast.success(freeze ? "Platform FROZEN - All withdrawals blocked" : "Platform UNFROZEN - Withdrawals active");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update freeze status");
    },
  });

  const handleToggleFreeze = () => {
    const newValue = !platformFrozen;
    setPlatformFrozen(newValue);
    toggleFreeze.mutate(newValue);
  };

  if (!isAdmin) {
    return (
      <AdminLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{t("admin.accessOnly")}</h1>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 font-mono">
            <Power className="w-3 h-3" />
            {t("admin.freeze.header")}
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            {t("admin.freeze.title")}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {t("admin.freeze.subtitle")}
          </p>
        </div>

        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-red-400 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-red-400">{t("admin.freeze.criticalControl")}</p>
              <p className="text-slate-400">
                {t("admin.freeze.criticalDesc")}
              </p>
            </div>
          </div>
        </div>

        {/* Freeze Control */}
        <div className={`p-8 rounded-lg border-2 transition-all ${
          platformFrozen 
            ? "bg-red-950/30 border-red-500/50" 
            : "bg-emerald-950/30 border-emerald-500/50"
        }`}>
          <div className="flex flex-col items-center text-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
              platformFrozen ? "bg-red-500/20" : "bg-emerald-500/20"
            }`}>
              <Power className={`w-10 h-10 ${platformFrozen ? "text-red-500" : "text-emerald-500"}`} />
            </div>
            
            <h2 className={`text-2xl font-bold mb-2 ${platformFrozen ? "text-red-400" : "text-emerald-400"}`}>
              {platformFrozen ? t("admin.freeze.platformFrozen") : t("admin.freeze.platformActive")}
            </h2>
            
            <p className="text-slate-400 mb-6 max-w-md">
              {platformFrozen ? t("admin.freeze.frozenDesc") : t("admin.freeze.activeDesc")}
            </p>

            <div className="flex items-center gap-4">
              <span className={`text-sm font-medium ${platformFrozen ? "text-slate-400" : "text-emerald-400"}`}>
                {t("admin.freeze.active")}
              </span>
              <Switch
                checked={platformFrozen}
                onCheckedChange={handleToggleFreeze}
                disabled={isLoading || toggleFreeze.isPending}
                className="data-[state=checked]:bg-red-600"
              />
              <span className={`text-sm font-medium ${platformFrozen ? "text-red-400" : "text-slate-400"}`}>
                {t("admin.freeze.frozen")}
              </span>
            </div>

            {toggleFreeze.isPending && (
              <div className="flex items-center gap-2 mt-4 text-slate-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm">{t("admin.freeze.updating")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Status Log */}
        <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800">
          <h3 className="text-sm font-bold text-slate-300 mb-3">{t("admin.freeze.currentStatus")}</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">{t("admin.freeze.withdrawalSystem")}</span>
              <span className={platformFrozen ? "text-red-400" : "text-emerald-400"}>
                {platformFrozen ? t("admin.freeze.blocked") : t("admin.freeze.activeStatus")}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">{t("admin.freeze.depositsLabel")}</span>
              <span className="text-emerald-400">{t("admin.freeze.activeStatus")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">{t("admin.freeze.transfersLabel")}</span>
              <span className={platformFrozen ? "text-red-400" : "text-emerald-400"}>
                {platformFrozen ? t("admin.freeze.blocked") : t("admin.freeze.activeStatus")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminFreeze;
