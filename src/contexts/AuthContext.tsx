import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { hashString } from "@/lib/utils";

type AppRole = "super_admin" | "admin" | "staff" | "seller" | "member";

interface Profile {
  id: string;
  full_name: string | null;
  two_factor_enabled?: boolean;
  two_factor_method?: string;
  email: string | null;
  referral_code: string;
  investment_tier: string;
  is_frozen: boolean;
  kyc_status: string;
  preferred_currency: string;
  account_status: string | null;
  ip_hash?: string | null;
  accepted_terms_version_id?: string | null;
  id_type: string | null;
  id_number: string | null;
  kyc_document_url: string | null;
  kyc_submitted_at: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  isLoading: boolean;
  twoFactorPending: boolean;
  needsTermsAcceptance: boolean;
  signUp: (email: string, password: string, fullName: string, referralCode?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; twoFactorRequired?: boolean }>;
  confirmTwoFactorCode: (code: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  acceptTerms: (versionId: string) => Promise<{ error: Error | null }>;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isSeller: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const useOptionalAuth = () => {
  return useContext(AuthContext) ?? null;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [twoFactorPending, setTwoFactorPending] = useState(false);
  const [pendingTwoFactorCredentials, setPendingTwoFactorCredentials] = useState<{
    userId: string;
    email: string;
    password: string;
  } | null>(null);
  const [needsTermsAcceptance, setNeedsTermsAcceptance] = useState(false);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile:", error);
      return null;
    }
    return data as Profile | null;
  };

