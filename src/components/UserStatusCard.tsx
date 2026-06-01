import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Shield, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface AdminActionLog {
  id: string;
  action: string;
  policy_section: string;
  details: string;
  created_at: string;
}

export const UserStatusCard: React.FC = () => {
  const { user, profile } = useAuth();

  const { data: freezeReason, isLoading } = useQuery({
    queryKey: ["user-freeze-reason", user?.id],
    queryFn: async () => {
      if (!user?.id || !profile?.is_frozen) return null;

      const { data, error } = await supabase
        .from("admin_action_logs")
        .select("id, action, policy_section, details, created_at")
        .eq("target_user_id", user.id)
        .eq("action", "freeze_account")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error("Error fetching freeze reason:", error);
        return null;
      }

      return data as AdminActionLog;
    },
    enabled: !!user?.id && profile?.is_frozen === true,
  });

  if (!profile?.is_frozen) {
    return null; // Don't show anything if account is not frozen
  }

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-5 h-5" />
          Account Status: Frozen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Your account has been temporarily frozen for security reasons.
            </p>

            {isLoading ? (
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2 mt-1"></div>
              </div>
            ) : freezeReason ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="text-xs">
                    Policy Section {freezeReason.policy_section}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(freezeReason.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-foreground bg-muted/50 p-3 rounded-md border-l-2 border-destructive">
                  {freezeReason.details}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Info className="w-4 h-4" />
                <span>Reason details are being reviewed. Please contact support for more information.</span>
              </div>
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-destructive/20">
          <p className="text-xs text-muted-foreground">
            <strong>What happens next?</strong> Your account will remain frozen until the security review is complete.
            You can still sign out and sign back in, but access to most features is restricted.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};