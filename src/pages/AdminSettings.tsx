import { useState, useEffect } from "react";
import { Shield, Settings, Save, RefreshCw, AlertTriangle, Power, Building2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminSettings = () => {
  const { isSuperAdmin, isAdmin, role } = useAuth();
  const queryClient = useQueryClient();
  
  const [mlmRates, setMlmRates] = useState({
    mlm_level_1_rate: 5,
    mlm_level_2_rate: 3,
    mlm_level_3_rate: 2,
    mlm_level_4_rate: 1,
    mlm_level_5_rate: 0.5,
  });

  const [vaultApys, setVaultApys] = useState({
    prudent_vault_apy: 5,
    golden_vault_apy: 8,
    projects_vault_apy: 10,
    future_vault_apy: 12,
    loans_vault_apy: 6,
  });

  const [splitSettings, setSplitSettings] = useState({
    mlm_split: 50,
    investment_split: 50,
  });

  const [activeTab, setActiveTab] = useState("mlm");

  const [penaltySettings, setPenaltySettings] = useState({
    early_withdrawal_penalty: 10,
  });

  const [rolloverSettings, setRolloverSettings] = useState({
    withdrawal_payout_percent: 30,
    rollover_freeze_percent: 70,
    rollover_topup_growth: 20,
  });

  const [globalMultiplier, setGlobalMultiplier] = useState(1.0);

  const [platformFrozen, setPlatformFrozen] = useState(false);

  type BankCurrency = "usd" | "eur" | "ngn" | "gbp";
  const bankCurrencies: { id: BankCurrency; label: string; flag: string }[] = [
    { id: "usd", label: "USD", flag: "🇺🇸" },
    { id: "eur", label: "EUR", flag: "🇪🇺" },
    { id: "ngn", label: "NGN", flag: "🇳🇬" },
    { id: "gbp", label: "GBP", flag: "🇬🇧" },
  ];

  const [bankDetails, setBankDetails] = useState<Record<BankCurrency, {
    bank_name: string;
    bank_account_name: string;
    bank_account_number: string;
    bank_routing_number: string;
    bank_swift_code: string;
  }>>({
    usd: { bank_name: "", bank_account_name: "", bank_account_number: "", bank_routing_number: "", bank_swift_code: "" },
    eur: { bank_name: "", bank_account_name: "", bank_account_number: "", bank_routing_number: "", bank_swift_code: "" },
    ngn: { bank_name: "", bank_account_name: "", bank_account_number: "", bank_routing_number: "", bank_swift_code: "" },
    gbp: { bank_name: "", bank_account_name: "", bank_account_number: "", bank_routing_number: "", bank_swift_code: "" },
  });

  const [loanSettings, setLoanSettings] = useState({
    loan_interest_rate: 15,
    loan_max_amount: 5000,
    loan_default_penalty_rate: 2,
    loan_max_duration_months: 12,
    loan_min_credit_score: 50,
  });

  // Fetch current settings
  const { data: currentSettings, isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*");

      if (error) throw error;

      const settingsMap: Record<string, number> = {};
      data.forEach((s) => {
        settingsMap[s.setting_key] = Number(s.setting_value);
      });

      // Set MLM rates
      setMlmRates({
        mlm_level_1_rate: settingsMap.mlm_level_1_rate || 5,
        mlm_level_2_rate: settingsMap.mlm_level_2_rate || 3,
        mlm_level_3_rate: settingsMap.mlm_level_3_rate || 2,
        mlm_level_4_rate: settingsMap.mlm_level_4_rate || 1,
        mlm_level_5_rate: settingsMap.mlm_level_5_rate || 0.5,
      });

      // Set Vault APYs
      setVaultApys({
        prudent_vault_apy: settingsMap.prudent_vault_apy || 5,
        golden_vault_apy: settingsMap.golden_vault_apy || 8,
        projects_vault_apy: settingsMap.projects_vault_apy || 10,
        future_vault_apy: settingsMap.future_vault_apy || 12,
        loans_vault_apy: settingsMap.loans_vault_apy || 6,
      });

      // Set split settings
      setSplitSettings({
        mlm_split: settingsMap.mlm_split || 50,
        investment_split: settingsMap.investment_split || 50,
      });

      // Set penalty
      setPenaltySettings({
        early_withdrawal_penalty: settingsMap.early_withdrawal_penalty || 10,
      });

      // Set rollover settings
      setRolloverSettings({
        withdrawal_payout_percent: settingsMap.withdrawal_payout_percent || 30,
        rollover_freeze_percent: settingsMap.rollover_freeze_percent || 70,
        rollover_topup_growth: settingsMap.rollover_topup_growth || 20,
      });

      // Set global multiplier
      setGlobalMultiplier(settingsMap.global_apy_multiplier ?? 1.0);

      // Set platform freeze
      setPlatformFrozen(settingsMap.platform_withdrawals_frozen === 1);

      // Set bank details from description field per currency
      const descMap: Record<string, string> = {};
      data.forEach((s) => {
        descMap[s.setting_key] = s.description || "";
      });
      const loadBank = (cur: string) => ({
        bank_name: descMap[`bank_name_${cur}`] || "",
        bank_account_name: descMap[`bank_account_name_${cur}`] || "",
        bank_account_number: descMap[`bank_account_number_${cur}`] || "",
        bank_routing_number: descMap[`bank_routing_number_${cur}`] || "",
        bank_swift_code: descMap[`bank_swift_code_${cur}`] || "",
      });
      setBankDetails({
        usd: loadBank("usd"),
        eur: loadBank("eur"),
        ngn: loadBank("ngn"),
        gbp: loadBank("gbp"),
      });

      // Set loan settings
      setLoanSettings({
        loan_interest_rate: settingsMap.loan_interest_rate || 15,
        loan_max_amount: settingsMap.loan_max_amount || 5000,
        loan_default_penalty_rate: settingsMap.loan_default_penalty_rate || 2,
        loan_max_duration_months: settingsMap.loan_max_duration_months || 12,
        loan_min_credit_score: settingsMap.loan_min_credit_score || 50,
      });

      return settingsMap;
    },
    enabled: isAdmin,
  });

  // Update settings mutation
  const updateSettings = useMutation({
    mutationFn: async (settings: Record<string, number>) => {
      const updates = Object.entries(settings).map(([key, value]) => 
        supabase.rpc('update_system_setting', {
          p_setting_key: key,
          p_new_value: value,
          p_reason: 'Admin settings update'
        })
      );

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw new Error(errors[0].error?.message || 'Failed to update settings');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      toast.success("Settings updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update settings");
    },
  });

  const handleSaveMLMRates = () => {
    updateSettings.mutate(mlmRates);
  };

  const handleSaveVaultAPYs = () => {
    updateSettings.mutate(vaultApys);
  };

  const handleSaveSplit = () => {
    if (splitSettings.mlm_split + splitSettings.investment_split !== 100) {
      toast.error("MLM and Investment split must add up to 100%");
      return;
    }
    updateSettings.mutate(splitSettings);
  };

  const handleSavePenalty = () => {
    updateSettings.mutate(penaltySettings);
  };

  const handleSaveRollover = () => {
    if (rolloverSettings.withdrawal_payout_percent + rolloverSettings.rollover_freeze_percent !== 100) {
      toast.error("Payout and rollover freeze must add up to 100%");
      return;
    }
    updateSettings.mutate(rolloverSettings);
  };

  const handleToggleFreeze = () => {
    const newValue = !platformFrozen;
    setPlatformFrozen(newValue);
    updateSettings.mutate({ platform_withdrawals_frozen: newValue ? 1 : 0 });
  };

  const handleSaveMultiplier = () => {
    if (globalMultiplier < 0 || globalMultiplier > 5) {
      toast.error("Multiplier must be between 0 and 5");
      return;
    }
    updateSettings.mutate({ global_apy_multiplier: globalMultiplier });
  };

  const handleSaveBankDetails = (cur: string) => {
    const details = bankDetails[cur as keyof typeof bankDetails];
    if (!details.bank_name || !details.bank_account_name || !details.bank_account_number) {
      toast.error("Bank name, account name and account number are required");
      return;
    }

    const upserts = Object.entries(details).flatMap(([key, value]) => {
      const valueString = value as string;
      return [
        { setting_key: `${key}_${cur}`, setting_value: 0, description: valueString },
        { setting_key: `${key}`, setting_value: 0, description: valueString },
      ];
    }).map(({ setting_key, setting_value, description }) =>
      supabase
        .from("system_settings")
        .upsert({ setting_key, setting_value, description }, { onConflict: 'setting_key' })
    );

    Promise.all(upserts).then((results) => {
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        const errMsg = errors[0].error?.message || "Failed to save bank details";
        toast.error(errMsg);
      } else {
        queryClient.invalidateQueries({ queryKey: ["system-settings"] });
        toast.success(`${cur.toUpperCase()} bank details saved successfully`);
      }
    });
  };

  const handleSaveLoanSettings = () => {
    updateSettings.mutate(loanSettings);
  };

  if (!isSuperAdmin && role !== "super_admin") {
    return (
      <AdminLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Super Admin Access Only</h1>
          <p className="text-sm text-slate-400">Your role: {role || "unknown"}</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Shield className="w-4 h-4" />
            Admin Panel
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            System Configuration
          </h1>
          <p className="text-muted-foreground mt-1">
            Control the financial parameters of the platform.
          </p>
        </div>

        {/* Global Freeze Switch */}
        <Card className={platformFrozen ? "border-destructive bg-destructive/5" : "border-accent bg-accent/5"}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  platformFrozen ? "bg-destructive/20" : "bg-accent/20"
                }`}>
                  <Power className={`w-6 h-6 ${platformFrozen ? "text-destructive" : "text-accent"}`} />
                </div>
                <div>
                  <h3 className="font-semibold">Platform Withdrawals</h3>
                  <p className="text-sm text-muted-foreground">
                    {platformFrozen 
                      ? "All withdrawals are currently FROZEN" 
                      : "Withdrawals are currently active"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-medium ${platformFrozen ? "text-destructive" : "text-accent"}`}>
                  {platformFrozen ? "FROZEN" : "ACTIVE"}
                </span>
                <Switch
                  checked={!platformFrozen}
                  onCheckedChange={() => handleToggleFreeze()}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-secondary/30 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="block lg:hidden">
              <Label htmlFor="admin-settings-tab">Settings Section</Label>
              <select
                id="admin-settings-tab"
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value)}
                className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="bank">Bank Details</option>
                <option value="mlm">MLM Rates</option>
                <option value="vaults">Vault APY</option>
                <option value="split">Split</option>
                <option value="rollover">Rollover</option>
                <option value="penalty">Penalties</option>
                <option value="loans">Loans</option>
                <option value="global">Global</option>
              </select>
            </div>

            <TabsList className="hidden lg:grid w-full grid-cols-4 md:grid-cols-8">
              <TabsTrigger value="bank">Bank Settings</TabsTrigger>
              <TabsTrigger value="mlm">MLM Rates</TabsTrigger>
              <TabsTrigger value="vaults">Vault APY</TabsTrigger>
              <TabsTrigger value="split">Split</TabsTrigger>
              <TabsTrigger value="rollover">Rollover</TabsTrigger>
              <TabsTrigger value="penalty">Penalties</TabsTrigger>
              <TabsTrigger value="loans">Loans</TabsTrigger>
              <TabsTrigger value="global">Global</TabsTrigger>
            </TabsList>

            {/* Bank Details Tab */}
            <TabsContent value="bank">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-primary" />
                    <CardTitle>Deposit Bank Accounts</CardTitle>
                  </div>
                  <CardDescription>
                    Configure bank details for each supported currency. Users will see the matching account based on their selected currency.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="usd">
                    <TabsList className="mb-6">
                      {bankCurrencies.map((cur) => (
                        <TabsTrigger key={cur.id} value={cur.id} className="gap-1.5">
                          <span>{cur.flag}</span> {cur.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {bankCurrencies.map((cur) => (
                      <TabsContent key={cur.id} value={cur.id} className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label>Bank Name *</Label>
                            <Input
                              placeholder="e.g. First National Bank"
                              value={bankDetails[cur.id].bank_name}
                              onChange={(e) => setBankDetails(prev => ({
                                ...prev,
                                [cur.id]: { ...prev[cur.id], bank_name: e.target.value }
                              }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Account Name *</Label>
                            <Input
                              placeholder="e.g. VaultGrowth Holdings Ltd"
                              value={bankDetails[cur.id].bank_account_name}
                              onChange={(e) => setBankDetails(prev => ({
                                ...prev,
                                [cur.id]: { ...prev[cur.id], bank_account_name: e.target.value }
                              }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Account Number *</Label>
                            <Input
                              placeholder="e.g. 1234567890"
                              value={bankDetails[cur.id].bank_account_number}
                              onChange={(e) => setBankDetails(prev => ({
                                ...prev,
                                [cur.id]: { ...prev[cur.id], bank_account_number: e.target.value }
                              }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Routing / Sort Code</Label>
                            <Input
                              placeholder="e.g. 987654321"
                              value={bankDetails[cur.id].bank_routing_number}
                              onChange={(e) => setBankDetails(prev => ({
                                ...prev,
                                [cur.id]: { ...prev[cur.id], bank_routing_number: e.target.value }
                              }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>SWIFT/BIC Code</Label>
                            <Input
                              placeholder="e.g. FNBKZA33"
                              value={bankDetails[cur.id].bank_swift_code}
                              onChange={(e) => setBankDetails(prev => ({
                                ...prev,
                                [cur.id]: { ...prev[cur.id], bank_swift_code: e.target.value }
                              }))}
                            />
                          </div>
                        </div>
                        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">Note:</span> Users investing in {cur.label} will see these bank details. Ensure they are correct before saving.
                          </p>
                        </div>
                        <Button onClick={() => handleSaveBankDetails(cur.id)} disabled={updateSettings.isPending}>
                          <Save className="w-4 h-4 mr-2" /> Save {cur.label} Bank Details
                        </Button>
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>
              </Card>
            </TabsContent>

            {/* MLM Rates Tab */}
            <TabsContent value="mlm">
              <Card>
                <CardHeader>
                  <CardTitle>MLM Commission Rates</CardTitle>
                  <CardDescription>
                    Set the referral commission percentage for each level of the MLM structure.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {[1, 2, 3, 4, 5].map((level) => {
                    const key = `mlm_level_${level}_rate` as keyof typeof mlmRates;
                    return (
                      <div key={level} className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="font-mono font-bold text-sm">{level}</span>
                          </div>
                          <Label>Level {level} Commission</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={mlmRates[key]}
                            onChange={(e) => setMlmRates(prev => ({ 
                              ...prev, 
                              [key]: Number(e.target.value) 
                            }))}
                            className="w-24 text-right"
                          />
                          <span className="text-muted-foreground">%</span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="pt-4 border-t">
                    <Button onClick={handleSaveMLMRates} disabled={updateSettings.isPending}>
                      {updateSettings.isPending ? (
                        <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                      ) : (
                        <><Save className="w-4 h-4 mr-2" /> Save MLM Rates</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Vault APY Tab */}
            <TabsContent value="vaults">
              <Card>
                <CardHeader>
                  <CardTitle>Vault Interest Rates (APY)</CardTitle>
                  <CardDescription>
                    Set the annual percentage yield for each savings vault type.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {[
                    { key: "prudent_vault_apy", label: "Prudent Saving" },
                    { key: "golden_vault_apy", label: "Golden Saving" },
                    { key: "projects_vault_apy", label: "Projects Saving" },
                    { key: "future_vault_apy", label: "Future Saving" },
                    { key: "loans_vault_apy", label: "Loans Saving" },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between gap-4">
                      <Label>{label}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={vaultApys[key as keyof typeof vaultApys]}
                          onChange={(e) => setVaultApys(prev => ({ 
                            ...prev, 
                            [key]: Number(e.target.value) 
                          }))}
                          className="w-24 text-right"
                        />
                        <span className="text-muted-foreground">% APY</span>
                      </div>
                    </div>
                  ))}
                  <div className="pt-4 border-t">
                    <Button onClick={handleSaveVaultAPYs} disabled={updateSettings.isPending}>
                      {updateSettings.isPending ? (
                        <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                      ) : (
                        <><Save className="w-4 h-4 mr-2" /> Save Vault APYs</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Investment Split Tab */}
            <TabsContent value="split">
              <Card>
                <CardHeader>
                  <CardTitle>Investment Capital Split</CardTitle>
                  <CardDescription>
                    Configure how new investments are split between MLM capital and investment principal. Must total 100%.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="mlm_split">MLM Capital (%)</Label>
                      <Input
                        id="mlm_split"
                        type="number"
                        min="0"
                        max="100"
                        value={splitSettings.mlm_split}
                        onChange={(e) => {
                          const mlm = Number(e.target.value);
                          setSplitSettings({
                            mlm_split: mlm,
                            investment_split: 100 - mlm,
                          });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="investment_split">Investment Principal (%)</Label>
                      <Input
                        id="investment_split"
                        type="number"
                        min="0"
                        max="100"
                        value={splitSettings.investment_split}
                        onChange={(e) => {
                          const investment = Number(e.target.value);
                          setSplitSettings({
                            investment_split: investment,
                            mlm_split: 100 - investment,
                          });
                        }}
                      />
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-secondary/30">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Split:</span>
                      <span className={splitSettings.mlm_split + splitSettings.investment_split === 100 ? "text-accent" : "text-destructive"}>
                        {splitSettings.mlm_split + splitSettings.investment_split}%
                      </span>
                    </div>
                  </div>
                  <Button onClick={handleSaveSplit} disabled={updateSettings.isPending}>
                    {updateSettings.isPending ? (
                      <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                    ) : (
                      <><Save className="w-4 h-4 mr-2" /> Save Split Settings</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Rollover & Withdrawal Tab */}
            <TabsContent value="rollover">
              <Card>
                <CardHeader>
                  <CardTitle>Withdrawal & Rollover Structure</CardTitle>
                  <CardDescription>
                    Configure the controlled withdrawal and automatic rollover mechanism for system stability.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="withdrawal_payout">Withdrawal Payout (%)</Label>
                      <p className="text-xs text-muted-foreground">
                        Percentage of earnings investors can withdraw at level completion
                      </p>
                      <Input
                        id="withdrawal_payout"
                        type="number"
                        min="0"
                        max="100"
                        value={rolloverSettings.withdrawal_payout_percent}
                        onChange={(e) => {
                          const payout = Number(e.target.value);
                          setRolloverSettings(prev => ({
                            ...prev,
                            withdrawal_payout_percent: payout,
                            rollover_freeze_percent: 100 - payout,
                          }));
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rollover_freeze">Rollover Freeze (%)</Label>
                      <p className="text-xs text-muted-foreground">
                        Percentage frozen and rolled into a new cycle or upgraded plan
                      </p>
                      <Input
                        id="rollover_freeze"
                        type="number"
                        min="0"
                        max="100"
                        value={rolloverSettings.rollover_freeze_percent}
                        onChange={(e) => {
                          const freeze = Number(e.target.value);
                          setRolloverSettings(prev => ({
                            ...prev,
                            rollover_freeze_percent: freeze,
                            withdrawal_payout_percent: 100 - freeze,
                          }));
                        }}
                      />
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-secondary/30">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Split:</span>
                      <span className={rolloverSettings.withdrawal_payout_percent + rolloverSettings.rollover_freeze_percent === 100 ? "text-accent" : "text-destructive"}>
                        {rolloverSettings.withdrawal_payout_percent + rolloverSettings.rollover_freeze_percent}%
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="topup_growth">Top-Up Growth Increment (%)</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatic growth increment applied to balance after each rollover cycle
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        id="topup_growth"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={rolloverSettings.rollover_topup_growth}
                        onChange={(e) => setRolloverSettings(prev => ({
                          ...prev,
                          rollover_topup_growth: Number(e.target.value),
                        }))}
                        className="w-24 text-right"
                      />
                      <span className="text-muted-foreground">%</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="text-sm space-y-1">
                      <p className="font-medium">Structure Summary</p>
                      <p className="text-muted-foreground">
                        At level completion: <span className="font-mono font-semibold text-foreground">{rolloverSettings.withdrawal_payout_percent}%</span> paid out, <span className="font-mono font-semibold text-foreground">{rolloverSettings.rollover_freeze_percent}%</span> frozen & rolled over with <span className="font-mono font-semibold text-foreground">{rolloverSettings.rollover_topup_growth}%</span> top-up growth.
                      </p>
                    </div>
                  </div>

                  <Button onClick={handleSaveRollover} disabled={updateSettings.isPending}>
                    {updateSettings.isPending ? (
                      <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                    ) : (
                      <><Save className="w-4 h-4 mr-2" /> Save Rollover Settings</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Penalty Tab */}
            <TabsContent value="penalty">
              <Card>
                <CardHeader>
                  <CardTitle>Early Withdrawal Penalty</CardTitle>
                  <CardDescription>
                    Set the percentage charged when users withdraw from vaults before maturity.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label>Penalty Rate</Label>
                      <p className="text-sm text-muted-foreground">
                        Deducted from vault balance for early withdrawals
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={penaltySettings.early_withdrawal_penalty}
                        onChange={(e) => setPenaltySettings({ 
                          early_withdrawal_penalty: Number(e.target.value) 
                        })}
                        className="w-24 text-right"
                      />
                      <span className="text-muted-foreground">%</span>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-warning">Important</p>
                        <p className="text-muted-foreground">
                          This penalty is collected as platform revenue when users withdraw before their vault matures.
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button onClick={handleSavePenalty} disabled={updateSettings.isPending}>
                    {updateSettings.isPending ? (
                      <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                    ) : (
                      <><Save className="w-4 h-4 mr-2" /> Save Penalty Settings</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Loan Settings Tab */}
            <TabsContent value="loans">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary" />
                    <CardTitle>Loan Configuration</CardTitle>
                  </div>
                  <CardDescription>
                    Set loan interest rates, limits, penalties, and eligibility criteria.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {[
                    { key: "loan_interest_rate", label: "Annual Interest Rate", suffix: "%", desc: "Interest charged on loans per year" },
                    { key: "loan_max_amount", label: "Maximum Loan Amount", suffix: "USD", desc: "Maximum amount a member can borrow" },
                    { key: "loan_default_penalty_rate", label: "Default Penalty Rate", suffix: "% / week", desc: "Weekly penalty on overdue loans" },
                    { key: "loan_max_duration_months", label: "Max Loan Duration", suffix: "months", desc: "Maximum repayment period" },
                    { key: "loan_min_credit_score", label: "Min Credit Score", suffix: "pts", desc: "Minimum risk score required for eligibility" },
                  ].map(({ key, label, suffix, desc }) => (
                    <div key={key} className="flex items-center justify-between gap-4">
                      <div>
                        <Label>{label}</Label>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.1"
                          value={loanSettings[key as keyof typeof loanSettings]}
                          onChange={(e) => setLoanSettings(prev => ({
                            ...prev,
                            [key]: Number(e.target.value),
                          }))}
                          className="w-28 text-right"
                        />
                        <span className="text-muted-foreground text-sm w-16">{suffix}</span>
                      </div>
                    </div>
                  ))}
                  <Button onClick={handleSaveLoanSettings} disabled={updateSettings.isPending}>
                    {updateSettings.isPending ? (
                      <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                    ) : (
                      <><Save className="w-4 h-4 mr-2" /> Save Loan Settings</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Global Controls Tab */}
            <TabsContent value="global">
              <Card>
                <CardHeader>
                  <CardTitle>Global Interest Rate Multiplier</CardTitle>
                  <CardDescription>
                    Apply a global multiplier to all vault APY rates. Use this to quickly adjust yields across all vault types when market conditions change.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label>APY Multiplier</Label>
                      <p className="text-sm text-muted-foreground">
                        All vault APY rates will be multiplied by this factor (1.0 = no change)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="5"
                        step="0.01"
                        value={globalMultiplier}
                        onChange={(e) => setGlobalMultiplier(Number(e.target.value))}
                        className="w-24 text-right font-mono"
                      />
                      <span className="text-muted-foreground font-mono">×</span>
                    </div>
                  </div>

                  {/* Preview of effective rates */}
                  <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                    <p className="text-sm font-medium mb-3">Effective APY Preview</p>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { label: "Prudent", base: vaultApys.prudent_vault_apy },
                        { label: "Golden", base: vaultApys.golden_vault_apy },
                        { label: "Projects", base: vaultApys.projects_vault_apy },
                        { label: "Future", base: vaultApys.future_vault_apy },
                        { label: "Loans", base: vaultApys.loans_vault_apy },
                      ].map((item) => (
                        <div key={item.label} className="text-center p-2 rounded bg-secondary/50">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</div>
                          <div className="font-mono text-sm">
                            <span className="text-muted-foreground line-through mr-1">{item.base}%</span>
                          </div>
                          <div className="font-mono font-bold text-accent">
                            {(item.base * globalMultiplier).toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {globalMultiplier !== 1.0 && (
                    <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-warning">Active Multiplier</p>
                          <p className="text-muted-foreground">
                            {globalMultiplier > 1 
                              ? `All APY rates are boosted by ${((globalMultiplier - 1) * 100).toFixed(0)}%` 
                              : `All APY rates are reduced by ${((1 - globalMultiplier) * 100).toFixed(0)}%`}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button onClick={handleSaveMultiplier} disabled={updateSettings.isPending}>
                    {updateSettings.isPending ? (
                      <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                    ) : (
                      <><Save className="w-4 h-4 mr-2" /> Save Multiplier</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;