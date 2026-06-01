import { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Eye, EyeOff, Mail, Lock, User, Gift } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { useTranslation } from "react-i18next";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
const Auth = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const initialRef = searchParams.get("ref") || "";
  const [mode, setMode] = useState<"login" | "signup" | "forgot">(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const { toast } = useToast();
  const { signIn, signUp, user, twoFactorPending, confirmTwoFactorCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || null;

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    referralCode: initialRef,
  });
  const [twoFactorMode, setTwoFactorMode] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");

  // Redirect if already logged in (but NOT if 2FA is pending or showing 2FA form)
  useEffect(() => {
    if (user && !twoFactorPending && !twoFactorMode) {
      navigate(from || "/dashboard", { replace: true });
    }
  }, [user, twoFactorPending, twoFactorMode, from, navigate]);

  if (user && !twoFactorPending && !twoFactorMode) {
    return null;
  }

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    const emailResult = emailSchema.safeParse(formData.email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }

    const passwordResult = passwordSchema.safeParse(formData.password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleVerifyTwoFactor = async () => {
    if (!verificationCode) {
      toast({ title: t('common.error'), description: t('auth.enterTwoFactorCode'), variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await confirmTwoFactorCode(verificationCode);
      if (error) {
        toast({ title: t('common.error'), description: error.message || 'Invalid two-factor code', variant: 'destructive' });
      } else {
        toast({ title: 'Login successful', description: 'Redirecting to dashboard...' });
        navigate(from || '/dashboard');
      }
    } catch (err) {
      toast({ title: t('common.error'), description: 'Unexpected error during two-factor verification', variant: 'destructive' });
    }
    setIsLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailResult = emailSchema.safeParse(formData.email);
    if (!emailResult.success) {
      setErrors({ email: emailResult.error.errors[0].message });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/auth?mode=reset`,
      });
      
      if (error) {
        toast({
          title: t('common.error'),
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: t('auth.checkEmail'),
          description: t('auth.resetLinkSent'),
        });
        setMode("login");
      }
    } catch (err) {
      toast({
        title: t('common.error'),
        description: t('errors.unexpectedError'),
        variant: "destructive",
      });
    }
    
    setIsLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailResult = emailSchema.safeParse(formData.email);
    const passwordResult = passwordSchema.safeParse(formData.password);

    if (!emailResult.success || !passwordResult.success) {
      setErrors({
        email: emailResult.error?.errors[0]?.message || "Invalid email",
        password: passwordResult.error?.errors[0]?.message || "Invalid password",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await signIn(formData.email, formData.password);
      
      if (error) {
        toast({
          title: t('common.error'),
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: t('auth.signInSuccess'),
          description: t('auth.welcomeBack'),
        });
        
        // Add manual redirect as fallback
        setTimeout(() => {
          if (!twoFactorPending) {
            navigate(from || "/dashboard", { replace: true });
          }
        }, 500);
        
        // Also try immediate redirect
        if (!twoFactorPending && window.location.pathname === '/auth') {
          navigate(from || "/dashboard", { replace: true });
        }
      }
    } catch (err) {
      toast({
        title: t('common.error'),
        description: t('errors.unexpectedError'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);

    try {
      if (mode === "login") {
        console.log("🔐 handleSubmit: Calling signIn for", formData.email);
        const result = await signIn(formData.email, formData.password);
        
        console.log("🔐 handleSubmit: signIn result:", result);

        if (result.error) {
          console.error("❌ Sign in error result:", result.error);
          toast({
            title: t('common.error'),
            description: result.error.message,
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        if (result.twoFactorRequired) {
          console.log("✅ 2FA Required - showing 2FA form");
          setTwoFactorMode(true);
          toast({
            title: "Two-factor code sent",
            description: "Please enter the code that was sent to your email.",
          });
          setIsLoading(false);
          return;
        }

        console.log("✅ No 2FA required - redirecting to dashboard");
        toast({
          title: t('auth.welcomeBack'),
          description: t('auth.redirectingToDashboard'),
        });
        navigate(from || "/dashboard");
      } else {
        const { error } = await signUp(
          formData.email,
          formData.password,
          formData.fullName,
          formData.referralCode || undefined
        );

        if (error) {
          toast({
            title: t('auth.signUpFailed'),
            description: error.message,
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        toast({
          title: t('auth.accountCreated'),
          description: t('auth.redirectingToDashboard'),
        });
        navigate("/dashboard");
      }
    } catch (err) {
      console.error("❌ Unexpected error:", err);
      toast({
        title: t('common.error'),
        description: t('errors.unexpectedError'),
        variant: "destructive",
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-card border-r border-border p-12 flex-col justify-between">
        <div>
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            {t('auth.backToHome')}
          </Link>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-8">
            <img src="/logo.png" alt="GWA Logo" className="w-12 h-12 rounded-lg shadow-md" />
            <span className="text-2xl font-semibold tracking-tight">Golden Wealth Achievers</span>
          </div>
          
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            {mode === "login" ? t('auth.welcomeBack') : mode === "forgot" ? t('auth.resetPassword') : t('auth.joinPlatform')}
          </h1>
          <p className="text-muted-foreground text-lg max-w-md">
            {mode === "login"
              ? t('auth.accessDashboard')
              : mode === "forgot"
              ? t('auth.enterEmailReset')
              : t('auth.startJourney')}
          </p>

          <div className="mt-12 grid grid-cols-2 gap-6">
            <div className="p-4 rounded-md border border-border">
              <div className="text-2xl font-bold font-mono">50/50</div>
              <div className="text-sm text-muted-foreground">{t('auth.splitStrategy')}</div>
            </div>
            <div className="p-4 rounded-md border border-border">
              <div className="text-2xl font-bold font-mono">5 Levels</div>
              <div className="text-sm text-muted-foreground">{t('auth.referralDepth')}</div>
            </div>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          © 2026 Golden Wealth Achievers. All rights reserved.
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile back link */}
          <Link to="/" className="lg:hidden inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8">
            <ArrowLeft className="w-4 h-4" />
            {t('auth.backToHome')}
          </Link>

          <h2 className="text-2xl font-bold tracking-tight mb-2">
            {mode === "login" ? t('auth.signInToAccount') : mode === "forgot" ? t('auth.resetYourPassword') : t('auth.createAccount')}
          </h2>
          <p className="text-muted-foreground">
            {mode === "login" ? (
              <>
                {t('auth.noAccount')}{" "}
                <button
                  onClick={() => setMode("signup")}
                  className="text-foreground underline underline-offset-4 hover:text-accent transition-colors"
                >
                  {t('auth.signUp')}
                </button>
              </>
            ) : mode === "forgot" ? (
              <>
                {t('auth.rememberPassword')}{" "}
                <button
                  onClick={() => setMode("login")}
                  className="text-foreground underline underline-offset-4 hover:text-accent transition-colors"
                >
                  {t('auth.signIn')}
                </button>
              </>
            ) : (
              <>
                {t('auth.haveAccount')}{" "}
                <button
                  onClick={() => setMode("login")}
                  className="text-foreground underline underline-offset-4 hover:text-accent transition-colors"
                >
                  {t('auth.signIn')}
                </button>
              </>
            )}
          </p>

          {twoFactorMode ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="twoFactorCode" className="text-sm">Two-factor verification code</Label>
                <Input
                  id="twoFactorCode"
                  type="text"
                  placeholder="123456"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="bg-card border-border h-11"
                  maxLength={6}
                />
              </div>
              <Button onClick={handleVerifyTwoFactor} className="w-full h-11" disabled={isLoading}>
                {isLoading ? t('auth.verifying') : t('auth.verifyTwoFactor')}
              </Button>
              <div className="text-sm text-muted-foreground">
                {t('auth.twoFactorSmsInfo')}
              </div>
            </div>
          ) : mode === "forgot" ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm">{t('auth.email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      setErrors({ ...errors, email: undefined });
                    }}
                    className={`pl-10 bg-card border-border h-11 ${errors.email ? 'border-destructive' : ''}`}
                    required
                  />
                </div>
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>

              <Button type="submit" className="w-full h-11" disabled={isLoading}>
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    {t('auth.sendingResetLink')}
                  </div>
                ) : (
                  t('auth.sendResetLink')
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm">{t('auth.fullName')}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder={t('auth.fullNamePlaceholder')}
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="pl-10 bg-card border-border h-11"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm">{t('auth.email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('auth.emailPlaceholder')}
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      setErrors({ ...errors, email: undefined });
                    }}
                    className={`pl-10 bg-card border-border h-11 ${errors.email ? 'border-destructive' : ''}`}
                    required
                  />
                </div>
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm">{t('auth.password')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => {
                      setFormData({ ...formData, password: e.target.value });
                      setErrors({ ...errors, password: undefined });
                    }}
                    className={`pl-10 pr-10 bg-card border-border h-11 ${errors.password ? 'border-destructive' : ''}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>

              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="referralCode" className="text-sm">
                    {t('auth.referralCode')} <span className="text-muted-foreground">({t('common.optional')})</span>
                  </Label>
                  <div className="relative">
                    <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="referralCode"
                      type="text"
                      placeholder="ABC123"
                      value={formData.referralCode}
                      onChange={(e) => setFormData({ ...formData, referralCode: e.target.value.toUpperCase() })}
                      className={`pl-10 bg-card border-border h-11 uppercase font-mono ${initialRef ? 'opacity-70' : ''}`}
                      maxLength={20}
                      readOnly={!!initialRef}
                    />
                  </div>
                  {initialRef && (
                    <p className="text-xs text-muted-foreground">
                      ✓ Referral code applied from your invite link
                    </p>
                  )}
                </div>
              )}

              {mode === "login" && (
                <div className="flex justify-end">
                  <button 
                    type="button" 
                    onClick={() => setMode("forgot")}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t('auth.forgotPassword')}
                  </button>
                </div>
              )}

              <Button type="submit" className="w-full h-11" disabled={isLoading}>
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    {mode === "login" ? t('auth.signingIn') : t('auth.creatingAccount')}
                  </div>
                ) : (
                  mode === "login" ? t('auth.signIn') : t('auth.createAccountBtn')
                )}
              </Button>

              {(mode === "login" || mode === "signup") && (
                <p className="text-xs text-muted-foreground text-center mt-4">
                  By accessing this platform, you agree that all electronic actions constitute a legally binding signature as per Section 18.
                </p>
              )}

            </form>
          )}

          {mode === "signup" && (
            <p className="text-xs text-muted-foreground text-center mt-6">
              {t('auth.byCreating')}{" "}
              <a href="/terms" className="underline underline-offset-2 hover:text-foreground">
                {t('auth.termsOfService')}
              </a>{" "}
              {t('common.and')}{" "}
              <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">
                {t('auth.privacyPolicy')}
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
