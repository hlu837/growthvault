import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Card {
  id: string;
  user_id: string;
  card_type: "virtual" | "physical";
  card_number: string | null;
  card_name: string;
  status: "pending" | "active" | "frozen" | "cancelled";
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useCards = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["cards", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("cards")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Card[];
    },
    enabled: !!user,
  });
};

export const useRequestCard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cardType, cardName }: { cardType: "virtual" | "physical"; cardName: string }) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("cards")
        .insert({
          user_id: user.id,
          card_type: cardType,
          card_name: cardName,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
    },
  });
};

export const useUpdateCardStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cardId, status }: { cardId: string; status: "active" | "frozen" | "cancelled" }) => {
      const { data, error } = await supabase
        .from("cards")
        .update({ status })
        .eq("id", cardId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cards"] });
    },
  });
};