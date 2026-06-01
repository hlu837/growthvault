import { useState } from "react";
import { format, addDays, addMonths } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Lock, AlertTriangle } from "lucide-react";
import { WalletType, walletDisplayNames } from "@/hooks/useWallets";
import { CreateVaultParams } from "@/hooks/useVaults";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CreateVaultModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (params: CreateVaultParams) => void;
  isLoading?: boolean;
}

const vaultTypes: { type: WalletType; label: string }[] = [
  { type: "prudent_saving", label: "Prudent Saving" },
  { type: "golden_saving", label: "Golden Saving" },
  { type: "projects_saving", label: "Projects Saving" },
  { type: "future_saving", label: "Future Saving" },
  { type: "loans_saving", label: "Loans Saving" },
];

const lockPeriodOptions = [
  { label: "30 Days", value: 30 },
  { label: "60 Days", value: 60 },
  { label: "90 Days", value: 90 },
  { label: "6 Months", value: 180 },
  { label: "1 Year", value: 365 },
  { label: "Custom", value: -1 },
];

const CreateVaultModal = ({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: CreateVaultModalProps) => {
  const { currencyInfo } = useCurrency();
  const [vaultName, setVaultName] = useState("");
  const [walletType, setWalletType] = useState<WalletType>("prudent_saving");
  const [targetAmount, setTargetAmount] = useState("");
  const [hasMaturity, setHasMaturity] = useState(true);
  const [lockPeriod, setLockPeriod] = useState<number>(90);
  const [customDate, setCustomDate] = useState<Date | undefined>();
  const [enableAutoSave, setEnableAutoSave] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<"daily" | "weekly" | "monthly">("monthly");
  const [recurringAmount, setRecurringAmount] = useState("");

  // Fetch admin-set early withdrawal penalty from system_settings
  const { data: adminPenalty = 10 } = useQuery({
    queryKey: ["system-early-withdrawal-penalty"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "early_withdrawal_penalty")
        .maybeSingle();
      if (error || !data) return 10;
      return data.setting_value || 10;
    },
  });

  const getMaturityDate = (): string | undefined => {
    if (!hasMaturity) return undefined;
    if (lockPeriod === -1 && customDate) {
      return customDate.toISOString();
    }
    if (lockPeriod > 0) {
      return addDays(new Date(), lockPeriod).toISOString();
    }
    return undefined;
  };

  const handleSubmit = () => {
    const params: CreateVaultParams = {
      wallet_type: walletType,
      vault_name: vaultName || `My ${walletDisplayNames[walletType]} Vault`,
      target_amount: targetAmount ? parseFloat(targetAmount) : undefined,
      maturity_date: getMaturityDate(),
      recurring_frequency: enableAutoSave ? recurringFrequency : "manual",
      recurring_amount: enableAutoSave ? parseFloat(recurringAmount) || 0 : 0,
      penalty_percentage: adminPenalty / 100,
    };
    onSubmit(params);
  };

  const resetForm = () => {
    setVaultName("");
    setWalletType("prudent_saving");
    setTargetAmount("");
    setHasMaturity(true);
    setLockPeriod(90);
    setCustomDate(undefined);
    setEnableAutoSave(false);
    setRecurringFrequency("monthly");
    setRecurringAmount("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-accent" />
            Create Smart Vault
          </DialogTitle>
          <DialogDescription>
            Set up a new savings vault with optional maturity lock and auto-save.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Vault Name */}
          <div className="space-y-2">
            <Label htmlFor="vault-name">Vault Name</Label>
            <Input
              id="vault-name"
              placeholder="e.g., Emergency Fund"
              value={vaultName}
              onChange={(e) => setVaultName(e.target.value)}
            />
          </div>

          {/* Vault Type */}
          <div className="space-y-2">
            <Label>Vault Type</Label>
            <Select value={walletType} onValueChange={(v) => setWalletType(v as WalletType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {vaultTypes.map((vt) => (
                  <SelectItem key={vt.type} value={vt.type}>
                    {vt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Target Amount */}
          <div className="space-y-2">
            <Label htmlFor="target-amount">Target Amount (optional)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{currencyInfo.symbol}</span>
              <Input
                id="target-amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={targetAmount}
                onChange={(e) => {
                  if (e.target.value === "" || /^\d*\.?\d{0,2}$/.test(e.target.value)) {
                    setTargetAmount(e.target.value);
                  }
                }}
                className="pl-7 font-mono"
              />
            </div>
          </div>

          {/* Maturity Lock */}
          <div className="p-4 rounded-lg bg-secondary/30 border border-border space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Enable Maturity Lock</Label>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Lock funds until maturity date with early withdrawal penalty
                </p>
              </div>
              <Switch checked={hasMaturity} onCheckedChange={setHasMaturity} />
            </div>

            {hasMaturity && (
              <>
                <div className="space-y-2">
                  <Label>Lock Period</Label>
                  <Select
                    value={lockPeriod.toString()}
                    onValueChange={(v) => setLockPeriod(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {lockPeriodOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value.toString()}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {lockPeriod === -1 && (
                  <div className="space-y-2">
                    <Label>Custom Maturity Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !customDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customDate ? format(customDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={customDate}
                          onSelect={setCustomDate}
                          disabled={(date) => date < addDays(new Date(), 1)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-warning">
                      Early Withdrawal Penalty: {adminPenalty}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Set by administrator. Applied if withdrawn before maturity.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Auto-Save */}
          <div className="p-4 rounded-lg bg-secondary/30 border border-border space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Enable Auto-Save</Label>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Automatically deposit to this vault on a schedule
                </p>
              </div>
              <Switch checked={enableAutoSave} onCheckedChange={setEnableAutoSave} />
            </div>

            {enableAutoSave && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select
                    value={recurringFrequency}
                    onValueChange={(v) => setRecurringFrequency(v as "daily" | "weekly" | "monthly")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{currencyInfo.symbol}</span>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={recurringAmount}
                      onChange={(e) => {
                        if (e.target.value === "" || /^\d*\.?\d{0,2}$/.test(e.target.value)) {
                          setRecurringAmount(e.target.value);
                        }
                      }}
                      className="pl-7 font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sticky bottom-0 bg-card border-t border-border pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading} className="sm:flex-1">
            {isLoading ? "Creating..." : "Create Vault"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateVaultModal;
