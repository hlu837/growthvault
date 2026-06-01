import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  PiggyBank,
  TrendingUp,
  Target,
  Clock,
  Landmark,
  Shield,
  Plus,
  Minus,
  Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/DashboardLayout";
import {
  useWallets,
  getWalletBalance,
  WalletType,
  walletDisplayNames,
} from "@/hooks/useWallets";
import { useWalletTransfer } from "@/hooks/useTransfers";
import {
  useVaults,
  useCreateVault,
  useUpdateVault,
  useDepositToVault,
  useWithdrawFromVault,
  useDeleteVault,
  SavingsVault,
  CreateVaultParams,
  getDailyProfit,
  getTotalAccruedProfit,
  useGlobalAPYMultiplier,
} from "@/hooks/useVaults";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import VaultCard from "@/components/vaults/VaultCard";
import CreateVaultModal from "@/components/vaults/CreateVaultModal";
import AutoSaveModal from "@/components/vaults/AutoSaveModal";

interface SavingsProduct {
  type: WalletType;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const Savings = () => {
  const { t } = useTranslation();
  const { data: wallets, isLoading, refetch } = useWallets();
  const { data: vaults, isLoading: vaultsLoading, refetch: refetchVaults } = useVaults();
  const walletTransfer = useWalletTransfer();
  const createVault = useCreateVault();
  const updateVault = useUpdateVault();
  const depositToVault = useDepositToVault();
  const withdrawFromVault = useWithdrawFromVault();
  const deleteVault = useDeleteVault();
  const { formatAmount, formatDual, currency, currencyInfo, rates } = useCurrency();
  const navigate = useNavigate();
  const { data: apyMultiplier = 1.0 } = useGlobalAPYMultiplier();

  // Convert amount from current currency back to USD
  const convertToUSD = (localAmount: number): number => {
    if (currency === "USD") return localAmount;
    const rate = rates[currency] || 1;
    return localAmount / rate;
  };

  const [depositAmounts, setDepositAmounts] = useState<Record<string, string>>({});
  const [activeAction, setActiveAction] = useState<Record<string, "deposit" | "withdraw" | null>>({});
  const [showCreateVault, setShowCreateVault] = useState(false);
  const [editingAutoSave, setEditingAutoSave] = useState<SavingsVault | null>(null);

  const savingsProducts: SavingsProduct[] = [
    {
      type: "prudent_saving",
      name: t("savings.vaultTypes.prudent"),
      description: t("savings.vaultTypes.prudentDesc"),
      icon: Shield,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/20",
    },
    {
      type: "golden_saving",
      name: t("savings.vaultTypes.golden"),
      description: t("savings.vaultTypes.goldenDesc"),
      icon: TrendingUp,
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/20",
    },
    {
      type: "projects_saving",
      name: t("savings.vaultTypes.projects"),
      description: t("savings.vaultTypes.projectsDesc"),
      icon: Target,
      color: "text-blue-400",
      bgColor: "bg-blue-500/20",
    },
    {
      type: "future_saving",
      name: t("savings.vaultTypes.future"),
      description: t("savings.vaultTypes.futureDesc"),
      icon: Clock,
      color: "text-purple-400",
      bgColor: "bg-purple-500/20",
    },
    {
      type: "loans_saving",
      name: t("savings.vaultTypes.loans"),
      description: t("savings.vaultTypes.loansDesc"),
      icon: Landmark,
      color: "text-orange-400",
      bgColor: "bg-orange-500/20",
    },
  ];

  const totalSavings = savingsProducts.reduce((total, product) => {
    return total + getWalletBalance(wallets, product.type);
  }, 0);

  const totalVaultBalance = vaults?.reduce((sum, v) => sum + v.balance, 0) || 0;
  const totalDailyProfit = vaults?.reduce((sum, v) => sum + getDailyProfit(v.balance, v.wallet_type, apyMultiplier), 0) || 0;
  const totalAccruedProfit = vaults?.reduce((sum, v) => sum + getTotalAccruedProfit(v.balance, v.wallet_type, v.created_at, apyMultiplier), 0) || 0;

  const handleAmountChange = (type: WalletType, value: string) => {
    if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
      setDepositAmounts((prev) => ({ ...prev, [type]: value }));
    }
  };

