import { useState, useEffect } from "react";
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
import { Repeat } from "lucide-react";
import { SavingsVault } from "@/hooks/useVaults";

interface AutoSaveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vault: SavingsVault | null;
  onSubmit: (vaultId: string, frequency: string, amount: number) => void;
  isLoading?: boolean;
}

const AutoSaveModal = ({
  open,
  onOpenChange,
  vault,
  onSubmit,
  isLoading,
}: AutoSaveModalProps) => {
  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("monthly");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (vault) {
      const hasAutoSave = vault.recurring_frequency && vault.recurring_frequency !== "manual";
      setEnabled(hasAutoSave);
      setFrequency((vault.recurring_frequency as "daily" | "weekly" | "monthly") || "monthly");
      setAmount(vault.recurring_amount > 0 ? vault.recurring_amount.toString() : "");
    }
  }, [vault]);

  const handleSubmit = () => {
    if (!vault) return;
    onSubmit(
      vault.id,
      enabled ? frequency : "manual",
      enabled ? parseFloat(amount) || 0 : 0
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="w-5 h-5 text-accent" />
            Auto-Save Settings
          </DialogTitle>
          <DialogDescription>
            Configure automatic deposits to "{vault?.vault_name}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border">
            <div>
              <Label className="text-base">Enable Auto-Save</Label>
              <p className="text-sm text-muted-foreground mt-0.5">
                Automatically transfer from main wallet
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={frequency}
                  onValueChange={(v) => setFrequency(v as "daily" | "weekly" | "monthly")}
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
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => {
                      if (e.target.value === "" || /^\d*\.?\d{0,2}$/.test(e.target.value)) {
                        setAmount(e.target.value);
                      }
                    }}
                    className="pl-7 font-mono"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AutoSaveModal;
