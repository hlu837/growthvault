import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { 
  LayoutDashboard, 
  Wallet, 
  TrendingUp, 
  Users, 
  Settings, 
  LogOut,
  Menu,
  X,
  Shield,
  FileCheck,
  Upload,
  MessageSquare,
  BookOpen,
  UserCog,
  Sliders,
  DollarSign,
  BadgeCheck,
  Banknote,
  ShoppingCart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, getTierDisplayName } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CurrencySelector from "@/components/CurrencySelector";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import KYCStatusBadge from "@/components/KYCStatusBadge";
import SellerApplicationNotifications from "@/components/SellerApplicationNotifications";

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { user, profile, role, signOut, isAdmin, isStaff } = useAuth();
  const { toast } = useToast();

  // Member nav items
  const memberNavItems = [
    { icon: LayoutDashboard, label: t('nav.home'), path: "/dashboard" },
    { icon: Upload, label: t('nav.deposit'), path: "/dashboard/deposit" },
    { icon: Wallet, label: t('nav.withdraw'), path: "/dashboard/withdraw" },
    { icon: TrendingUp, label: t('nav.transfer'), path: "/dashboard/transfer" },
    { icon: Shield, label: t('nav.cards'), path: "/dashboard/cards" },
    { icon: BookOpen, label: "Blog", path: "/blog" },
    { icon: ShoppingCart, label: "Marketplace", path: "/marketplace" },
    { icon: DollarSign, label: "Investments", path: "/dashboard/investments" },
    { icon: Shield, label: t('nav.activity'), path: "/dashboard/activity" },
    { icon: DollarSign, label: t('nav.savings'), path: "/dashboard/savings" },
    { icon: Banknote, label: "Loans", path: "/dashboard/loans" },
    { icon: Shield, label: "Surety Requests", path: "/dashboard/surety-requests" },
    { icon: Users, label: t('nav.referrals'), path: "/dashboard/referrals" },
    { icon: Users, label: "My Network", path: "/dashboard/network" },
    { icon: BadgeCheck, label: t('nav.verifyIdentity'), path: "/dashboard/kyc" },
    { icon: Settings, label: t('nav.settings'), path: "/dashboard/settings" },
  ];

  // Staff nav items (accessible by both staff and admin)
  const staffNavItems = [
    { icon: FileCheck, label: t('nav.kycVerification'), path: "/admin/kyc" },
    { icon: Upload, label: t('nav.depositVerification'), path: "/staff/deposits" },
    { icon: MessageSquare, label: t('nav.supportTickets'), path: "/staff/tickets" },
    { icon: Users, label: t('nav.userSupport'), path: "/staff/users" },
    { icon: BookOpen, label: t('nav.viewLedger'), path: "/staff/ledger" },
  ];

  // Admin-only nav items
  const adminNavItems = [
    { icon: Shield, label: t('nav.adminDashboard'), path: "/admin" },
    { icon: UserCog, label: t('nav.userManagement'), path: "/admin/users" },
    { icon: Sliders, label: t('nav.systemSettings'), path: "/admin/settings" },
    { icon: DollarSign, label: t('nav.fullLedger'), path: "/admin/ledger" },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const userInitials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "??";

  const tierDisplay = getTierDisplayName(profile?.investment_tier);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed lg:sticky top-0 z-50 h-screen w-64 bg-card border-border flex flex-col transition-transform duration-300",
          isRTL ? "right-0 border-l" : "left-0 border-r",
          sidebarOpen 
            ? "translate-x-0" 
            : isRTL 
              ? "translate-x-full lg:translate-x-0" 
              : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3">
            <img src="/logo.png" alt="GWA logo" className="w-12 h-12 rounded-md shadow-md" />
            <span className="font-semibold tracking-tight">GWA</span>
          </Link>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {/* Member Navigation */}
          {memberNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-md text-sm transition-all",
                  isActive 
                    ? "bg-secondary text-foreground" 
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}

          {/* Staff Section */}
          {(isAdmin || isStaff) && (
            <>
              <Separator className="my-4" />
              <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('nav.staffTools')}
              </div>
              {staffNavItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-md text-sm transition-all",
                      isActive 
                        ? "bg-secondary text-foreground" 
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </>
          )}

          {/* Admin Section */}
          {isAdmin && (
            <>
              <Separator className="my-4" />
              <div className="px-4 py-2 text-xs font-medium text-destructive uppercase tracking-wider">
                {t('nav.adminOnly')}
              </div>
              {adminNavItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-md text-sm transition-all",
                      isActive 
                        ? "bg-destructive/10 text-destructive border border-destructive/20" 
                        : "text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-4 py-3 rounded-md bg-secondary/50 mb-3">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
              <span className="text-sm font-medium">{userInitials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{profile?.full_name || "User"}</span>
                <KYCStatusBadge status={profile?.kyc_status} />
              </div>
              <div className="text-xs text-muted-foreground truncate">{tierDisplay} {role === "admin" ? "(Admin)" : role === "staff" ? "(Staff)" : ""}</div>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
            onClick={handleSignOut}
          >
            <LogOut className={cn("w-4 h-4", isRTL && "rtl:flip")} />
            {t('nav.signOut')}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div 
        className="flex-1 flex flex-col min-h-screen relative"
        style={{
          background: 'radial-gradient(circle at top left, rgba(56, 189, 248, 0.08), transparent 25%), radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.08), transparent 22%), linear-gradient(180deg, rgba(15, 23, 42, 1), rgba(15, 23, 42, 0.92))',
        }}
      >
        {/* Background overlay for readability */}
        <div className="absolute inset-0 bg-background/60" />
        
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-16 border-b border-border bg-background/60 backdrop-blur-xl flex items-center justify-between px-6 relative">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="lg:flex-1" />

          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <LanguageSwitcher />
            {/* Currency Selector */}
            <CurrencySelector />
            {/* Unified Notifications */}
            <SellerApplicationNotifications />

            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full bg-secondary hover:bg-secondary/80 active:scale-95 transition-all"
                >
                  <span className="text-sm font-medium">{userInitials}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-popover border border-border">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{profile?.full_name || "User"}</span>
                    <span className="text-xs font-normal text-muted-foreground">{profile?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/dashboard/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  {t('nav.settings')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className={cn("mr-2 h-4 w-4", isRTL && "rtl:flip")} />
                  {t('nav.signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 relative z-10">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