  const handleDeposit = async (type: WalletType) => {
    const amount = parseFloat(depositAmounts[type] || "0");
    if (amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const savingsBalance = getWalletBalance(wallets, "savings");
    if (amount > savingsBalance) {
      toast.error("Insufficient balance in main savings wallet");
      return;
    }

    try {
      await walletTransfer.mutateAsync({
        fromWalletType: "savings",
        toWalletType: type,
        amount,
        description: `Deposit to ${walletDisplayNames[type]}`,
      });
      setDepositAmounts((prev) => ({ ...prev, [type]: "" }));
      setActiveAction((prev) => ({ ...prev, [type]: null }));
      refetch();
      toast.success(`Successfully deposited $${amount.toFixed(2)} to ${walletDisplayNames[type]}`);
    } catch (error) {
      toast.error("Failed to deposit. Please try again.");
    }
  };

  const handleWithdraw = async (type: WalletType) => {
    const amount = parseFloat(depositAmounts[type] || "0");
    if (amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const walletBalance = getWalletBalance(wallets, type);
    if (amount > walletBalance) {
      toast.error(`Insufficient balance in ${walletDisplayNames[type]}`);
      return;
    }

    try {
      await walletTransfer.mutateAsync({
        fromWalletType: type,
        toWalletType: "savings",
        amount,
        description: `Withdraw from ${walletDisplayNames[type]}`,
      });
      setDepositAmounts((prev) => ({ ...prev, [type]: "" }));
      setActiveAction((prev) => ({ ...prev, [type]: null }));
      refetch();
      toast.success(`Successfully withdrew $${amount.toFixed(2)} from ${walletDisplayNames[type]}`);
    } catch (error) {
      toast.error("Failed to withdraw. Please try again.");
    }
  };

  const toggleAction = (type: WalletType, action: "deposit" | "withdraw") => {
    setActiveAction((prev) => ({
      ...prev,
      [type]: prev[type] === action ? null : action,
    }));
    setDepositAmounts((prev) => ({ ...prev, [type]: "" }));
  };

  // Vault handlers
  const handleCreateVault = async (params: CreateVaultParams) => {
    try {
      await createVault.mutateAsync(params);
      setShowCreateVault(false);
      refetchVaults();
      toast.success("Vault created successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to create vault");
    }
  };

  const handleVaultDeposit = async (vaultId: string, amount: number) => {
    try {
      await depositToVault.mutateAsync({ vaultId, amount });
      refetch();
      refetchVaults();
      toast.success(`Deposited $${amount.toFixed(2)} to vault`);
    } catch (error: any) {
      toast.error(error.message || "Failed to deposit");
    }
  };

  const handleVaultWithdraw = async (vaultId: string, forceEarly = false) => {
    try {
      const result = await withdrawFromVault.mutateAsync({ vaultId, forceEarly });
      if (result.success) {
        refetch();
        refetchVaults();
        if (result.is_early) {
          toast.success(
            `Withdrew $${result.withdrawn_amount?.toFixed(2)} (${(result.penalty_amount || 0).toFixed(2)} penalty applied)`
          );
        } else {
          toast.success(`Withdrew $${result.withdrawn_amount?.toFixed(2)} from vault`);
        }
      }
      return result;
    } catch (error: any) {
      toast.error(error.message || "Failed to withdraw");
      return {};
    }
  };

  const handleDeleteVault = async (vaultId: string) => {
    try {
      await deleteVault.mutateAsync(vaultId);
      refetchVaults();
      toast.success("Vault deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete vault");
    }
  };

  const handleUpdateAutoSave = async (vaultId: string, frequency: string, amount: number) => {
    try {
      await updateVault.mutateAsync({
        vaultId,
        recurring_frequency: frequency as any,
        recurring_amount: amount,
      });
      setEditingAutoSave(null);
      refetchVaults();
      toast.success("Auto-save settings updated");
    } catch (error: any) {
      toast.error(error.message || "Failed to update settings");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t("savings.title")}</h1>
            <p className="text-muted-foreground mt-1">{t("savings.subtitle")}</p>
          </div>
          <Button onClick={() => navigate("/dashboard/deposit")} className="gap-2">
            <PiggyBank className="w-4 h-4" />
            {t("savings.fundMainWallet")}
          </Button>
        </div>

        {/* Total Savings Overview */}
        <div className="p-6 rounded-xl border border-border bg-gradient-to-br from-accent/10 to-card">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-accent/20 flex items-center justify-center">
              <PiggyBank className="w-7 h-7 text-accent" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t("savings.totalSavingsBalance")}</div>
              <div className="text-3xl font-bold font-mono">
                {isLoading ? (
                  <div className="h-9 w-40 bg-secondary animate-pulse rounded" />
                ) : (
                  formatAmount(totalSavings + totalVaultBalance)
                )}
              </div>
              {currency !== "USD" && (
                <div className="text-sm text-muted-foreground font-mono mt-1">
                  ≈ ${(totalSavings + totalVaultBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div>
              {t("savings.mainWallet")}:{" "}
              <span className="font-mono font-medium text-foreground">
                {formatAmount(getWalletBalance(wallets, "savings"))}
              </span>
            </div>
            <div>
              {t("savings.inVaults")}:{" "}
              <span className="font-mono font-medium text-foreground">
                {formatAmount(totalVaultBalance)}
              </span>
            </div>
            {totalDailyProfit > 0 && (
              <div>
                {t("savings.estDailyProfit")}:{" "}
                <span className="font-mono font-medium text-accent">
                  +{formatAmount(totalDailyProfit)}
                </span>
              </div>
            )}
            {totalAccruedProfit > 0 && (
              <div>
                {t("savings.totalEarned")}:{" "}
                <span className="font-mono font-medium text-accent">
                  +{formatAmount(totalAccruedProfit)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs for Wallets vs Vaults */}
        <Tabs defaultValue="vaults" className="space-y-6">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="vaults" className="gap-2">
              <Banknote className="w-4 h-4" />
              {t("savings.smartVaults")}
            </TabsTrigger>
            <TabsTrigger value="wallets" className="gap-2">
              <PiggyBank className="w-4 h-4" />
              {t("savings.savingsWallets")}
            </TabsTrigger>
          </TabsList>

          {/* Smart Vaults Tab */}
          <TabsContent value="vaults" className="space-y-6">
            {/* Create Vault Button */}
            <div className="flex justify-end">
              <Button onClick={() => setShowCreateVault(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                {t("savings.createVault")}
              </Button>
            </div>

            {/* Vaults Grid */}
            {vaultsLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-64 bg-secondary/30 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : vaults && vaults.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vaults.map((vault) => (
                  <VaultCard
                    key={vault.id}
                    vault={vault}
                    onDeposit={handleVaultDeposit}
                    onWithdraw={handleVaultWithdraw}
                    onDelete={handleDeleteVault}
                    onEditAutoSave={setEditingAutoSave}
                    isDepositing={depositToVault.isPending}
                    isWithdrawing={withdrawFromVault.isPending}
                  />
                ))}
              </div>
            ) : (
              <div className="p-12 rounded-xl border border-dashed border-border text-center">
                <Banknote className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">{t("savings.noVaultsYet")}</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">{t("savings.noVaultsDesc")}</p>
                <Button onClick={() => setShowCreateVault(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  {t("savings.createFirstVault")}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Savings Wallets Tab */}
          <TabsContent value="wallets" className="space-y-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savingsProducts.map((product) => {
                const balance = getWalletBalance(wallets, product.type);
                const Icon = product.icon;
                const currentAction = activeAction[product.type];
                const currentAmount = depositAmounts[product.type] || "";

                return (
                  <div
                    key={product.type}
                    className="p-6 rounded-xl border border-border bg-card hover:border-muted-foreground/50 transition-all group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className={`w-12 h-12 rounded-xl ${product.bgColor} flex items-center justify-center`}
                      >
                        <Icon className={`w-6 h-6 ${product.color}`} />
                      </div>
                    </div>

                    <h3 className="font-semibold mb-1">{product.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {product.description}
                    </p>

                    <div className="mb-4">
                      <div className="text-2xl font-bold font-mono">
                        {isLoading ? (
                          <div className="h-8 w-28 bg-secondary animate-pulse rounded" />
                        ) : (
                          formatAmount(balance)
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{t("savings.currentBalance")}</div>
                    </div>

                    {/* Inline Deposit/Withdraw Form */}
                    {currentAction && (
                      <div className="mb-4 p-3 rounded-lg bg-secondary/50 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">$</span>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="Enter amount"
                            value={currentAmount}
                            onChange={(e) => handleAmountChange(product.type, e.target.value)}
                            className="flex-1"
                            autoFocus
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() =>
                              currentAction === "deposit"
                                ? handleDeposit(product.type)
                                : handleWithdraw(product.type)
                            }
                            disabled={walletTransfer.isPending || !currentAmount}
                          >
                            {walletTransfer.isPending
                              ? t("transfer.processing")
                              : currentAction === "deposit"
                              ? t("savings.confirmDeposit")
                              : t("savings.confirmWithdraw")}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleAction(product.type, currentAction)}
                          >
                            {t("common.cancel")}
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant={currentAction === "deposit" ? "default" : "secondary"}
                        size="sm"
                        className="flex-1 gap-1"
                        onClick={() => toggleAction(product.type, "deposit")}
                      >
                        <Plus className="w-3 h-3" />
                        {t("savings.depositToVault")}
                      </Button>
                      <Button
                        variant={currentAction === "withdraw" ? "default" : "outline"}
                        size="sm"
                        className="flex-1 gap-1"
                        onClick={() => toggleAction(product.type, "withdraw")}
                      >
                        <Minus className="w-3 h-3" />
                        {t("savings.withdrawFromVault")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Other Wallets Section */}
            <div className="p-6 rounded-xl border border-border bg-card">
              <h2 className="font-semibold mb-4">Other Wallet Balances</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {(["savings", "mlm_capital", "trading_principal", "mlm_bonus", "loan"] as WalletType[]).map(
                  (type) => (
                    <div key={type} className="p-4 rounded-lg bg-secondary/30">
                      <div className="text-sm text-muted-foreground mb-1">
                        {walletDisplayNames[type]}
                      </div>
                      <div className="font-mono font-semibold">
                        {isLoading ? (
                          <div className="h-6 w-20 bg-secondary animate-pulse rounded" />
                        ) : (
                          formatAmount(getWalletBalance(wallets, type))
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Modals */}
        <CreateVaultModal
          open={showCreateVault}
          onOpenChange={setShowCreateVault}
          onSubmit={handleCreateVault}
          isLoading={createVault.isPending}
        />

        <AutoSaveModal
          open={!!editingAutoSave}
          onOpenChange={(open) => !open && setEditingAutoSave(null)}
          vault={editingAutoSave}
          onSubmit={handleUpdateAutoSave}
          isLoading={updateVault.isPending}
        />
      </div>
    </DashboardLayout>
  );
};

export default Savings;
