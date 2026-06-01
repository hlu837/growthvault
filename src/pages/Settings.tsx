import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { User, Bell, Shield, CreditCard, Loader2, Upload, FileCheck, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { webauthn } from "@/utils/webauthn";

const ID_TYPES = [
  { value: "national_id", label: "National ID" },
  { value: "passport", label: "Passport" },
  { value: "drivers_license", label: "Driver's License" },
];

const Settings = () => {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({ full_name: "", email: "", preferred_currency: "USD" });
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorMethod, setTwoFactorMethod] = useState<"email" | "passkey" | "fingerprint">("email");
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(null);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [notifications, setNotifications] = useState({
    investment: true,
    referral: true,
    withdrawal: true,
    marketing: false,
  });
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: "", new: "", confirm: "" });

  useEffect(() => {
    if (!profile) return;
    setFormData({
      full_name: profile.full_name || "",
      email: profile.email || "",
      preferred_currency: profile.preferred_currency || "USD",
    });
    setTwoFactorEnabled(Boolean(profile.two_factor_enabled));
    setTwoFactorMethod((profile.two_factor_method as "email" | "passkey" | "fingerprint") || "email");
    if (profile.notification_preferences) {
      setNotifications(profile.notification_preferences);
    }
  }, [profile]);

  const toggleTwoFactor = async () => {
    if (!user) return;
    if (twoFactorEnabled) {
      setIsLoading(true);
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ two_factor_enabled: false })
          .eq("id", user.id);
        if (error) throw error;
        setTwoFactorEnabled(false);
        toast.success("2FA disabled successfully");
      } catch (error: any) {
        toast.error("Failed to disable 2FA: " + error.message);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (twoFactorMethod === "passkey" || twoFactorMethod === "fingerprint") {
      setIsLoading(true);
      try {
        const credential = await webauthn.registerPasskey(user.id, profile?.email || "user@example.com");
        if (credential) {
          const { error: insertError } = await supabase.from("passkey_credentials").insert({
            user_id: user.id,
            credential_id: credential.credential_id,
            public_key: credential.public_key,
          });
          if (insertError) throw insertError;

          const { error: updateError } = await supabase
            .from("profiles")
            .update({ two_factor_enabled: true, two_factor_method: twoFactorMethod })
            .eq("id", user.id);
          if (updateError) throw updateError;

          setTwoFactorEnabled(true);
          toast.success("Biometric passkey registered successfully!");
        } else {
          toast.error("Passkey registration was cancelled.");
        }
      } catch (error: any) {
        toast.error("Failed to register passkey: " + error.message);
      } finally {
        setIsLoading(false);
      }
    } else {
      await generate2FAToken();
    }
  };

  const generate2FAToken = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .rpc("generate_2fa_token");

      if (error) throw error;

      setTwoFactorToken(data);
      setVerificationCode("");
      setShow2FAModal(true);
      toast.success("2FA token generated. Please save your backup code!");
    } catch (error: any) {
      toast.error("Failed to generate 2FA token: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const verify2FAToken = async (token: string, code: string) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .rpc("verify_2fa_token", { p_token: token, p_code: code });

      if (error) throw error;

      if (data) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ two_factor_enabled: true, two_factor_method: twoFactorMethod })
          .eq("id", user.id);

        if (updateError) throw updateError;

        setTwoFactorEnabled(true);
        setShow2FAModal(false);
        setTwoFactorToken(null);
        toast.success("2FA verification successful! Your account is now secured.");
      } else {
        toast.error("Invalid 2FA code. Please try again.");
      }
    } catch (error: any) {
      toast.error("Failed to verify 2FA token: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          preferred_currency: formData.preferred_currency,
          two_factor_method: twoFactorMethod,
          notification_preferences: notifications,
        })
        .eq("id", user.id);
      if (error) throw error;
      toast.success(t("success.profileUpdated"));
    } catch (error: any) {
      toast.error(error.message || t("errors.somethingWentWrong"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationChange = (key: keyof typeof notifications, value: boolean) => {
    const updated = { ...notifications, [key]: value };
    setNotifications(updated);
    saveNotificationPreferences(updated);
  };

  const saveNotificationPreferences = async (prefs: typeof notifications) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ notification_preferences: prefs })
        .eq("id", user.id);
      if (error) throw error;
      toast.success(t("success.notificationPreferencesUpdated") || "Notification preferences updated");
    } catch (error: any) {
      toast.error(error.message || t("errors.somethingWentWrong"));
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.new !== passwordData.confirm) {
      toast.error("New passwords do not match");
      return;
    }
    if (passwordData.new.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (!user) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.new
      });
      if (error) throw error;
      toast.success("Password changed successfully");
      setShowChangePasswordModal(false);
      setPasswordData({ current: "", new: "", confirm: "" });
    } catch (error: any) {
      toast.error(error.message || "Failed to change password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!validTypes.includes(selectedFile.type)) { toast.error(t("settings.fileTypes")); return; }
      if (selectedFile.size > 5 * 1024 * 1024) { toast.error("Maximum file size is 5MB"); return; }
      setFile(selectedFile);
    }
  };

  const handleKYCSubmit = async () => {
    if (!idType || !idNumber || !file) { toast.error(t("errors.fillAllFields")); return; }
    if (!user) return;
    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("kyc-documents").upload(fileName, file);
      if (uploadError) throw uploadError;
      const { error: updateError } = await supabase.from("profiles").update({
        id_type: idType, id_number: idNumber, kyc_document_url: fileName,
        kyc_status: "pending", kyc_submitted_at: new Date().toISOString(),
      }).eq("id", user.id);
      if (updateError) throw updateError;
      toast.success(t("success.verificationSubmitted"));
      setFile(null); setIdType(""); setIdNumber("");
    } catch (error: any) {
      toast.error(error.message || t("errors.somethingWentWrong"));
    } finally {
      setUploading(false);
    }
  };

  const renderKYCStatus = () => {
    if (profile?.kyc_status === "approved") {
      return (
        <div className="p-4 rounded-md border border-accent/50 bg-accent/10">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-accent" />
            <div>
              <p className="font-medium text-accent text-sm">{t("settings.identityVerified")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.fullAccess")}</p>
            </div>
          </div>
        </div>
      );
    }
    if (profile?.kyc_status === "pending" && profile?.kyc_document_url) {
      return (
        <div className="p-4 rounded-md border border-warning/50 bg-warning/10">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-warning" />
            <div>
              <p className="font-medium text-warning text-sm">{t("settings.verificationPending")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.reviewTime")}</p>
            </div>
          </div>
        </div>
      );
    }
    if (profile?.kyc_status === "rejected") {
      return (
        <div className="p-4 rounded-md border border-destructive/50 bg-destructive/10 mb-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive text-sm">{t("settings.verificationRejected")}</p>
              <p className="text-xs text-muted-foreground">{t("settings.resubmit")}</p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const showKYCForm = !profile?.kyc_status || profile?.kyc_status === "rejected" || (profile?.kyc_status === "pending" && !profile?.kyc_document_url);

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t("settings.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("settings.subtitle")}</p>
        </div>

        {/* Profile */}
        <div className="p-6 rounded-md border border-border bg-card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center"><User className="w-5 h-5" /></div>
            <div>
              <h2 className="font-semibold">{t("settings.profile")}</h2>
              <p className="text-sm text-muted-foreground">{t("settings.profileDesc")}</p>
            </div>
          </div>
          <div className="grid gap-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">{t("settings.fullName")}</Label>
                <Input id="fullName" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} className="bg-background" placeholder={t("settings.fullNamePlaceholder")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t("settings.email")}</Label>
                <Input id="email" type="email" value={formData.email} className="bg-background" disabled />
                <p className="text-xs text-muted-foreground">{t("settings.emailReadOnly")}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">{t("settings.preferredCurrency")}</Label>
              <Select value={formData.preferred_currency} onValueChange={(value) => setFormData({ ...formData, preferred_currency: value })}>
                <SelectTrigger className="bg-background"><SelectValue placeholder={t("settings.selectCurrency")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound</SelectItem>
                  <SelectItem value="NGN">NGN - Nigerian Naira</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSaveProfile} disabled={isLoading} className="w-fit">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("settings.saveChanges")}
            </Button>
          </div>
        </div>

        {/* KYC */}
        <div className="p-6 rounded-md border border-border bg-card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center"><Shield className="w-5 h-5" /></div>
            <div>
              <h2 className="font-semibold">{t("settings.identity")}</h2>
              <p className="text-sm text-muted-foreground">{t("settings.identityDesc")}</p>
            </div>
          </div>
          {renderKYCStatus()}
          {showKYCForm && (
            <div className="space-y-4 mt-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("settings.idType")} *</Label>
                  <Select value={idType} onValueChange={setIdType}>
                    <SelectTrigger className="bg-background"><SelectValue placeholder={t("settings.selectIdType")} /></SelectTrigger>
                    <SelectContent>
                      {ID_TYPES.map((type) => (<SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("settings.idNumber")} *</Label>
                  <Input placeholder={t("settings.idNumberPlaceholder")} value={idNumber} onChange={(e) => setIdNumber(e.target.value)} className="bg-background" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("settings.uploadDocument")} *</Label>
                <div className="border border-dashed border-border rounded-md p-6 text-center bg-background">
                  {file ? (
                    <div className="space-y-2">
                      <FileCheck className="w-8 h-8 mx-auto text-accent" />
                      <p className="text-sm text-muted-foreground">{file.name}</p>
                      <Button variant="ghost" size="sm" onClick={() => setFile(null)}>{t("common.remove")}</Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block">
                      <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground mb-1">{t("settings.clickToUpload")}</p>
                      <p className="text-xs text-muted-foreground">{t("settings.fileTypes")}</p>
                      <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={handleFileChange} className="hidden" />
                    </label>
                  )}
                </div>
              </div>
              <Button onClick={handleKYCSubmit} disabled={uploading || !idType || !idNumber || !file} className="w-full sm:w-fit">
                {uploading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("settings.submitting")}</>) : t("settings.submitVerification")}
              </Button>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="p-6 rounded-md border border-border bg-card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center"><Bell className="w-5 h-5" /></div>
            <div>
              <h2 className="font-semibold">{t("settings.notifications")}</h2>
              <p className="text-sm text-muted-foreground">{t("settings.notificationsDesc")}</p>
            </div>
          </div>
          <div className="space-y-4">
            {[
              { id: "investment", label: t("settings.investmentUpdates"), description: t("settings.investmentUpdatesDesc") },
              { id: "referral", label: t("settings.referralActivity"), description: t("settings.referralActivityDesc") },
              { id: "withdrawal", label: t("settings.withdrawalNotifications"), description: t("settings.withdrawalNotificationsDesc") },
              { id: "marketing", label: t("settings.marketingEmails"), description: t("settings.marketingEmailsDesc") },
            ].map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 rounded-md bg-secondary/30">
                <div>
                  <div className="font-medium text-sm">{item.label}</div>
                  <div className="text-sm text-muted-foreground">{item.description}</div>
                </div>
                <Switch 
                  checked={notifications[item.id as keyof typeof notifications]}
                  onCheckedChange={(value) => handleNotificationChange(item.id as keyof typeof notifications, value)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Security */}
        <div className="p-6 rounded-md border border-border bg-card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center"><Shield className="w-5 h-5" /></div>
            <div>
              <h2 className="font-semibold">{t("settings.security")}</h2>
              <p className="text-sm text-muted-foreground">{t("settings.securityDesc")}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid gap-4">
              <div className="p-4 rounded-md bg-secondary/30">
                <div className="font-medium text-sm mb-2">{t("settings.twoFactor")}</div>
                <div className="text-sm text-muted-foreground mb-4">{t("settings.twoFactorDesc")}</div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="twoFactorMethod" className="text-sm font-medium">Two-factor method</Label>
                    <Select value={twoFactorMethod} onValueChange={(value) => setTwoFactorMethod(value as "email" | "passkey" | "fingerprint") }>
                      <SelectTrigger id="twoFactorMethod" className="bg-background"><SelectValue placeholder="Select a method" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email OTP</SelectItem>
                        <SelectItem value="passkey">Passkey</SelectItem>
                        <SelectItem value="fingerprint">Fingerprint</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {twoFactorMethod === "passkey" || twoFactorMethod === "fingerprint"
                      ? "Use WebAuthn passkey authentication when available. Otherwise, a fallback email OTP will be used."
                      : "Receive a one-time code by email for withdrawal verification."}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 rounded-md bg-secondary/30">
                <div>
                  <div className="font-medium text-sm">{t("settings.twoFactorToggle")}</div>
                  <div className="text-sm text-muted-foreground">{twoFactorEnabled ? t("settings.twoFactorEnabledDesc") : t("settings.twoFactorDisabledDesc")}</div>
                </div>
                <Button
                  variant={twoFactorEnabled ? "secondary" : "outline"}
                  size="sm"
                  onClick={toggleTwoFactor}
                  disabled={isLoading || !user}
                >
                  {twoFactorEnabled ? t("common.disable") : t("common.enable")}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 rounded-md bg-secondary/30">
              <div>
                <div className="font-medium text-sm">{t("settings.changePassword")}</div>
                <div className="text-sm text-muted-foreground">{t("settings.changePasswordDesc")}</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowChangePasswordModal(true)}>{t("common.update")}</Button>
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="p-6 rounded-md border border-border bg-card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center"><CreditCard className="w-5 h-5" /></div>
            <div>
              <h2 className="font-semibold">{t("settings.paymentMethods")}</h2>
              <p className="text-sm text-muted-foreground">{t("settings.paymentMethodsDesc")}</p>
            </div>
          </div>
          <div className="p-8 rounded-md border border-dashed border-border text-center">
            <CreditCard className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">{t("settings.noPaymentMethods")}</p>
            <Button variant="outline">{t("settings.addPaymentMethod")}</Button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="p-6 rounded-md border border-destructive/30 bg-destructive/5">
          <h2 className="font-semibold text-destructive mb-2">{t("settings.dangerZone")}</h2>
          <p className="text-sm text-muted-foreground mb-4">{t("settings.deleteAccountDesc")}</p>
          <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10">{t("settings.deleteAccount")}</Button>
      </div>

        {/* 2FA Verification Modal */}
        {show2FAModal && twoFactorToken && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Two-Factor Authentication Setup</h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Backup Code</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Save this code securely. You can use it to access your account if you lose your 2FA device.
                  </p>
                  <div className="p-3 bg-gray-100 rounded font-mono text-center text-lg">
                    {twoFactorToken}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Verification Code</Label>
                  <Input
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    className="text-center text-lg"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShow2FAModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={() => verify2FAToken(twoFactorToken, verificationCode)}>
                    Verify
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Change Password Modal */}
        {showChangePasswordModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 dark:bg-slate-900">
              <h3 className="text-lg font-semibold mb-4">{t("settings.changePassword")}</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("settings.currentPassword")}</Label>
                  <Input
                    type="password"
                    value={passwordData.current}
                    onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                    placeholder="Enter current password"
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("settings.newPassword")}</Label>
                  <Input
                    type="password"
                    value={passwordData.new}
                    onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                    placeholder="Enter new password"
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("settings.confirmPassword")}</Label>
                  <Input
                    type="password"
                    value={passwordData.confirm}
                    onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
                    placeholder="Confirm new password"
                    className="bg-background"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowChangePasswordModal(false)}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button 
                    onClick={handleChangePassword}
                    disabled={isLoading || !passwordData.current || !passwordData.new || !passwordData.confirm}
                  >
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("common.save")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Settings;
