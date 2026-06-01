import { useState, useEffect } from "react";
import { Shield, Save, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const defaultLoanSettings: Record<string, number> = {
  loan_interest_rate: 10,
  loan_max_amount: 50000,
  loan_max_duration_months: 36,
  loan_grace_period_days: 7,
  loan_late_penalty_percent: 5,
  loan_min_surety_coverage: 120,
  loan_auto_approve_threshold: 80,
  loan_manual_review_threshold: 60,
  loan_max_debt_to_income: 40,
  loan_default_recovery_percent: 100,
};

const settingLabels: Record<string, { label: string; desc: string; suffix: string }> = {
  loan_interest_rate: { label: "Interest Rate", desc: "Annual interest rate applied to all loans", suffix: "%" },
  loan_max_amount: { label: "Max Loan Amount", desc: "Maximum amount a member can borrow", suffix: "$" },
  loan_max_duration_months: { label: "Max Duration", desc: "Maximum loan repayment period", suffix: "months" },
  loan_grace_period_days: { label: "Grace Period", desc: "Days after due date before penalty applies", suffix: "days" },
  loan_late_penalty_percent: { label: "Late Payment Penalty", desc: "Additional charge for late payments", suffix: "%" },
  loan_min_surety_coverage: { label: "Min Surety Coverage", desc: "Minimum surety coverage as % of loan amount", suffix: "%" },
  loan_auto_approve_threshold: { label: "Auto-Approve Score", desc: "Risk score at or above which loans are auto-approved", suffix: "pts" },
  loan_manual_review_threshold: { label: "Manual Review Score", desc: "Minimum score for manual review (below = reject)", suffix: "pts" },
  loan_max_debt_to_income: { label: "Max Debt-to-Income", desc: "Maximum monthly repayment as % of income", suffix: "%" },
  loan_default_recovery_percent: { label: "Default Recovery Target", desc: "Target recovery % from defaulted loans", suffix: "%" },
};

const AdminLoanSettings = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<Record<string, number>>(defaultLoanSettings);

  const { data: currentSettings, isLoading } = useQuery({
    queryKey: ["system-settings", "loan"],
    queryFn: async () => {
      const { data, error } = await supabase.from("system_settings").select("*");
      if (error) throw error;
      const map: Record<string, number> = {};
      data.forEach((s) => { map[s.setting_key] = Number(s.setting_value); });
      const merged = { ...defaultLoanSettings };
      Object.keys(merged).forEach((k) => { if (map[k] !== undefined) merged[k] = map[k]; });
      setSettings(merged);
      return merged;
    },
    enabled: isAdmin,
  });

  const updateSettings = useMutation({
    mutationFn: async (toSave: Record<string, number>) => {
      const updates = Object.entries(toSave).map(([key, value]) =>
        supabase.rpc("update_system_setting", {
          p_setting_key: key,
          p_new_value: value,
          p_reason: "Loan policy settings update",
        })
      );
      const results = await Promise.all(updates);
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) throw new Error(errors[0].error?.message || "Failed to update");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      toast.success("Loan policy settings saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <AdminLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <p className="text-muted-foreground">Admin access only</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Shield className="w-4 h-4" /> Admin Panel
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Loan Policy Settings</h1>
          <p className="text-muted-foreground mt-1">Configure interest rates, limits, penalties, and risk thresholds.</p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-secondary/30 animate-pulse rounded-lg" />)}
          </div>
        ) : (
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Policy Parameters</CardTitle>
              <CardDescription>All changes take effect immediately for new loan applications.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(settingLabels).map(([key, { label, desc, suffix }]) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">{label}</Label>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {suffix === "$" && <span className="text-muted-foreground text-sm">$</span>}
                    <Input
                      type="number"
                      value={settings[key]}
                      onChange={(e) => setSettings((p) => ({ ...p, [key]: Number(e.target.value) }))}
                      className="w-28 text-right"
                    />
                    {suffix !== "$" && <span className="text-muted-foreground text-sm w-12">{suffix}</span>}
                  </div>
                </div>
              ))}
              <div className="pt-4 border-t border-border">
                <Button onClick={() => updateSettings.mutate(settings)} disabled={updateSettings.isPending}>
                  {updateSettings.isPending ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="w-4 h-4 mr-2" /> Save Loan Policy</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminLoanSettings;
