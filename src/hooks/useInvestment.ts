import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type InvestmentTier = "starter" | "golden" | "premium" | "business" | "platinum" | "achiever";

interface ProcessInvestmentParams {
  amount: number;
  tier: InvestmentTier;
}

export const useProcessInvestment = () => {
  const { user, refetchProfile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ amount, tier }: ProcessInvestmentParams) => {
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase.rpc("process_investment", {
        p_user_id: user.id,
        p_amount: amount,
        p_tier: tier,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      // Invalidate relevant queries to refetch updated data
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      
      // Refetch profile in AuthContext to ensure investment_tier is updated
      await refetchProfile();
    },
  });
};
