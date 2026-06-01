import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { 
  Shield,
  AlertTriangle,
  CreditCard,
  Upload, 
  Users, 
  LogOut,
  Menu,
  X,
  Bell,
  Settings,
  FileCheck,
  MessageSquare,
  Power,
  Wallet,
  Landmark,
  SlidersHorizontal,
  Activity,
  BookOpen,
  ShoppingCart,
  UserCheck,
  Scale,
  Lock,
  FileText,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import LanguageSwitcher from "@/components/LanguageSwitcher";

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isRTL } = useLanguage();
  const { user, profile, signOut, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const { data: notifications = [], isLoading: notificationsLoading, refetch: refetchNotifications } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: pendingDocumentUploads = [] } = useQuery({
    queryKey: ["admin-pending-marketplace-documents"],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("marketplace_documents")
        .select(`id, verifications:document_verifications(id)`);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: pendingSellerApplications = [] } = useQuery({
    queryKey: ["admin-pending-seller-applications-count"],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("seller_applications")
        .select("id")
        .eq("status", "pending");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const pendingDocumentCount = (pendingDocumentUploads as any[]).filter((doc) => !doc.verifications || doc.verifications.length === 0).length;

  const pendingSellerCount = pendingSellerApplications.length;

  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  const marketplaceNavItems = [
    { icon: Shield, label: "Dashboard", path: "/admin", description: "Overview and platform health" },
    { icon: Users, label: "Users", path: "/admin/users", description: "User account management" },
    { icon: UserCheck, label: "Sellers", path: "/admin/seller-applications", description: "Review seller applications" },
    { icon: ShoppingCart, label: "Listings", path: "/admin/marketplace", description: "Marketplace listing management" },
    { icon: Wallet, label: "Orders", path: "/admin/transactions", description: "Transaction and commission review" },
    { icon: Lock, label: "Escrow", path: "/admin/escrow", description: "Manage escrow funds" },
    { icon: Scale, label: "Disputes", path: "/admin/disputes", description: "Manage order disputes" },
    { icon: CreditCard, label: "Reports", path: "/admin/revenue", description: "Revenue and analytics" },
    { icon: Settings, label: "Settings", path: "/admin/settings", description: "Platform configuration" },
    { icon: Bell, label: "Notifications", path: "/admin/notifications", description: "Send and manage alerts" },
  ];

  const systemUtilitiesItems = [
    { icon: Power, label: t("admin.nav.globalFreeze"), path: "/admin/freeze", description: t("admin.nav.globalFreezeDesc") },
    { icon: FileCheck, label: t("admin.nav.kycReview"), path: "/admin/kyc-review", description: t("admin.nav.kycReviewDesc") },
    { icon: AlertTriangle, label: t("admin.nav.fraudMonitor"), path: "/admin/fraud", description: t("admin.nav.fraudMonitorDesc") },
    { icon: Users, label: t("admin.nav.staffManagement"), path: "/admin/staff", description: t("admin.nav.staffManagementDesc") },
    { icon: Landmark, label: t("admin.nav.loanManagement"), path: "/admin/loans", description: t("admin.nav.loanManagementDesc") },
    { icon: SlidersHorizontal, label: t("admin.nav.loanPolicy"), path: "/admin/loan-settings", description: t("admin.nav.loanPolicyDesc") },
    { icon: Activity, label: t("admin.nav.riskMonitor"), path: "/admin/risk-monitor", description: t("admin.nav.riskMonitorDesc") },
    { icon: BookOpen, label: "Blog Management", path: "/admin/blog", description: "Create and manage blog posts" },
  ];

  const renderNavSection = (items: typeof marketplaceNavItems, sectionLabel: string) => (
    <>
      <div className="px-3 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
        {sectionLabel}
      </div>
      {items.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setSidebarOpen(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all border",
              isActive 
                ? "bg-red-950/50 text-red-400 border-red-800/50" 
                : "text-slate-400 hover:text-white hover:bg-slate-900/50 border-transparent hover:border-slate-800"
            )}
          >
            <item.icon className={cn("w-4 h-4", isActive && "text-red-400")} />
            <div className="flex-1 min-w-0">
              <span className="block truncate">{item.label}</span>
              <span className="text-[10px] text-slate-600 block truncate">{item.description}</span>
            </div>
            {item.path === "/admin/marketplace" && pendingDocumentCount > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-semibold h-5 min-w-[1.25rem] px-2">
                {pendingDocumentCount}
              </span>
            )}
            {item.path === "/admin/seller-applications" && pendingSellerCount > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-semibold h-5 min-w-[1.25rem] px-2">
                {pendingSellerCount}
              </span>
            )}
          </Link>
        );
      })}
    </>
  );

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const userInitials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "AD";

  return (
    <div className="min-h-screen bg-black flex" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside 
        className={cn(
          "fixed lg:sticky top-0 z-50 h-screen w-72 bg-black flex flex-col transition-transform duration-300",
          isRTL ? "right-0 border-l border-red-900/30" : "left-0 border-r border-red-900/30",
          sidebarOpen 
            ? "translate-x-0" 
            : isRTL 
              ? "translate-x-full lg:translate-x-0" 
              : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="p-6 border-b border-red-900/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-950 border border-red-800/50 flex items-center justify-center">
              <Shield className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <span className="font-bold text-sm text-white tracking-wide">{t("admin.superAdmin")}</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs text-red-400">{t("admin.ownerAccess").toUpperCase()}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
          {renderNavSection(marketplaceNavItems, "Marketplace")}
          
          <div className="border-t border-slate-800 pt-6">
            {renderNavSection(systemUtilitiesItems, "Core System Utilities")}
          </div>
        </nav>

        <div className="p-4 border-t border-red-900/30">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-950/30 border border-red-900/30 mb-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center">
              <span className="text-sm font-bold text-red-400">{userInitials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">
                {profile?.full_name || "Administrator"}
              </div>
              <div className="text-[10px] text-red-400 uppercase tracking-wider">
                {t("admin.superAdmin")}
              </div>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
            onClick={handleSignOut}
          >
            <LogOut className={cn("w-4 h-4", isRTL && "rtl:flip")} />
            {t("admin.endSession")}
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen bg-black">
        <header className="sticky top-0 z-30 h-16 border-b border-red-900/30 bg-black/90 backdrop-blur-xl flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-slate-400 hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500">
              <span className="text-red-500">//</span>
              <span>VAULTGROWTH</span>
              <span className="text-slate-700">/</span>
              <span className="text-red-400">ADMIN</span>
            </div>
          </div>

          <div className="hidden xl:flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              <Input
                type="search"
                placeholder="Search users, listings, orders..."
                className="pl-10 h-10 w-72 bg-slate-950 border-slate-800 text-white"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/seller-applications')}
              className="text-white border-slate-700 hover:border-slate-500"
            >
              Add Seller
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/disputes')}
              className="text-white border-slate-700 hover:border-slate-500"
            >
              View Disputes
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-800"
              onClick={() => {
                navigate('/notifications');
              }}
            >
              <Bell className="w-4 h-4 text-slate-400" />
              {unreadCount > 0 && !notificationsLoading && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg bg-red-950/50 hover:bg-red-900/50 border border-red-800/50"
                >
                  <span className="text-xs font-bold text-red-400">{userInitials}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-slate-900 border-slate-800">
                <DropdownMenuLabel className="text-slate-400">
                  <div className="flex flex-col">
                    <span className="text-white">{profile?.full_name || "Administrator"}</span>
                    <span className="text-xs font-normal text-red-400">{t("admin.superAdmin")}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-800" />
                <DropdownMenuItem 
                  onClick={handleSignOut} 
                  className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                >
                  <LogOut className={cn("mr-2 h-4 w-4", isRTL && "rtl:flip")} />
                  {t("admin.endSession")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
