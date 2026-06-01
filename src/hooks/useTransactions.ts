import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Transaction {
  id: string;
  user_id: string;
  transaction_type: "investment" | "withdrawal" | "bonus" | "loan" | "transfer";
  amount: number;
  amount_mlm: number;
  amount_trading: number;
  description: string | null;
  status: string;
  created_at: string;
}

export const useTransactions = (limit?: number) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["transactions", user?.id, limit],
    queryFn: async () => {
      if (!user) return null;

      let query = supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!user,
  });
};