  const fetchRole = async (userId: string) => {
    try {
      // Check user_roles table for all roles
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error) {
        console.error("Error fetching role:", error);
        return null;
      }

      // Return highest-priority role: super_admin > admin > staff > member
      const roles = (data ?? []).map((r) => r.role as AppRole);
      if (roles.includes("super_admin")) return "super_admin";
      if (roles.includes("admin")) return "admin";
      if (roles.includes("staff")) return "staff";
      if (roles.includes("seller")) return "seller";
      if (roles.includes("member")) return "member";
      return null;
    } catch (error) {
      console.error("Error in fetchRole:", error);
      return null;
    }
  };

  const getPublicIpAddress = async (): Promise<string | null> => {
    try {
      const response = await fetch("https://api.ipify.org?format=json");
      if (!response.ok) {
        throw new Error(`IP fetch failed: ${response.status}`);
      }
      const data = await response.json();
      return typeof data.ip === "string" ? data.ip : null;
    } catch (error) {
      console.warn("Unable to fetch public IP address:", error);
      return null;
    }
  };

  const checkTermsAcceptance = async (userId: string) => {
    const { data, error } = await supabase.rpc("user_needs_terms_acceptance", { p_user_id: userId });
    if (error) {
      console.error("Error checking terms acceptance:", error);
      return false;
    }
    return data as boolean;
  };

  const acceptTerms = async (versionId: string) => {
    if (!user) return { error: new Error("Not authenticated") };

    const ipAddress = await getPublicIpAddress();
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : null;

    const { error } = await supabase
      .from("profiles")
      .update({ accepted_terms_version_id: versionId })
      .eq("id", user.id);

    if (error) {
      return { error };
    }

    const { error: logError } = await supabase.from("consent_logs").insert({
      user_id: user.id,
      terms_version_id: versionId,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    if (logError) {
      console.error("Failed to insert consent log:", logError);
      return { error: logError };
    }

    setNeedsTermsAcceptance(false);
    const updatedProfile = await fetchProfile(user.id);
    setProfile(updatedProfile);

    return { error: null };
  };

  const getIpHash = async (): Promise<string | null> => {
    const ip = await getPublicIpAddress();
    if (!ip) return null;
    return await hashString(ip);
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Don't update user state if 2FA is pending
        if (twoFactorPending) {
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        // Defer Supabase calls with setTimeout to prevent deadlocks
        if (session?.user) {
          setTimeout(async () => {
            const [profileData, roleData] = await Promise.all([
              fetchProfile(session.user.id),
              fetchRole(session.user.id),
            ]);
            setProfile(profileData);
            setRole(roleData);
            setIsLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Don't update user state if 2FA is pending
      if (twoFactorPending) {
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        Promise.all([
          fetchProfile(session.user.id),
          fetchRole(session.user.id),
        ]).then(([profileData, roleData]) => {
          setProfile(profileData);
          setRole(roleData);

          // Check if user needs to accept terms
          checkTermsAcceptance(session.user.id).then(setNeedsTermsAcceptance);
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [twoFactorPending]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`profile-updates-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          if (payload.new) {
            setProfile((prev) => ({
              ...prev,
              ...(payload.new as Profile),
            }));
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    referralCode?: string
  ) => {
    const redirectUrl = `${window.location.origin}/`;
    const ipHash = await getIpHash();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          referral_code: referralCode || null,
          ip_hash: ipHash,
        },
      },
    });

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const ipHash = await getIpHash();

    if (ipHash) {
      const { data: blacklisted, error: blacklistError } = await supabase.rpc("is_ip_blacklisted", {
        p_ip_hash: ipHash,
      });

      if (blacklistError) {
        console.error("IP blacklist check failed:", blacklistError);
      } else if (blacklisted === true) {
        return {
          error: new Error(
            "Login blocked: this IP address is associated with a blacklisted account. Please contact support."
          ),
        };
      }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("Supabase signInWithPassword error:", error);
      return { error };
    }

    const signedInUser = data?.user;
    if (!signedInUser) {
      console.error("Supabase signInWithPassword returned no user:", data);
      return { error: new Error("Unable to sign in") };
    }

    if (ipHash) {
      await supabase.from("profiles").update({ ip_hash: ipHash }).eq("id", signedInUser.id);
    }

    const profileData = await fetchProfile(signedInUser.id);
    const roleData = await fetchRole(signedInUser.id);

    let twoFactorRequired = false;

    if (roleData === "super_admin") {
      twoFactorRequired = true;
    }

    if (twoFactorRequired) {
      console.log("🔐 2FA Required for admin. Sending email to:", email);
      
      // Send 2FA code via backend email service
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
        console.log("📧 Backend URL:", backendUrl);
        
        const response = await fetch(`${backendUrl}/api/2fa/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            email: email,
            type: 'login'
          }),
        });

        console.log("📧 Backend response status:", response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Failed to send 2FA email. Status:', response.status, "Error:", errorText);
          // Still continue with login flow even if email fails
        } else {
          const data = await response.json();
          console.log("✅ 2FA email sent successfully:", data);
        }
      } catch (error) {
        console.error('❌ Error sending 2FA email:', error);
        // Still continue with login flow even if email fails
      }
      
      // Now set pending state and clear auth
      console.log("🔐 Setting 2FA pending state");
      setTwoFactorPending(true);
      setPendingTwoFactorCredentials({ userId: signedInUser.id, email, password });
      
      // Clear user state to prevent dashboard from showing
      setUser(null);
      setSession(null);
      setProfile(null);
      setRole(null);
      
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      console.log("✅ 2FA login flow complete - returning twoFactorRequired: true");
      return { error: null, twoFactorRequired: true };
    }

    // User does not require 2FA, proceed with normal login
    setUser(signedInUser);
    setSession(data?.session ?? null);
    setProfile(profileData);
    setRole(roleData);

    // Check if user needs to accept terms
    const needsAcceptance = await checkTermsAcceptance(signedInUser.id);
    setNeedsTermsAcceptance(needsAcceptance);

    setTwoFactorPending(false);
    setPendingTwoFactorCredentials(null);

    return { error: null };
  };

  const confirmTwoFactorCode = async (code: string) => {
    if (!pendingTwoFactorCredentials) {
      return { error: new Error("No two-factor authentication pending") };
    }

    try {
      // Call backend API to verify 2FA code
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      const response = await fetch(`${backendUrl}/api/2fa/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: pendingTwoFactorCredentials.email,
          code: code,
          type: 'login'
        })
      });

      const result = await response.json();

      if (!response.ok) {
        return { error: new Error(result.error || 'Invalid 2FA code') };
      }

      if (!user) {
        const authResult = await supabase.auth.signInWithPassword({
          email: pendingTwoFactorCredentials.email,
          password: pendingTwoFactorCredentials.password,
        });

        if (authResult.error) {
          return { error: authResult.error };
        }

        const signedInUser = authResult.data.user;
        setUser(signedInUser ?? null);
        setSession(authResult.data.session ?? null);

        if (signedInUser) {
          const profileData = await fetchProfile(signedInUser.id);
          const roleData = await fetchRole(signedInUser.id);
          setProfile(profileData);
          setRole(roleData);
          
          if (roleData === "super_admin") {
            await supabase.rpc('create_admin_mfa_session');
          }
        }
      } else {
        if (role === "super_admin") {
          await supabase.rpc('create_admin_mfa_session');
        }
      }

      setTwoFactorPending(false);
      setPendingTwoFactorCredentials(null);

      return { error: null };
    } catch (err: any) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    setTwoFactorPending(false);
    setPendingTwoFactorCredentials(null);
  };

  const isSuperAdmin = role === "super_admin";
  const isAdmin = isSuperAdmin || role === "admin";
  const isStaff = isSuperAdmin || role === "staff";
  const isSeller = role === "seller";

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        isLoading,
        twoFactorPending,
        needsTermsAcceptance,
        signUp,
        signIn,
        confirmTwoFactorCode,
        signOut,
        acceptTerms,
        isSuperAdmin,
        isAdmin,
        isStaff,
        isSeller,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
