import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getTierDisplayName } from "@/lib/utils";

export interface NetworkMember {
  level: number;
  user_id: string;
  full_name: string | null;
  email: string | null;
  investment_tier: string | null;
  joined_at?: string | null;
}

export const useUpline = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["upline", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_user_upline");
      if (error) throw error;
      return ((data ?? []) as any[]).map((row: any) => ({
        level: row.level,
        user_id: row.user_id,
        full_name: row.full_name,
        email: row.email,
        investment_tier: getTierDisplayName(row.investment_tier),
      })) as NetworkMember[];
    },
    enabled: !!user,
  });
};

export const useDownline = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["downline", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_user_network");
      if (error) throw error;
      return ((data ?? []) as any[]).map((row: any) => ({
        level: row.level,
        user_id: row.user_id,
        full_name: row.full_name,
        email: row.email,
        investment_tier: getTierDisplayName(row.investment_tier),
        joined_at: row.joined_at,
      })) as NetworkMember[];
    },
    enabled: !!user,
  });
};

export const useTeamSize = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["team_size", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_team_size");
      if (error) throw error;
      return (data as unknown as number) ?? 0;
    },
    enabled: !!user,
  });
};
