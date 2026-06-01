import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Lock, Unlock, Plus, Minus, Settings, Repeat, Trash2, TrendingUp, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SavingsVault,
  getDaysUntilMaturity,
  getMaturityProgress,
  isVaultMatured,
  WithdrawResult,
  getVaultAPY,
  getDailyProfit,
  getTotalAccruedProfit,
  getMaturityPayout,
  useGlobalAPYMultiplier,
} from "@/hooks/useVaults";
import { walletDisplayNames } from "@/hooks/useWallets";
import { useCurrency } from "@/contexts/CurrencyContext";
import EarlyWithdrawalModal from "./EarlyWithdrawalModal";

interface VaultCardProps {
  vault: SavingsVault;
  onDeposit: (vaultId: string, amount: number) => Promise<void>;
  onWithdraw: (vaultId: string, forceEarly?: boolean) => Promise<WithdrawResult>;
  onDelete: (vaultId: string) => void;
  onEditAutoSave: (vault: SavingsVault) => void;
  isDepositing?: boolean;
  isWithdrawing?: boolean;
}

const VaultCard = ({
  vault,
  onDeposit,
  onWithdraw,
  onDelete,
  onEditAutoSave,
  isDepositing,
  isWithdrawing,
}: VaultCardProps) => {
  const [action, setAction] = useState<"deposit" | null>(null);
  const [amount, setAmount] = useState("");
  const [pendingWithdraw, setPendingWithdraw] = useState<WithdrawResult | null>(null);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const { formatAmount, currencyInfo, convert, rates, currency } = useCurrency();
  const { data: multiplier = 1.0 } = useGlobalAPYMultiplier();

  const matured = isVaultMatured(vault.maturity_date);
  const daysRemaining = getDaysUntilMaturity(vault.maturity_date);
  const progress = getMaturityProgress(vault.created_at, vault.maturity_date);
  const apy = getVaultAPY(vault.wallet_type, multiplier);
  const dailyProfit = getDailyProfit(vault.balance, vault.wallet_type, multiplier);
  const totalProfit = getTotalAccruedProfit(vault.balance, vault.wallet_type, vault.created_at, multiplier);
  const maturityPayout = getMaturityPayout(vault.balance, vault.wallet_type, vault.created_at, vault.maturity_date, multiplier);

  // Convert amount from current currency back to USD
  const convertToUSD = (localAmount: number): number => {
    if (currency === "USD") return localAmount;
    const rate = rates[currency] || 1;
    return localAmount / rate;
  };

  const handleDeposit = async () => {
    const numAmount = parseFloat(amount);
    if (numAmount > 0) {
      const usdAmount = convertToUSD(numAmount);
      await onDeposit(vault.id, usdAmount);
      setAmount("");
      setAction(null);
    }
  };

  const handleWithdrawClick = async () => {
    if (vault.balance <= 0) return;

    const result = await onWithdraw(vault.id, false);

    if (result.requires_confirmation && result.is_early) {
      setPendingWithdraw(result);
      setShowPenaltyModal(true);
    }
  };

  const handleConfirmEarlyWithdraw = async () => {
    await onWithdraw(vault.id, true);
    setShowPenaltyModal(false);
    setPendingWithdraw(null);
  };

  const frequencyLabels: Record<string, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    manual: "Manual",
  };

  return (
    <>
      <div className="p-5 rounded-xl border border-border bg-card hover:border-muted-foreground/30 transition-all">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                matured ? "bg-accent/20" : "bg-warning/20"
              }`}
            >
              {matured ? (
                <Unlock className="w-5 h-5 text-accent" />
              ) : (
                <Lock className="w-5 h-5 text-warning" />
              )}
            </div>
            <div>
              <h3 className="font-semibold">{vault.vault_name}</h3>
              <p className="text-xs text-muted-foreground">
                {walletDisplayNames[vault.wallet_type]}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEditAutoSave(vault)}>
                <Repeat className="w-4 h-4 mr-2" />
                Edit Auto-Save
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(vault.id)}
                className="text-destructive focus:text-destructive"
                disabled={vault.balance > 0}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Vault
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Balance & APY */}
        <div className="mb-4">
          <div className="text-2xl font-bold font-mono">
            {formatAmount(vault.balance)}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs font-mono text-accent border-accent/30 bg-accent/10">
              {(apy * 100).toFixed(0)}% APY
            </Badge>
            {vault.target_amount && vault.target_amount > 0 && (
              <span className="text-xs text-muted-foreground">
                Target: {formatAmount(vault.target_amount)}
              </span>
            )}
          </div>
        </div>

        {/* Profit Display */}
        {vault.balance > 0 && (
          <div className="mb-4 grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-lg bg-accent/5 border border-accent/10">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3 h-3 text-accent" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Est. Daily</span>
              </div>
              <div className="font-mono font-semibold text-sm text-accent">
                +{formatAmount(dailyProfit)}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-accent/5 border border-accent/10">
              <div className="flex items-center gap-1.5 mb-1">
                <Coins className="w-3 h-3 text-accent" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Earned</span>
              </div>
              <div className="font-mono font-semibold text-sm text-accent">
                +{formatAmount(totalProfit)}
              </div>
            </div>
          </div>
        )}

        {/* Maturity Progress */}
        {vault.maturity_date && (
          <div className="mb-4 p-3 rounded-lg bg-secondary/30 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Maturity Progress</span>
              <Badge variant={matured ? "default" : "secondary"} className="text-xs">
                {matured ? "Matured" : `${daysRemaining} days left`}
              </Badge>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>Created {format(new Date(vault.created_at), "MMM d, yyyy")}</span>
              <span className="font-mono">
                {format(new Date(vault.maturity_date), "MMM d, yyyy")}
              </span>
            </div>
          </div>
        )}

        {/* Auto-Save Badge */}
        {vault.recurring_frequency && vault.recurring_frequency !== "manual" && (
          <div className="mb-4 flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Repeat className="w-3 h-3" />
              {frequencyLabels[vault.recurring_frequency]} · {formatAmount(vault.recurring_amount)}
            </Badge>
          </div>
        )}

        {/* Deposit Form */}
        {action === "deposit" && (
          <div className="mb-4 p-3 rounded-lg bg-secondary/50 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{currencyInfo.symbol}</span>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => {
                  if (e.target.value === "" || /^\d*\.?\d{0,2}$/.test(e.target.value)) {
                    setAmount(e.target.value);
                  }
                }}
                className="flex-1 font-mono"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={handleDeposit}
                disabled={isDepositing || !amount}
              >
                {isDepositing ? "Processing..." : "Confirm Deposit"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAction(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant={action === "deposit" ? "default" : "secondary"}
            size="sm"
            className="flex-1 gap-1"
            onClick={() => setAction(action === "deposit" ? null : "deposit")}
          >
            <Plus className="w-3 h-3" />
            Deposit
          </Button>
          <Button
            variant={matured ? "default" : "outline"}
            size="sm"
            className={`flex-1 gap-1 ${matured ? "bg-accent hover:bg-accent/90" : ""}`}
            onClick={handleWithdrawClick}
            disabled={isWithdrawing || vault.balance <= 0}
          >
            <Minus className="w-3 h-3" />
            {matured ? "Withdraw (0% Fee)" : "Withdraw (Penalty)"}
          </Button>
        </div>

        {/* Status Info */}
        {matured && vault.balance > 0 && vault.maturity_date && (
          <div className="mt-3 p-2.5 rounded-lg bg-accent/10 border border-accent/20 text-center">
            <Badge className="bg-accent text-accent-foreground mb-1">Matured</Badge>
            <p className="text-xs text-muted-foreground mt-1">
              Withdraw {formatAmount(maturityPayout)} (Capital + Interest) with 0% fees
            </p>
          </div>
        )}
        {!matured && vault.penalty_percentage > 0 && (
          <p className="text-xs text-warning mt-3 text-center">
            ⚠ {(vault.penalty_percentage * 100).toFixed(0)}% penalty for early withdrawal
          </p>
        )}
      </div>

      {/* Early Withdrawal Modal */}
      {pendingWithdraw && (
        <EarlyWithdrawalModal
          open={showPenaltyModal}
          onOpenChange={setShowPenaltyModal}
          onConfirm={handleConfirmEarlyWithdraw}
          balance={pendingWithdraw.balance || 0}
          penaltyPercentage={pendingWithdraw.penalty_percentage || 0}
          penaltyAmount={pendingWithdraw.penalty_amount || 0}
          netAmount={pendingWithdraw.net_amount || 0}
          maturityDate={pendingWithdraw.maturity_date || ""}
          isLoading={isWithdrawing}
        />
      )}
    </>
  );
};

export default VaultCard;
