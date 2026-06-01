import { useState } from "react";
import { Wallet, AlertCircle, CheckCircle, Clock, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useWallets, getWalletBalance, walletDisplayNames, WalletType } from "@/hooks/useWallets";
import { useLoanWithdrawalGuard } from "@/hooks/useLoanWithdrawalGuard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import KYCGuard from "@/components/KYCGuard";
import { useTranslation } from "react-i18next";
import { webauthn } from "@/utils/webauthn";

const Withdraw = () => {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { data: wallets, isLoading: walletsLoading } = useWallets();
  const { data: withdrawalGuard } = useLoanWithdrawalGuard();
  const { toast } = useToast();
  
  const [walletType, setWalletType] = useState<WalletType | "">("");
  const [amount, setAmount] = useState("");
  const [bankDetails, setBankDetails] = useState({
    bankName: "",
    accountName: "",
    accountNumber: "",
    routingNumber: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [transactionToken, setTransactionToken] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpRequested, setOtpRequested] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<null | {
    walletType: WalletType;
    amount: number;
    bankDetails: { bankName: string; accountName: string; accountNumber: string; routingNumber: string; };
  }>(null);

  const walletTypes: WalletType[] = [
    "savings", "trading_principal", "mlm_bonus",
    "prudent_saving", "golden_saving", "projects_saving", "future_saving",
  ];

  const requiresOtp = Number(amount) >= 100 || Boolean(profile?.two_factor_enabled);
  const withdrawalFormComplete = Boolean(walletType && amount && bankDetails.bankName && bankDetails.accountName && bankDetails.accountNumber);

  const { data: withdrawals, isLoading, refetch } = useQuery({
    queryKey: ["withdrawals", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("withdrawals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const submitWithdrawal = async () => {
    if (!walletType || !amount || !bankDetails.bankName || !bankDetails.accountName || !bankDetails.accountNumber) {
      toast({ title: t("common.error"), description: t("errors.fillAllFields"), variant: "destructive" });
      return;
    }
    if (!user) return;

    // Validate bank account name matches user's name
    const userFullName = profile?.full_name || "";
    const bankAccountName = bankDetails.accountName.trim();
    
    if (bankAccountName && userFullName) {
      // Normalize names for comparison (remove extra spaces, case insensitive)
      const normalizeName = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim();
      const normalizedUserName = normalizeName(userFullName);
      const normalizedBankName = normalizeName(bankAccountName);
      
      // Check if bank account name contains user's name or vice versa
      const nameMatch = normalizedBankName.includes(normalizedUserName) || 
                       normalizedUserName.includes(normalizedBankName);
      
      if (!nameMatch) {
        toast({ 
          title: t("common.error"), 
          description: "Bank account name must match your registered name for security purposes",
          variant: "destructive" 
        });
        return;
      }
    }

    const balance = getWalletBalance(wallets, walletType);
    if (Number(amount) > balance) {
      toast({ title: t("common.error"), description: t("errors.insufficientBalance"), variant: "destructive" });
      return;
    }

    const requiresOtp = Number(amount) >= 100 || Boolean(profile?.two_factor_enabled);

    if (requiresOtp) {
      if (!otpRequested) {
        toast({ title: t("common.error"), description: t("withdraw.requestOtpFirst"), variant: "destructive" });
        return;
      }

      if (!transactionToken || !otpSent) {
        toast({ title: t("common.error"), description: t("withdraw.otpNotSent"), variant: "destructive" });
        return;
      }

      if (!otpVerified) {
        toast({ title: t("common.error"), description: t("withdraw.enterOtp"), variant: "destructive" });
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = pendingRequest
        ? {
            user_id: user.id,
            wallet_type: pendingRequest.walletType,
            amount: pendingRequest.amount,
            bank_details: pendingRequest.bankDetails,
            transaction_token: transactionToken,
          }
        : {
            user_id: user.id,
            wallet_type: walletType,
            amount: Number(amount),
            bank_details: bankDetails,
            transaction_token: transactionToken,
          };

      const { error } = await supabase.from("withdrawals").insert(payload);
      if (error) throw error;

      toast({ title: t("common.success"), description: t("success.withdrawalSubmitted") });
      setAmount("");
      setWalletType("");
      setBankDetails({ bankName: "", accountName: "", accountNumber: "", routingNumber: "" });
      setPendingRequest(null);
      setOtpSent(false);
      setOtpVerified(false);
      setTwoFactorCode("");
      setVerificationCode("");
      refetch();
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const requestTransactionToken = async () => {
    if (!user) throw new Error("User required");

    const { data, error } = await supabase
      .from("transaction_tokens")
      .insert({
        user_id: user.id,
        type: "withdrawal",
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      })
      .select("token")
      .single();

    if (error || !data) {
      throw error || new Error("Failed to create transaction token");
    }
    setTransactionToken(data.token);
    return data.token;
  };

  const performPasskeyAuth = async () => {
    if (!webauthn.isSupported()) {
      toast({ title: t("common.error"), description: "Passkey authentication not supported in this browser", variant: "destructive" });
      return false;
    }

    try {
      const { data, error } = await supabase
        .from("passkey_credentials")
        .select("credential_id")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        toast({ title: t("common.error"), description: "No registered passkey found. Falling back to email OTP.", variant: "destructive" });
        return false;
      }

      const success = await webauthn.authenticatePasskey(data.credential_id);
      if (success) {
        toast({ title: t("common.success"), description: "Biometric authentication successful!" });
      }
      return success;
    } catch (err: any) {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
      return false;
    }
  };

  const sendTwoFactorCode = async () => {
    if (!user) return;

    setOtpRequested(true);

    if (!transactionToken) {
      await requestTransactionToken();
    }

    if (profile?.two_factor_method === "passkey" || profile?.two_factor_method === "fingerprint") {
      const success = await performPasskeyAuth();
      if (success) {
        setOtpVerified(true);
        setOtpSent(true);
        return;
      }
      toast({ title: t("common.info"), description: "Passkey authentication is not fully enabled yet. Sending email OTP instead.", variant: "default" });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    try {
      const { data: codeData, error } = await supabase.from("two_factor_codes").insert({
        user_id: user.id,
        code,
        type: "withdrawal",
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        used: false,
      }).select().single();

      if (error) throw error;

      // Send email with the code
      if (codeData) {
        try {
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-2fa-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ""}`,
            },
            body: JSON.stringify({ record: codeData }),
          });
        } catch (emailError) {
          console.error("Error sending 2FA email:", emailError);
          // Continue despite email error
        }
      }

      setTwoFactorCode(code);
      setOtpSent(true);
      toast({ title: t("common.success"), description: t("withdraw.otpSent") });
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    }
  };

  const verifyTwoFactorCode = async () => {
    if (!user || !verificationCode || !pendingRequest) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("two_factor_codes")
        .select("*")
        .eq("user_id", user.id)
        .eq("code", verificationCode)
        .eq("type", "withdrawal")
        .eq("used", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast({ title: t("common.error"), description: t("withdraw.invalidOtp"), variant: "destructive" });
        setSubmitting(false);
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        toast({ title: t("common.error"), description: t("withdraw.invalidOtp"), variant: "destructive" });
        setSubmitting(false);
        return;
      }

      const { error: markError } = await supabase
        .from("two_factor_codes")
        .update({ used: true })
        .eq("id", data.id);
      if (markError) throw markError;

      if (transactionToken) {
        const { error: tokenError } = await supabase
          .from("transaction_tokens")
          .update({ used: true })
          .eq("user_id", user.id)
          .eq("token", transactionToken)
          .eq("type", "withdrawal");

        if (tokenError) throw tokenError;
      }

      setOtpVerified(true);
      toast({ title: t("common.success"), description: t("withdraw.otpVerified") });

      await submitWithdrawal();
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <span className="px-2 py-1 text-xs rounded-full bg-accent/20 text-accent flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {t("withdraw.approved")}</span>;
      case "rejected":
        return <span className="px-2 py-1 text-xs rounded-full bg-destructive/20 text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {t("withdraw.rejected")}</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {t("withdraw.pending")}</span>;
    }
  };

  if (profile?.is_frozen) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <div className="p-8 rounded-xl border border-destructive/50 bg-destructive/10 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t("withdraw.frozen")}</h2>
            <p className="text-muted-foreground">{t("withdraw.frozenMessage")}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 px-4 sm:px-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t("withdraw.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("withdraw.subtitle")}</p>
        </div>

        {withdrawalGuard?.blocked && (
          <Alert className="border-destructive/50 bg-destructive/5">
            <Lock className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive">
              <strong>{t("withdraw.frozen")}:</strong>
              <ul className="mt-1 list-disc list-inside text-sm">
                {withdrawalGuard.reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <KYCGuard kycStatus={profile?.kyc_status} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl border border-border bg-card min-w-0">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold">{t("withdraw.withdrawalRequest")}</h2>
                <p className="text-sm text-muted-foreground">{t("withdraw.fillDetails")}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("withdraw.selectWallet")} *</Label>
                <Select value={walletType} onValueChange={(v) => setWalletType(v as WalletType)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("withdraw.chooseWallet")} />
                  </SelectTrigger>
                  <SelectContent>
                    {walletTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {walletDisplayNames[type]} (${getWalletBalance(wallets, type).toLocaleString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {walletType === "trading_principal" && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    {t("withdraw.investmentWithdrawalWarning")}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t("withdraw.amount")} ($) *</Label>
                <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
                {walletType && (
                  <p className="text-xs text-muted-foreground">
                    {t("withdraw.available")}: ${getWalletBalance(wallets, walletType).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t("withdraw.bankName")} *</Label>
                <Input placeholder={t("withdraw.bankName")} value={bankDetails.bankName} onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label>{t("withdraw.accountHolder")} *</Label>
                <Input placeholder={t("withdraw.accountHolder")} value={bankDetails.accountName} onChange={(e) => setBankDetails({ ...bankDetails, accountName: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label>{t("withdraw.accountNumber")} *</Label>
                <Input placeholder={t("withdraw.accountNumber")} value={bankDetails.accountNumber} onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label>{t("withdraw.routingNumber")}</Label>
                <Input placeholder={t("withdraw.routingNumber")} value={bankDetails.routingNumber} onChange={(e) => setBankDetails({ ...bankDetails, routingNumber: e.target.value })} />
              </div>

              {(profile?.two_factor_enabled || otpRequested) && otpSent && !otpVerified && (
                <div className="space-y-2 mb-4">
                  <Label>{t("withdraw.enterOtp")}</Label>
                  <Input
                    placeholder={t("withdraw.otpPlaceholder")}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                  />
                  <Button
                    className="w-full"
                    onClick={verifyTwoFactorCode}
                    disabled={submitting || !verificationCode}
                  >
                    {submitting ? t("deposit.submitting") : t("withdraw.verifyCode")}
                  </Button>
                </div>
              )}
              {requiresOtp && !otpRequested && (
                <Button
                  className="w-full mb-4"
                  variant="secondary"
                  onClick={async () => {
                    if (!withdrawalFormComplete) {
                      toast({ title: t("common.error"), description: t("errors.fillAllFields"), variant: "destructive" });
                      return;
                    }
                    setPendingRequest({ walletType: walletType as WalletType, amount: Number(amount), bankDetails });
                    await sendTwoFactorCode();
                  }}
                  disabled={!withdrawalFormComplete}
                >
                  {t("withdraw.requestOtp")}
                </Button>
              )}

              <Button 
                className="w-full" 
                onClick={submitWithdrawal}
                disabled={submitting || walletsLoading || profile?.kyc_status !== "approved" || withdrawalGuard?.blocked}
              >
                {submitting ? t("deposit.submitting") : t("withdraw.submitWithdrawal")}
              </Button>
            </div>
          </div>

          <div className="p-6 rounded-xl border border-border bg-card">
            <h2 className="font-semibold mb-4">{t("withdraw.withdrawalHistory")}</h2>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 bg-secondary/30 animate-pulse rounded-md" />
                ))}
              </div>
            ) : withdrawals && withdrawals.length > 0 ? (
              <div className="space-y-3">
                {withdrawals.map((withdrawal) => (
                  <div key={withdrawal.id} className="p-4 rounded-md bg-secondary/30">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-mono font-semibold">${Number(withdrawal.amount).toLocaleString()}</div>
                      {getStatusBadge(withdrawal.status)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {walletDisplayNames[withdrawal.wallet_type as WalletType]} • {withdrawal.created_at && format(new Date(withdrawal.created_at), "MMM dd, yyyy")}
                    </div>
                    {withdrawal.rejection_reason && (
                      <div className="mt-2 text-xs text-destructive">
                        {t("withdraw.reason")}: {withdrawal.rejection_reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">{t("withdraw.noWithdrawals")}</p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Withdraw;
