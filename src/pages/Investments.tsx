import { useState } from "react";
import { Check, ArrowRight, ArrowLeft, AlertCircle, Upload, Copy, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CURRENCIES, formatCurrency, convertAmount } from "@/lib/currency";
import { useTranslation } from "react-i18next";

type InvestmentTier = "starter" | "golden" | "premium" | "business" | "platinum" | "achiever";
type PaymentCurrency = "USD" | "NGN" | "GBP";

const Investments = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { rates, isLoading } = useCurrency();
  const [step, setStep] = useState<"select" | "bank" | "upload">("select");
  const [selectedTier, setSelectedTier] = useState<InvestmentTier | null>(null);
  const [paymentCurrency, setPaymentCurrency] = useState<PaymentCurrency>("USD");
  const [bankReference, setBankReference] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const investmentTiers = [
    { id: "starter" as InvestmentTier, name: "Starter", amount: 50, color: "border-muted-foreground/30", description: t("investments.perfectForBeginners") },
    { id: "golden" as InvestmentTier, name: "Golden", amount: 100, color: "border-yellow-500/50", description: t("investments.popularChoice") },
    { id: "premium" as InvestmentTier, name: "Premium", amount: 500, color: "border-accent/50", description: t("investments.enhancedReturns") },
    { id: "business" as InvestmentTier, name: "Business", amount: 1000, color: "border-blue-500/50", description: t("investments.forSeriousInvestors") },
    { id: "platinum" as InvestmentTier, name: "Platinum", amount: 2500, color: "border-purple-500/50", description: t("investments.premiumBenefits") },
    { id: "achiever" as InvestmentTier, name: "Achiever", amount: 5000, color: "border-foreground/50", description: t("investments.maximumPotential") },
  ];

  const paymentCurrencies: { id: PaymentCurrency; flag: string; label: string }[] = [
    { id: "USD", flag: "🇺🇸", label: "US Dollar" },
    { id: "NGN", flag: "🇳🇬", label: "Nigerian Naira" },
    { id: "GBP", flag: "🇬🇧", label: "British Pound" },
  ];

  const selectedPlan = investmentTiers.find((ti) => ti.id === selectedTier);
  const fallbackRates: Record<PaymentCurrency, number> = {
    USD: 1,
    NGN: 1600,
    GBP: 0.79,
  };
  const currencyRate = Number(rates[paymentCurrency] ?? fallbackRates[paymentCurrency] ?? 1) || 1;
  const currencyInfo = CURRENCIES[paymentCurrency];
  const usingFallbackRate = !isLoading && !rates[paymentCurrency];

  const convertToLocal = (usdAmount: number) => convertAmount(usdAmount, 1, currencyRate);
  const formatLocal = (usdAmount: number) => formatCurrency(convertToLocal(usdAmount), paymentCurrency);

  const curKey = paymentCurrency.toLowerCase();
  const { data: bankDetails } = useQuery({
    queryKey: ["bank-details", curKey],
    queryFn: async () => {
      const keys = [
        `bank_name_${curKey}`, `bank_account_name_${curKey}`, `bank_account_number_${curKey}`,
        `bank_routing_number_${curKey}`, `bank_swift_code_${curKey}`
      ];
      const { data, error } = await supabase
        .from("system_settings")
        .select("setting_key, description")
        .in("setting_key", keys);
      if (error) throw error;
      const map: Record<string, string> = {};
      data.forEach((s) => { map[s.setting_key] = s.description || ""; });
      return [
        { label: t("deposit.bankName"), value: map[`bank_name_${curKey}`] || "", key: "bankName" },
        { label: t("deposit.accountName"), value: map[`bank_account_name_${curKey}`] || "", key: "accountName" },
        { label: t("deposit.accountNumber"), value: map[`bank_account_number_${curKey}`] || "", key: "accountNumber" },
        { label: t("deposit.routingNumber"), value: map[`bank_routing_number_${curKey}`] || "", key: "routingNumber" },
        { label: t("deposit.swiftCode"), value: map[`bank_swift_code_${curKey}`] || "", key: "swiftCode" },
      ].filter(item => item.value);
    },
  });

  const { data: deposits, isLoading: depositsLoading, refetch } = useQuery({
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

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSubmit = async () => {
    if (!selectedPlan || !bankReference || !acceptedTerms) {
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
          amount: selectedPlan.amount,
          bank_reference: bankReference,
          proof_url: proofFilePath,
          deposit_type: 'investment',
        });

      if (error) throw error;

      toast({
        title: t("investments.success"),
        description: (
          <div className="mt-1 space-y-1 text-sm">
            <div>{selectedPlan.name} Plan — ${selectedPlan.amount.toLocaleString()}</div>
            <div className="text-muted-foreground">{t("investments.splitDesc")}</div>
          </div>
        ),
      });

      setStep("select");
      setSelectedTier(null);
      setBankReference("");
      setProofFile(null);
      setAcceptedTerms(false);
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
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t("investments.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("investments.subtitle")}</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 text-sm">
          {[
            { key: "select", label: `1. ${t("common.search")}` },
            { key: "bank", label: `2. ${t("deposit.bankDetails")}` },
            { key: "upload", label: `3. ${t("deposit.uploadProof")}` },
          ].map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px bg-border" />}
              <div className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                step === s.key
                  ? "bg-accent text-accent-foreground"
                  : step === "upload" && s.key === "select" || step === "upload" && s.key === "bank" || step === "bank" && s.key === "select"
                    ? "bg-accent/20 text-accent"
                    : "bg-secondary text-muted-foreground"
              }`}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* STEP 1: Select Plan */}
        {step === "select" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground mr-1">Pay in:</span>
              {paymentCurrencies.map((cur) => (
                <Button key={cur.id} variant={paymentCurrency === cur.id ? "default" : "outline"} size="sm" className="gap-1.5" onClick={() => setPaymentCurrency(cur.id)}>
                  <span className="text-base">{cur.flag}</span>
                  {cur.id}
                </Button>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">
              {isLoading
                ? "Fetching exchange rates..."
                : `1 USD ≈ ${formatCurrency(currencyRate, paymentCurrency)} (${currencyInfo.symbol}${currencyRate.toLocaleString()} ${paymentCurrency})`}
              {usingFallbackRate && (
                <div className="text-xs text-warning-foreground">(Using fallback rate because live exchange data is unavailable)</div>
              )}
            </div>

            <div className="p-4 rounded-md border border-accent/30 bg-accent/5 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm">{t("investments.splitStrategy")}</div>
                <div className="text-sm text-muted-foreground mt-1">{t("investments.splitDesc")}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {investmentTiers.map((tier) => {
                const isSelected = selectedTier === tier.id;
                const localAmount = convertToLocal(tier.amount);
                return (
                  <button key={tier.id} onClick={() => setSelectedTier(tier.id)}
                    className={`relative p-6 rounded-md border-2 text-left transition-all hover:border-muted-foreground/50 ${
                      isSelected ? "border-accent bg-accent/5" : `${tier.color} bg-card`
                    }`}>
                    {isSelected && (
                      <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                        <Check className="w-4 h-4 text-accent-foreground" />
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{tier.name}</div>
                    <div className="text-3xl font-bold font-mono mb-1">
                      {currencyInfo.symbol}{localAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                    {paymentCurrency !== "USD" && (
                      <div className="text-xs text-muted-foreground font-mono mb-2">≈ ${tier.amount.toLocaleString()} USD</div>
                    )}
                    <div className="text-sm text-muted-foreground mb-4">{tier.description}</div>
                    <div className="grid grid-cols-2 gap-2 pt-4 border-t border-border">
                      <div>
                        <div className="text-xs text-muted-foreground">{t("investments.mlmCapital")}</div>
                        <div className="font-mono text-sm font-medium">{currencyInfo.symbol}{(localAmount / 2).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">{t("investments.trading")}</div>
                        <div className="font-mono text-sm font-medium">{currencyInfo.symbol}{(localAmount / 2).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedTier && (
              <div className="flex justify-end">
                <Button size="lg" className="gap-2" onClick={() => setStep("bank")}>
                  {t("investments.continueWith", { name: formatLocal(selectedPlan!.amount) })}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Bank Details */}
        {step === "bank" && selectedPlan && (
          <div className="space-y-6 animate-fade-in">
            <div className="p-6 rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">{t("deposit.bankDetails")}</h2>
                <span className="text-xs px-2 py-1 rounded-full bg-accent/20 text-accent font-medium">
                  {currencyInfo.flag} {paymentCurrency} • {selectedPlan.name}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">{t("deposit.bankDetailsSubtitle")}</p>

              {bankDetails && bankDetails.length > 0 ? (
                <div className="space-y-3">
                  {bankDetails.map((item) => (
                    <div key={item.key} className="flex justify-between items-center p-3 rounded-lg bg-secondary/30">
                      <div>
                        <div className="text-xs text-muted-foreground">{item.label}</div>
                        <div className="font-mono text-sm">{item.value}</div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => copyToClipboard(item.value, item.key)}>
                        {copiedField === item.key ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-md border border-destructive/30 bg-destructive/5 text-sm text-muted-foreground">
                  <AlertCircle className="w-4 h-4 inline mr-2 text-destructive" />
                  No {paymentCurrency} bank details configured yet.
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("select")} className="gap-2">
                <ArrowLeft className="w-4 h-4" /> {t("common.back")}
              </Button>
              <Button size="lg" className="gap-2" onClick={() => setStep("upload")} disabled={!bankDetails || bankDetails.length === 0}>
                {t("common.next")} <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Upload Proof */}
        {step === "upload" && selectedPlan && (
          <div className="space-y-6 animate-fade-in">
            <div className="p-6 rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">{t("deposit.proofOfPayment")}</h2>
                <span className="text-xs px-2 py-1 rounded-full bg-accent/20 text-accent font-medium">
                  {formatLocal(selectedPlan.amount)} — {selectedPlan.name}
                </span>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("deposit.bankReference")} *</Label>
                  <Input placeholder={t("deposit.bankReferencePlaceholder")} value={bankReference} onChange={(e) => setBankReference(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>{t("deposit.proofOfPayment")} *</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-accent/50 transition-colors">
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

                <div className="p-4 rounded-md bg-secondary/50 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("investments.title")}</span>
                    <span className="font-medium">{selectedPlan.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("deposit.amount")} ({paymentCurrency})</span>
                    <span className="font-mono font-bold">{formatLocal(selectedPlan.amount)}</span>
                  </div>
                  {paymentCurrency !== "USD" && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">USD equivalent</span>
                      <span className="font-mono">${selectedPlan.amount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="h-px bg-border" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("investments.mlmCapital")}</span>
                    <span className="font-mono">{formatLocal(selectedPlan.amount / 2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("investments.tradingPrincipal")}</span>
                    <span className="font-mono">{formatLocal(selectedPlan.amount / 2)}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-md border border-border">
                  <Checkbox id="terms" checked={acceptedTerms} onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)} className="mt-0.5" />
                  <label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer">
                    {t("investments.termsCheckbox")}
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("bank")} className="gap-2">
                <ArrowLeft className="w-4 h-4" /> {t("common.back")}
              </Button>
              <Button size="lg" onClick={handleSubmit} disabled={uploading || !bankReference || !acceptedTerms}>
                {uploading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    {t("investments.processing")}
                  </div>
                ) : (
                  t("investments.confirmBtn")
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Deposit History */}
        <div className="p-6 rounded-xl border border-border bg-card">
          <h2 className="font-semibold mb-4">{t("deposit.depositHistory")}</h2>
          {depositsLoading ? (
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

export default Investments;
