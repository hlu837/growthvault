import { useState } from "react";
import { Upload, CheckCircle, AlertCircle, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/DashboardLayout";
import { PaymentButton } from "@/components/PayPalPayment";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

const Deposit = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [bankReference, setBankReference] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [depositType, setDepositType] = useState<"general" | "investment">("general");

  const isValidImageUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  };
  const getImageUrl = (path: string) => {
    if (!path) return "";
    if (isValidImageUrl(path)) return path;
    const { data } = supabase.storage.from("deposit-proofs").getPublicUrl(path);
    return data.publicUrl;
  };

  const { currency } = useCurrency();

  console.log("Current currency from context:", currency);

  const currencySuffix = currency.toLowerCase();
  const supportedCurrencySuffixes = ["usd", "eur", "ngn", "gbp"];

  console.log("Currency suffix:", currencySuffix);

  const resolveBankSetting = (map: Record<string, string>, key: string) => {
    const candidates = [
      `${key}_${currencySuffix}`,
      key,
      `${key}_usd`,
      `${key}_ngn`,
      `${key}_gbp`,
    ];

    for (const candidate of candidates) {
      if (map[candidate]) return map[candidate];
    }

    return "Not configured";
  };

  const { data: bankDetails } = useQuery({
    queryKey: ["bank-details", currency],
    queryFn: async () => {
      const queryKeys = [
        "bank_name", "bank_name_usd", "bank_name_eur", "bank_name_ngn", "bank_name_gbp",
        "bank_account_name", "bank_account_name_usd", "bank_account_name_eur", "bank_account_name_ngn", "bank_account_name_gbp",
        "bank_account_number", "bank_account_number_usd", "bank_account_number_eur", "bank_account_number_ngn", "bank_account_number_gbp",
        "bank_routing_number", "bank_routing_number_usd", "bank_routing_number_eur", "bank_routing_number_ngn", "bank_routing_number_gbp",
        "bank_swift_code", "bank_swift_code_usd", "bank_swift_code_eur", "bank_swift_code_ngn", "bank_swift_code_gbp",
      ];

      const { data, error } = await supabase
        .from("system_settings")
        .select("setting_key, description")
        .in("setting_key", queryKeys);

      if (error) throw error;

      const map: Record<string, string> = {};
      data?.forEach((item) => {
        map[item.setting_key] = item.description ?? "";
      });

      return {
        bankName: resolveBankSetting(map, "bank_name"),
        accountName: resolveBankSetting(map, "bank_account_name"),
        accountNumber: resolveBankSetting(map, "bank_account_number"),
        routingNumber: resolveBankSetting(map, "bank_routing_number"),
        swiftCode: resolveBankSetting(map, "bank_swift_code"),
      };
    },
  });

  const downloadImage = async (path: string) => {
    try {
      const { data, error } = await supabase.storage.from("deposit-proofs").download(path);
      if (error) {
        throw error;
      }
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = path.split("/").pop() || "deposit_proof";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    }
  };

  const { data: deposits, isLoading, refetch } = useQuery({
    queryKey: ["deposits", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("deposits")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    if (!amount || !bankReference) {
      toast({ title: t("common.error"), description: t("errors.fillAllFields"), variant: "destructive" });
      return;
    }
    if (!user) return;

    setUploading(true);
    try {
      let proofFilePath = null;
      if (proofFile) {
        const fileExt = proofFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("deposit-proofs")
          .upload(fileName, proofFile);
        if (uploadError) throw uploadError;
        proofFilePath = fileName;
      }

      const { error } = await supabase
        .from("deposits")
        .insert({
          user_id: user.id,
          amount: Number(amount),
          bank_reference: bankReference,
          proof_url: proofFilePath,
          deposit_type: depositType,
        });

      if (error) throw error;

      toast({ title: t("common.success"), description: t("success.depositSubmitted") });
      setAmount("");
      setBankReference("");
      setProofFile(null);
      refetch();
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return <span className="px-2 py-1 text-xs rounded-full bg-accent/20 text-accent flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {t("deposit.verified")}</span>;
      case "rejected":
        return <span className="px-2 py-1 text-xs rounded-full bg-destructive/20 text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {t("deposit.rejected")}</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400">{t("withdraw.pending")}</span>;
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t("deposit.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("deposit.subtitle")}</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Manual Bank Transfer Tab */}
          <Tabs defaultValue="bank" className="lg:col-span-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="bank">💳 {t("deposit.bankTransfer") || "Manual Bank Transfer"}</TabsTrigger>
              <TabsTrigger value="paypal">🅿️ {t("deposit.paypalPayment") || "PayPal Payment"}</TabsTrigger>
            </TabsList>

            {/* Bank Transfer Content */}
            <TabsContent value="bank" className="grid lg:grid-cols-2 gap-6 mt-6">
              <div className="p-6 rounded-xl border border-border bg-card">
                <h2 className="font-semibold mb-4">{t("deposit.bankDetails")}</h2>
                <p className="text-sm text-muted-foreground mb-6">{t("deposit.bankDetailsSubtitle")}</p>

                <div className="space-y-4">
                  {bankDetails ? (
                    Object.entries(bankDetails).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center p-3 rounded-lg bg-secondary/30">
                        <div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </div>
                          <div className="font-mono">{value}</div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(value)}>
                          {copied ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-4">
                      Loading bank details...
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 rounded-xl border border-border bg-card">
                <h2 className="font-semibold mb-4">{t("deposit.submitDeposit")}</h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t("deposit.amount")} ($) *</Label>
                    <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>

                  <div className="space-y-3">
                    <Label>{t("deposit.depositType")} *</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="general"
                          name="depositType"
                          value="general"
                          checked={depositType === "general"}
                          onChange={(e) => setDepositType(e.target.value as "general")}
                          className="w-4 h-4 text-accent bg-gray-100 border-gray-300 focus:ring-accent"
                        />
                        <label htmlFor="general" className="text-sm font-medium">
                          {t("deposit.generalDeposit")}
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground ml-6">{t("deposit.generalDepositDesc")}</p>

                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="investment"
                          name="depositType"
                          value="investment"
                          checked={depositType === "investment"}
                          onChange={(e) => setDepositType(e.target.value as "investment")}
                          className="w-4 h-4 text-accent bg-gray-100 border-gray-300 focus:ring-accent"
                        />
                        <label htmlFor="investment" className="text-sm font-medium">
                          {t("deposit.investmentDeposit")}
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground ml-6">{t("deposit.investmentDepositDesc")}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("deposit.bankReference")} *</Label>
                    <Input placeholder={t("deposit.bankReferencePlaceholder")} value={bankReference} onChange={(e) => setBankReference(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("deposit.proofOfPayment")}</Label>
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                      <input type="file" accept="image/*,.pdf" onChange={(e) => setProofFile(e.target.files?.[0] || null)} className="hidden" id="proof-upload" />
                      <label htmlFor="proof-upload" className="cursor-pointer">
                        <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        {proofFile ? (
                          <span className="text-sm text-accent">{proofFile.name}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">{t("deposit.uploadProof")}</span>
                        )}
                      </label>
                    </div>
                  </div>

                  <Button className="w-full" onClick={handleSubmit} disabled={uploading}>
                    {uploading ? t("deposit.submitting") : t("deposit.submitDeposit")}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* PayPal Payment Content */}
            <TabsContent value="paypal" className="mt-6">
              <div className="p-8 rounded-xl border border-border bg-card">
                <div className="max-w-md mx-auto space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2">Pay with PayPal</h2>
                    <p className="text-muted-foreground">
                      Fast, secure, and instant wallet funding. Your payment will be processed immediately.
                    </p>
                  </div>

                  <div className="bg-secondary/30 p-4 rounded-lg">
                    <Label className="mb-3 block">Amount to Deposit</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-accent">
                        ${amount || "0.00"}
                      </span>
                      <Input
                        type="number"
                        placeholder="Enter amount"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg">
                    <p className="text-sm text-blue-600">
                      ✓ Instant processing<br/>
                      ✓ Secure payment<br/>
                      ✓ No manual verification needed
                    </p>
                  </div>

                  {amount && parseFloat(amount) > 0 ? (
                    <PaymentButton
                      amount={parseFloat(amount)}
                      currency="USD"
                      description={`GrowthVault Wallet Deposit - $${amount}`}
                      disabled={!amount || parseFloat(amount) <= 0}
                      onPaymentInitiated={() => {
                        console.log("PayPal payment initiated for amount:", amount);
                      }}
                    />
                  ) : (
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-center text-sm text-yellow-600">
                      Please enter an amount to continue with PayPal payment
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="p-6 rounded-xl border border-border bg-card">
          <h2 className="font-semibold mb-4">{t("deposit.depositHistory")}</h2>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-secondary/30 animate-pulse rounded-md" />
              ))}
            </div>
          ) : deposits && deposits.length > 0 ? (
            <div className="space-y-3">
              {deposits.map((deposit) => (
                <div key={deposit.id} className="flex items-center justify-between p-4 rounded-md bg-secondary/30">
                  <div>
                    <div className="font-mono font-semibold">${Number(deposit.amount).toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">
                      {deposit.created_at && format(new Date(deposit.created_at), "MMM dd, yyyy")} • Ref: {deposit.bank_reference}
                    </div>
                  </div>
                  {getStatusBadge(deposit.status)}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">{t("deposit.noDeposits")}</p>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Deposit;
