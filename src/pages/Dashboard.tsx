import { Wallet, TrendingUp, Users, Landmark, ArrowUpRight, ArrowDownRight, Copy, Check, Network, BookOpen, Calendar, ArrowRight, ShoppingCart, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useWallets, getWalletBalance, getWalletTotalBalance, getWalletLockedBalance, isWalletLocked } from "@/hooks/useWallets";
import { useTransactions } from "@/hooks/useTransactions";
import { useTeamSize } from "@/hooks/useNetwork";
import { useLatestPosts } from "@/hooks/useBlog";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { UserStatusCard } from "@/components/UserStatusCard";
import { getTierDisplayName } from "@/lib/utils";

const Dashboard = () => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { profile } = useAuth();
  const { formatAmount, currency } = useCurrency();
  const { data: wallets, isLoading: walletsLoading } = useWallets();
  const { data: transactions, isLoading: transactionsLoading } = useTransactions(5);
  const { data: teamSize, isLoading: teamSizeLoading } = useTeamSize();
  const { data: latestPosts, isLoading: postsLoading } = useLatestPosts(3);

  const copyReferralCode = () => {
    if (!profile?.referral_code) return;
    navigator.clipboard.writeText(`${window.location.origin}/auth?mode=signup&ref=${profile.referral_code}`);
    setCopied(true);
    toast({
      title: t('common.copied'),
      description: t('dashboard.referralCopied'),
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const walletCards = [
    { 
      label: t('dashboard.savingsBalance'), 
      value: getWalletBalance(wallets, "savings"), 
      totalValue: getWalletTotalBalance(wallets, "savings"),
      lockedValue: getWalletLockedBalance(wallets, "savings"),
      icon: Wallet, 
      change: "+0%",
      positive: true,
      restricted: isWalletLocked(wallets, "savings"),
      restrictionReason: isWalletLocked(wallets, "savings") ? t('dashboard.capitalLockedUntil5thLevel') : undefined
    },
    { 
      label: t('dashboard.mlmCapital'), 
      value: getWalletBalance(wallets, "mlm_capital"), 
      totalValue: getWalletTotalBalance(wallets, "mlm_capital"),
      lockedValue: getWalletLockedBalance(wallets, "mlm_capital"),
      icon: TrendingUp, 
      change: "+0%",
      positive: true,
      restricted: isWalletLocked(wallets, "mlm_capital"),
      restrictionReason: isWalletLocked(wallets, "mlm_capital") ? t('dashboard.capitalLockedUntil5thLevel') : undefined
    },
    { 
      label: t('dashboard.mlmBonus'), 
      value: getWalletBalance(wallets, "mlm_bonus"), 
      totalValue: getWalletTotalBalance(wallets, "mlm_bonus"),
      lockedValue: getWalletLockedBalance(wallets, "mlm_bonus"),
      icon: Users, 
      change: "+0%",
      positive: true,
      restricted: isWalletLocked(wallets, "mlm_bonus"),
      restrictionReason: isWalletLocked(wallets, "mlm_bonus") ? t('dashboard.capitalLockedUntil5thLevel') : undefined
    },
    { 
      label: t('dashboard.investmentPrincipal'), 
      value: getWalletBalance(wallets, "trading_principal"), 
      totalValue: getWalletTotalBalance(wallets, "trading_principal"),
      lockedValue: getWalletLockedBalance(wallets, "trading_principal"),
      icon: Landmark, 
      change: "+0%",
      positive: true,
      restricted: isWalletLocked(wallets, "trading_principal"),
      restrictionReason: isWalletLocked(wallets, "trading_principal") ? t('dashboard.capitalLockedUntil5thLevel') : undefined
    },
  ];

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "withdrawal":
        return <ArrowUpRight className="w-4 h-4 text-destructive" />;
      case "bonus":
        return <Users className="w-4 h-4 text-accent" />;
      default:
        return <ArrowDownRight className="w-4 h-4 text-foreground" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "withdrawal":
        return "bg-destructive/20";
      case "bonus":
        return "bg-accent/20";
      default:
        return "bg-secondary";
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {t('dashboard.welcome', { name: profile?.full_name?.split(" ")[0] || t('common.user') })}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('dashboard.portfolioOverview')}
            </p>
          </div>

          {/* Referral Code */}
          <div className="flex items-center gap-3 p-4 rounded-md border border-border bg-card">
            <div className="text-sm">
              <div className="text-muted-foreground text-xs mb-1">{t('dashboard.yourReferralCode')}</div>
              <div className="font-mono font-bold text-lg">{profile?.referral_code || "------"}</div>
            </div>
            <Button 
              variant="outline" 
              size="icon"
              onClick={copyReferralCode}
              className="shrink-0"
              disabled={!profile?.referral_code}
            >
              {copied ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Account Status - Show if frozen */}
        <UserStatusCard />

        {/* Wallet Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {walletCards.map((card, index) => (
            <div
              key={index}
              className={`p-6 rounded-md border border-border bg-card hover:border-muted-foreground/50 transition-all ${
                card.restricted ? 'opacity-75' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center">
                  <card.icon className="w-5 h-5 text-foreground" />
                </div>
                <div className={`flex items-center gap-1 text-xs ${card.positive ? "text-accent" : "text-destructive"}`}>
                  {card.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {card.change}
                </div>
              </div>
              <div className="text-2xl font-bold font-mono mb-1">
                {walletsLoading ? (
                  <div className="h-8 w-24 bg-secondary animate-pulse rounded" />
                ) : (
                  formatAmount(card.value)
                )}
              </div>
              <div className="text-sm text-muted-foreground mb-2">{card.label}</div>
              
              {/* Show locked balance info if applicable */}
              {!walletsLoading && card.lockedValue && card.lockedValue > 0 && (
                <div className="text-xs text-muted-foreground mb-2">
                  <div className="flex justify-between items-center">
                    <span>{t('dashboard.totalBalance')}:</span>
                    <span className="font-mono">{formatAmount(card.totalValue)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>{t('dashboard.lockedBalance')}:</span>
                    <span className="font-mono text-yellow-600 dark:text-yellow-400">{formatAmount(card.lockedValue)}</span>
                  </div>
                </div>
              )}
              
              {card.restricted && (
                <div className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded">
                  {card.restrictionReason}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Team Size Banner */}
        <div 
          className="p-5 rounded-md border border-border bg-card hover:border-muted-foreground/50 transition-all cursor-pointer flex items-center justify-between"
          onClick={() => window.location.href = "/dashboard/network"}
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-md bg-accent/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-accent" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Team Size</div>
              <div className="text-2xl font-bold font-mono">
                {teamSizeLoading ? (
                  <div className="h-8 w-12 bg-secondary animate-pulse rounded" />
                ) : (
                  teamSize
                )}
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Users className="w-4 h-4" />
            View Network
          </Button>
        </div>

        {/* Latest News */}
        <Card className="border-border/50 bg-background/60 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-gold" />
                Latest News
              </CardTitle>
              <Link to="/blog">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1">
                  View All
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {postsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-20 bg-secondary/30 animate-pulse rounded-md" />
                ))}
              </div>
            ) : latestPosts && latestPosts.length > 0 ? (
              <div className="space-y-4">
                {latestPosts.map((post) => (
                  <div key={post.id} className="flex items-start gap-4 p-4 rounded-md bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer group">
                    <Link to={`/blog/${post.id}`} className="flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={
                              post.category === 'Tutorial' ? 'bg-blue-500/10 text-blue-600 border-blue-200' :
                              post.category === 'Announcement' ? 'bg-green-500/10 text-green-600 border-green-200' :
                              'bg-yellow-500/10 text-yellow-600 border-yellow-200'
                            }>
                              {post.category}
                            </Badge>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(post.created_at), 'MMM dd')}
                            </div>
                          </div>
                          <h3 className="font-medium text-foreground mb-1 group-hover:text-gold transition-colors line-clamp-1">
                            {post.title}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {post.excerpt}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p className="mb-4">No news articles available</p>
                <Link to="/blog">
                  <Button variant="outline" size="sm">
                    Visit Blog
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions & Quick Stats */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 p-6 rounded-md border border-border bg-card">
            <h2 className="font-semibold mb-4">{t('dashboard.quickActions')}</h2>
            <div className="space-y-3">
              <Button 
                className="w-full justify-start gap-3" 
                variant="secondary"
                onClick={() => window.location.href = "/marketplace"}
              >
                <ShoppingCart className="w-4 h-4" />
                Explore Marketplace
              </Button>
              <Link to="/seller/application">
                <Button 
                  className="w-full justify-start gap-3" 
                  variant="secondary"
                >
                  <Store className="w-4 h-4" />
                  Become a Seller
                </Button>
              </Link>
              <Button 
                className="w-full justify-start gap-3" 
                variant="secondary"
                onClick={() => window.location.href = "/dashboard/investments"}
              >
                <TrendingUp className="w-4 h-4" />
                {t('dashboard.newInvestment')}
              </Button>
              <Button 
                className="w-full justify-start gap-3" 
                variant="secondary"
                onClick={() => window.location.href = "/dashboard/referrals"}
              >
                <Users className="w-4 h-4" />
                {t('dashboard.viewReferrals')}
              </Button>
              <Button 
                className="w-full justify-start gap-3" 
                variant="outline"
                disabled={profile?.is_frozen}
                onClick={() => window.location.href = "/dashboard/withdraw"}
              >
                <Wallet className="w-4 h-4" />
                {profile?.is_frozen ? t('dashboard.withdrawalFrozen') : t('dashboard.requestWithdrawal')}
              </Button>
            </div>

            {/* Tier Badge */}
            <div className="mt-6 p-4 rounded-md bg-accent/10 border border-accent/20">
              <div className="text-xs text-muted-foreground mb-1">{t('dashboard.currentTier')}</div>
              <div className="font-semibold text-accent">
                {getTierDisplayName(profile?.investment_tier)}
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="lg:col-span-2 p-6 rounded-md border border-border bg-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">{t('dashboard.recentTransactions')}</h2>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                {t('common.viewAll')}
              </Button>
            </div>
            <div className="space-y-3">
              {transactionsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 bg-secondary/30 animate-pulse rounded-md" />
                ))
              ) : transactions && transactions.length > 0 ? (
                transactions.map((tx) => (
                  <div 
                    key={tx.id}
                    className="flex items-center justify-between p-4 rounded-md bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getTransactionColor(tx.transaction_type)}`}>
                        {getTransactionIcon(tx.transaction_type)}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{tx.description || tx.transaction_type}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(tx.created_at), "MMM dd, yyyy")}
                        </div>
                      </div>
                    </div>
                    <div className={`font-mono font-medium ${
                      tx.transaction_type === "withdrawal" ? "text-destructive" : "text-accent"
                    }`}>
                      {tx.transaction_type === "withdrawal" ? "-" : "+"}{formatAmount(Number(tx.amount))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>{t('dashboard.noTransactions')}</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => window.location.href = "/dashboard/investments"}
                  >
                    {t('dashboard.makeFirstInvestment')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
