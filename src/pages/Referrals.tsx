import { Copy, Check, Users, TrendingUp, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useReferrals, useReferralStats } from "@/hooks/useReferrals";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

const Referrals = () => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuth();
  const { data: referrals, isLoading: referralsLoading } = useReferrals();
  const { stats } = useReferralStats();

  const referralLink = `${window.location.origin}/auth?mode=signup&ref=${profile?.referral_code || ""}`;

  const copyLink = () => {
    if (!profile?.referral_code) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast({
      title: t("referrals.copied"),
      description: t("dashboard.referralCopied"),
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {t("referrals.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("referrals.subtitle")}
          </p>
        </div>

        <div className="p-6 rounded-md border border-border bg-card">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">{t("referrals.uniqueLink")}</div>
              <div className="flex items-center gap-2">
                <code className="font-mono text-sm bg-secondary px-3 py-2 rounded-md break-all">
                  {referralLink}
                </code>
              </div>
            </div>
            <Button onClick={copyLink} className="gap-2 shrink-0" disabled={!profile?.referral_code}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? t("referrals.copied") : t("referrals.copyLink")}
            </Button>
          </div>

          <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
              <Gift className="w-3 h-3 text-accent" />
            </div>
            {t("referrals.shareCommission")}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-md border border-border bg-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono">{stats.totalReferrals}</div>
            <div className="text-sm text-muted-foreground">{t("referrals.directReferrals")}</div>
          </div>

          <div className="p-5 rounded-md border border-border bg-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-md bg-accent/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-accent" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono text-accent">
              ${stats.totalEarnings.toFixed(2)}
            </div>
            <div className="text-sm text-muted-foreground">{t("referrals.totalEarnings")}</div>
          </div>

          <div className="p-5 rounded-md border border-border bg-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-md bg-warning/20 flex items-center justify-center">
                <Gift className="w-4 h-4 text-warning" />
              </div>
            </div>
            <div className="text-2xl font-bold font-mono">
              ${stats.pendingEarnings.toFixed(2)}
            </div>
            <div className="text-sm text-muted-foreground">{t("referrals.pendingEarnings")}</div>
          </div>

          <div className="p-5 rounded-md border border-border bg-card">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
                stats.loanEligible ? "bg-accent/20" : "bg-destructive/20"
              }`}>
                <Check className={`w-4 h-4 ${stats.loanEligible ? "text-accent" : "text-destructive"}`} />
              </div>
            </div>
            <div className={`text-lg font-bold ${stats.loanEligible ? "text-accent" : "text-destructive"}`}>
              {stats.loanEligible ? t("referrals.eligible") : t("referrals.notEligible")}
            </div>
            <div className="text-sm text-muted-foreground">{t("referrals.loanStatus")}</div>
          </div>
        </div>

        <div className="p-4 rounded-md border border-border bg-card">
          <h3 className="font-semibold mb-3">{t("referrals.commissionStructure")}</h3>
          <div className="grid grid-cols-5 gap-2">
            {[
              { level: 1, rate: "5%" },
              { level: 2, rate: "3%" },
              { level: 3, rate: "2%" },
              { level: 4, rate: "1%" },
              { level: 5, rate: "0.5%" },
            ].map((item) => (
              <div key={item.level} className="text-center p-3 rounded-md bg-secondary/50">
                <div className="text-xs text-muted-foreground mb-1">{t("referrals.level", { level: item.level })}</div>
                <div className="font-mono font-bold text-accent">{item.rate}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold">{t("referrals.directReferrals")} ({t("referrals.level", { level: 1 })})</h2>
            <span className="text-sm text-muted-foreground">
              {referrals?.length || 0} {(referrals?.length || 0) === 1 ? t("referrals.member") : t("referrals.members")}
            </span>
          </div>

          {referralsLoading ? (
            <div className="p-8">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-secondary/30 animate-pulse rounded-md mb-2" />
              ))}
            </div>
          ) : !referrals || referrals.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-medium mb-2">{t("referrals.noReferrals")}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("referrals.shareToStart")}
              </p>
              <Button onClick={copyLink} variant="outline" className="gap-2" disabled={!profile?.referral_code}>
                <Copy className="w-4 h-4" />
                {t("referrals.copyReferralLink")}
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {referrals.map((referral) => (
                <div key={referral.id} className="p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                      <span className="text-sm font-medium">
                        {referral.referred_profile?.full_name
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("") || "??"}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium">{referral.referred_profile?.full_name || "Unknown"}</div>
                      <div className="text-sm text-muted-foreground">{referral.referred_profile?.email || ""}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-muted-foreground">{t("referrals.tier")}</div>
                      <div className="text-sm font-medium">
                        {referral.referred_profile?.investment_tier || "Bronze"}
                      </div>
                    </div>
                    <div className="text-right hidden md:block">
                      <div className="text-xs text-muted-foreground">{t("referrals.joined")}</div>
                      <div className="text-sm">
                        {format(new Date(referral.created_at), "MMM dd, yyyy")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">{t("referrals.earned")}</div>
                      <div className="text-sm font-mono font-medium text-accent">
                        +${Number(referral.earnings).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Referrals;
