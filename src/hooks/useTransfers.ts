import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { WalletType } from "./useWallets";

export interface Transfer {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  from_wallet_type: WalletType;
  to_wallet_type: WalletType;
  amount: number;
  description: string | null;
  status: string;
  created_at: string;
}

export const useTransfers = (limit?: number) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["transfers", user?.id, limit],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from("transfers")
        .select("*")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Transfer[];
    },
    enabled: !!user,
  });
};

export const useWalletTransfer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      fromWalletType,
      toWalletType,
      amount,
      recipientId,
      description,
    }: {
      fromWalletType: WalletType;
      toWalletType: WalletType;
      amount: number;
      recipientId?: string;
      description?: string;
    }) => {
      const { data, error } = await supabase.rpc("process_wallet_transfer", {
        p_from_wallet_type: fromWalletType,
        p_to_wallet_type: toWalletType,
        p_amount: amount,
        p_recipient_id: recipientId || null,
        p_description: description || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
};