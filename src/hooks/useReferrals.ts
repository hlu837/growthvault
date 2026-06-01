import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  level: number;
  earnings: number;
  created_at: string;
  referred_profile?: {
    full_name: string | null;
    email: string | null;
    investment_tier: string;
  } | null;
}

export const useReferrals = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["referrals", user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Use the new referral_stats_view which includes proper tier mapping
      const { data: referralsData, error: referralsError } = await supabase
        .from("referral_stats_view")
        .select("*")
        .eq("referrer_id", user.id)
        .order("created_at", { ascending: false });

      if (referralsError) throw referralsError;

      // Filter out system account referrals (they are neutral uplines, not real referrals)
      const filteredReferrals = referralsData.filter(
        (r) => r.referred_id !== r.referrer_id
      );

      // Map to the expected Referral interface format
      const referrals: Referral[] = filteredReferrals.map((r) => ({
        id: r.id,
        referrer_id: r.referrer_id,
        referred_id: r.referred_id,
        level: r.level,
        earnings: r.earnings,
        created_at: r.created_at,
        referred_profile: {
          full_name: r.full_name,
          email: r.email,
          investment_tier: r.display_tier || "Bronze", // Use display tier with fallback
        },
      }));

      return referrals;
    },
    enabled: !!user,
  });
};

export const useReferralStats = () => {
  const { data: referrals, isLoading: referralsLoading } = useReferrals();
  const { user } = useAuth();

  const {
    data: referralBonuses,
    isLoading: bonusLoading,
  } = useQuery({
    queryKey: ["referral-bonus-transactions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select("amount, status")
        .eq("user_id", user.id)
        .eq("transaction_type", "bonus");

      if (error) throw error;
      return data as { amount: number; status: string | null }[];
    },
    enabled: !!user,
  });

  const pendingEarnings = referralBonuses?.reduce((sum, tx) => {
    const isPending = tx.status && tx.status.toLowerCase() !== "completed";
    return isPending ? sum + Number(tx.amount) : sum;
  }, 0) ?? 0;

  const stats = {
    totalReferrals: referrals?.length ?? 0,
    totalEarnings: referrals?.reduce((sum, r) => sum + Number(r.earnings), 0) ?? 0,
    pendingEarnings,
    loanEligible: (referrals?.length ?? 0) >= 3,
  };

  return { stats, isLoading: referralsLoading || bonusLoading };
};
