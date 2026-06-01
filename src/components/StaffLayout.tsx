import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { 
  FileCheck, 
  Users, 
  LogOut,
  Menu,
  X,
  Bell,
  Terminal,
  MessageSquare,
  BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
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

interface StaffLayoutProps {
  children: ReactNode;
}

const StaffLayout = ({ children }: StaffLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { profile, role, signOut } = useAuth();

  // Staff-only navigation items based on permissions chart
  // Staff can access: KYC Review, Deposit Verification, Support Tickets
  // Staff CANNOT access: Withdrawal Approval, Manual Balance Edit, MLM Settings, Global Freeze, Staff Management
  const staffNavItems = [
    { 
      icon: BookOpen, 
      label: "Blog Management", 
      path: "/admin/blog",
      description: "Create and manage blog posts"
    },
    { 
      icon: MessageSquare, 
      label: "Support Tickets", 
      path: "/staff/tickets",
      description: "Customer conversations"
    },
    { 
      icon: Users, 
      label: "User Directory", 
      path: "/staff/directory",
      description: "View & search users"
    },
    { 
      icon: FileCheck, 
      label: "KYC Documents", 
      path: "/staff/kyc-review",
      description: "View & recommend for admin"
    },
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

  return (
    <div className="min-h-screen bg-black flex" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Control Center Style */}
      <aside 
        className={cn(
          "fixed lg:sticky top-0 z-50 h-screen w-72 bg-black flex flex-col transition-transform duration-300",
          isRTL ? "right-0 border-l border-slate-800" : "left-0 border-r border-slate-800",
          sidebarOpen 
            ? "translate-x-0" 
            : isRTL 
              ? "translate-x-full lg:translate-x-0" 
              : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Control Center Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center">
              <Terminal className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <span className="font-bold text-sm text-white tracking-wide">CONTROL CENTER</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-slate-500">STAFF MODE</span>
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

        {/* Staff Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="px-3 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
            Staff Tasks
          </div>
          {staffNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all border",
                  isActive 
                    ? "bg-slate-900 text-cyan-400 border-cyan-500/30" 
                    : "text-slate-400 hover:text-white hover:bg-slate-900/50 border-transparent hover:border-slate-800"
                )}
              >
                <item.icon className={cn("w-4 h-4", isActive && "text-cyan-400")} />
                <div className="flex-1 min-w-0">
                  <span className="block truncate">{item.label}</span>
                  <span className="text-[10px] text-slate-600 block truncate">{item.description}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Operator Section */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-800 mb-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
              <span className="text-sm font-bold text-cyan-400">{userInitials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">
                {profile?.full_name || "Operator"}
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                {role === "admin" ? "ADMINISTRATOR" : "STAFF OPERATOR"}
              </div>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
            onClick={handleSignOut}
          >
            <LogOut className={cn("w-4 h-4", isRTL && "rtl:flip")} />
            End Session
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen bg-black">
        {/* Top Bar - Control Center Style */}
        <header className="sticky top-0 z-30 h-14 border-b border-slate-800 bg-black/90 backdrop-blur-xl flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-slate-400 hover:text-white"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500">
              <span className="text-slate-600">//</span>
              <span>VAULTGROWTH</span>
              <span className="text-slate-700">/</span>
              <span className="text-cyan-400">STAFF</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <LanguageSwitcher />
            
            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="relative h-9 w-9 rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-800"
                >
                  <Bell className="w-4 h-4 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 bg-slate-900 border-slate-800">
                <DropdownMenuLabel className="text-slate-400">Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-800" />
                <div className="p-4 text-sm text-slate-500 text-center">
                  No new alerts
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800"
                >
                  <span className="text-xs font-bold text-cyan-400">{userInitials}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-slate-900 border-slate-800">
                <DropdownMenuLabel className="text-slate-400">
                  <div className="flex flex-col">
                    <span className="text-white">{profile?.full_name || "Operator"}</span>
                    <span className="text-xs font-normal text-slate-500">{profile?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-800" />
                <DropdownMenuItem 
                  onClick={handleSignOut} 
                  className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                >
                  <LogOut className={cn("mr-2 h-4 w-4", isRTL && "rtl:flip")} />
                  End Session
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default StaffLayout;
