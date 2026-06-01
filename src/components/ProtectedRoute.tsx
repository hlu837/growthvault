import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: ("super_admin" | "admin" | "staff" | "seller" | "member")[];
  redirectStaff?: boolean; // If true, redirect staff away from this route
  redirectAdmin?: boolean; // If true, redirect admin away from this route
}

const ProtectedRoute = ({ 
  children, 
  requiredRoles, 
  redirectStaff = false,
  redirectAdmin = false 
}: ProtectedRouteProps) => {
  const { user, role, profile, isLoading, isStaff, isAdmin, isSuperAdmin } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (profile?.account_status === "suspended" && location.pathname !== "/account-suspended") {
    return <Navigate to="/account-suspended" replace />;
  }

  // Redirect admin users away from member routes to admin panel
  if (redirectAdmin && isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  // Redirect staff users away from member routes to their control center
  // Staff should only access /staff/* routes, not /dashboard/*
  if (redirectStaff && isStaff && !isAdmin) {
    return <Navigate to="/admin/blog" replace />;
  }

  if (requiredRoles && role && !requiredRoles.includes(role)) {
    // Super admin can access any route
    if (isSuperAdmin) {
      return <>{children}</>;
    }
    // Admin can access admin/staff routes (not member-only)
    if (isAdmin && !requiredRoles.includes("member")) {
      return <>{children}</>;
    }
    // Redirect to appropriate dashboard based on role
    if (isAdmin) {
      return <Navigate to="/admin" replace />;
    }
    if (isStaff) {
      return <Navigate to="/staff/kyc" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
