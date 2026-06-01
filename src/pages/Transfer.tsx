import { useState } from "react";
import { ArrowLeftRight, Send, Wallet, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/DashboardLayout";
import { useWallets, getWalletBalance, walletDisplayNames, WalletType } from "@/hooks/useWallets";
import { useWalletTransfer } from "@/hooks/useTransfers";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import KYCGuard from "@/components/KYCGuard";
import { useTranslation } from "react-i18next";

const Transfer = () => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { data: wallets, isLoading } = useWallets();
  const transfer = useWalletTransfer();
  const { toast } = useToast();

  const [fromWallet, setFromWallet] = useState<WalletType | "">("");
  const [toWallet, setToWallet] = useState<WalletType | "">("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const [recipientCode, setRecipientCode] = useState("");
  const [p2pAmount, setP2pAmount] = useState("");
  const [p2pFromWallet, setP2pFromWallet] = useState<WalletType | "">("");
  const [p2pDescription, setP2pDescription] = useState("");

  const walletTypes: WalletType[] = [
    "savings", "trading_principal", "mlm_bonus", "loan",
    "prudent_saving", "golden_saving", "projects_saving", "future_saving", "loans_saving",
  ];

  const handleInternalTransfer = async () => {
    if (!fromWallet || !toWallet || !amount) {
      toast({ title: t("common.error"), description: t("errors.fillAllFields"), variant: "destructive" });
      return;
    }
    if (fromWallet === toWallet) {
      toast({ title: t("common.error"), description: t("errors.cannotTransferSameWallet"), variant: "destructive" });
      return;
    }
    const balance = getWalletBalance(wallets, fromWallet);
    if (Number(amount) > balance) {
      toast({ title: t("common.error"), description: t("errors.insufficientBalance"), variant: "destructive" });
      return;
    }

    try {
      await transfer.mutateAsync({
        fromWalletType: fromWallet,
        toWalletType: toWallet,
        amount: Number(amount),
        description: description || `Transfer from ${walletDisplayNames[fromWallet]} to ${walletDisplayNames[toWallet]}`,
      });
      toast({ title: t("common.success"), description: t("success.transferCompleted") });
      setAmount(""); setDescription(""); setFromWallet(""); setToWallet("");
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    }
  };

  const handleP2PTransfer = async () => {
    if (!recipientCode || !p2pAmount || !p2pFromWallet) {
      toast({ title: t("common.error"), description: t("errors.fillAllFields"), variant: "destructive" });
      return;
    }
    const { data: recipient, error: lookupError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("referral_code", recipientCode.toUpperCase())
      .single();

    if (lookupError || !recipient) {
      toast({ title: t("common.error"), description: t("errors.recipientNotFound"), variant: "destructive" });
      return;
    }
    const balance = getWalletBalance(wallets, p2pFromWallet);
    if (Number(p2pAmount) > balance) {
      toast({ title: t("common.error"), description: t("errors.insufficientBalance"), variant: "destructive" });
      return;
    }

    try {
      await transfer.mutateAsync({
        fromWalletType: p2pFromWallet,
        toWalletType: "savings",
        amount: Number(p2pAmount),
        recipientId: recipient.id,
        description: p2pDescription || `Transfer to ${recipient.full_name}`,
      });
      toast({ title: t("common.success"), description: `Transferred $${p2pAmount} to ${recipient.full_name}` });
      setP2pAmount(""); setP2pDescription(""); setRecipientCode(""); setP2pFromWallet("");
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t("transfer.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("transfer.subtitle")}</p>
        </div>

        <KYCGuard kycStatus={profile?.kyc_status} />

        <Tabs defaultValue="internal" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="internal" className="gap-2">
              <Wallet className="w-4 h-4" />
              {t("transfer.betweenWallets")}
            </TabsTrigger>
            <TabsTrigger value="p2p" className="gap-2">
              <User className="w-4 h-4" />
              {t("transfer.toUser")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="internal">
            <div className="p-6 rounded-md border border-border bg-card space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <ArrowLeftRight className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold">{t("transfer.internalTransfer")}</h2>
                  <p className="text-sm text-muted-foreground">{t("transfer.moveFunds")}</p>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>{t("transfer.fromWallet")}</Label>
                  <Select value={fromWallet} onValueChange={(v) => setFromWallet(v as WalletType)}>
                    <SelectTrigger><SelectValue placeholder={t("transfer.selectSource")} /></SelectTrigger>
                    <SelectContent>
                      {walletTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {walletDisplayNames[type]} (${getWalletBalance(wallets, type).toLocaleString()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fromWallet === "trading_principal" && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                      {t("transfer.investmentTransferWarning")}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>{t("transfer.toWallet")}</Label>
                  <Select value={toWallet} onValueChange={(v) => setToWallet(v as WalletType)}>
                    <SelectTrigger><SelectValue placeholder={t("transfer.selectDestination")} /></SelectTrigger>
                    <SelectContent>
                      {walletTypes.filter(wt => wt !== fromWallet).map((type) => (
                        <SelectItem key={type} value={type}>{walletDisplayNames[type]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("transfer.amount")} ($)</Label>
                  <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>{t("transfer.description")}</Label>
                  <Input placeholder={t("transfer.whatsThisFor")} value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>

                <Button className="w-full gap-2" onClick={handleInternalTransfer} disabled={transfer.isPending || isLoading || profile?.kyc_status !== "approved"}>
                  <ArrowLeftRight className="w-4 h-4" />
                  {transfer.isPending ? t("transfer.processing") : t("transfer.submitTransfer")}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="p2p">
            <div className="p-6 rounded-md border border-border bg-card space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                  <Send className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h2 className="font-semibold">{t("transfer.sendToUser")}</h2>
                  <p className="text-sm text-muted-foreground">{t("transfer.transferToUser")}</p>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>{t("transfer.recipientCode")}</Label>
                  <Input placeholder="e.g., ABC123" value={recipientCode} onChange={(e) => setRecipientCode(e.target.value.toUpperCase())} className="uppercase" />
                </div>

                <div className="space-y-2">
                  <Label>{t("transfer.fromWallet")}</Label>
                  <Select value={p2pFromWallet} onValueChange={(v) => setP2pFromWallet(v as WalletType)}>
                    <SelectTrigger><SelectValue placeholder={t("transfer.selectSource")} /></SelectTrigger>
                    <SelectContent>
                      {walletTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {walletDisplayNames[type]} (${getWalletBalance(wallets, type).toLocaleString()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("transfer.amount")} ($)</Label>
                  <Input type="number" placeholder="0.00" value={p2pAmount} onChange={(e) => setP2pAmount(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>{t("transfer.noteOptional")}</Label>
                  <Input placeholder={t("transfer.addNote")} value={p2pDescription} onChange={(e) => setP2pDescription(e.target.value)} />
                </div>

                <Button className="w-full gap-2" onClick={handleP2PTransfer} disabled={transfer.isPending || isLoading || profile?.kyc_status !== "approved"}>
                  <Send className="w-4 h-4" />
                  {transfer.isPending ? t("transfer.sending") : t("transfer.sendFunds")}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Transfer;
